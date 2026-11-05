import { cacheLife } from "next/cache";
import { LATEST_YEAR, type Filters } from "@/lib/filters";
import { Q, prodConds, run, salesConds, where } from "@/lib/sql";

// ── 예측 기준 시점 ─────────────────────────────────────────────
// 계절지수: 최근 3년(2023–2025), 추세: 최근 12개월(2025) vs 직전 12개월(2024)
const SI_YEARS = [LATEST_YEAR - 2, LATEST_YEAR - 1, LATEST_YEAR];
const SI_FROM = `${LATEST_YEAR - 2}-01-01`;
const LAST12_FROM = `${LATEST_YEAR}-01-01`;
export const FORECAST_MONTHS = [1, 2, 3].map((m) => `${LATEST_YEAR + 1}-${String(m).padStart(2, "0")}`);
/**
 * 재고 추정용 순입고: 본가공입고(21) + 재가공입고(22) − 재가공투입(32).
 * 32는 재가공 공정에 투입되어 창고에서 빠져나간 수량이므로 차감한다.
 * (2021–2025 매칭 품번 기준 순입고와 순판매가 연 1~5% 이내로 일치함을 확인)
 */
const NET_RECEIPT = `sum(CASE WHEN slip_type = '32' THEN -qty_grade_a ELSE qty_grade_a END)::float8`;
const TREND_MIN = 0.7;
const TREND_MAX = 1.3;

export interface ForecastResult {
  last12: number;
  prev12: number;
  /** 최근 12개월 / 직전 12개월 증감률(%), 직전 실적이 없으면 null */
  trendPct: number | null;
  seasonalIndex: number[]; // 1~12월
  forecast: number[]; // 향후 3개월
}

/**
 * 수요 예측(참고용 추정치)
 *   예측 = 최근 12개월 월평균 × 계절지수(최근 3년) × 추세 보정
 *   추세 보정 = 1 + (증감률, ±30% 제한) × (기준 구간 중심으로부터 경과 개월 / 12)
 */
export function computeForecast(monthly: Map<string, number>): ForecastResult {
  const value = (y: number, m: number) => monthly.get(`${y}-${String(m).padStart(2, "0")}`) ?? 0;

  const idxSum = new Array<number>(12).fill(0);
  let validYears = 0;
  for (const y of SI_YEARS) {
    let total = 0;
    for (let m = 1; m <= 12; m++) total += value(y, m);
    if (total <= 0) continue;
    validYears++;
    for (let m = 1; m <= 12; m++) idxSum[m - 1] += value(y, m) / (total / 12);
  }
  const seasonalIndex = idxSum.map((s) => (validYears > 0 ? Math.max(0, s / validYears) : 1));

  let last12 = 0;
  let prev12 = 0;
  for (let m = 1; m <= 12; m++) {
    last12 += value(LATEST_YEAR, m);
    prev12 += value(LATEST_YEAR - 1, m);
  }
  const growth = prev12 > 0 && last12 > 0 ? last12 / prev12 : 1;
  const clamped = Math.min(TREND_MAX, Math.max(TREND_MIN, growth));
  const base = Math.max(0, last12) / 12;

  const forecast = [1, 2, 3].map((h) => {
    // 최근 12개월 구간의 중심(6.5월)에서 예측월까지의 거리
    const monthsAhead = 12 + h - 6.5;
    const trend = 1 + (clamped - 1) * (monthsAhead / 12);
    return Math.max(0, Math.round(base * seasonalIndex[h - 1] * trend));
  });

  return {
    last12,
    prev12,
    trendPct: prev12 > 0 ? (last12 / prev12 - 1) * 100 : null,
    seasonalIndex,
    forecast,
  };
}

export type RiskLevel = "shortage" | "low" | "ok" | "unknown";

export interface PlanningItem {
  code: string;
  name: string;
  customer: string | null;
  last12: number;
  trendPct: number | null;
  forecast: number[];
  forecastSum: number;
  /** (순입고 − 순판매) 5개년 누적. 생산 실적이 없는 품번은 null */
  estInventory: number | null;
  /** 추정 재고 ÷ 향후 3개월 월평균 예측 */
  coverMonths: number | null;
  risk: RiskLevel;
}

export interface PlanningSeriesPoint {
  ym: string;
  actual: number | null;
  forecast: number | null;
}

export interface InventoryPoint {
  ym: string;
  production: number;
  sales: number;
  flow: number;
  cumulative: number;
}

export interface PlanningData {
  items: PlanningItem[];
  totalSeries: PlanningSeriesPoint[];
  totalTrendPct: number | null;
  inventorySeries: InventoryPoint[];
}

function classify(estInventory: number | null, forecastSum: number): { coverMonths: number | null; risk: RiskLevel } {
  if (estInventory === null) return { coverMonths: null, risk: "unknown" };
  const avg = forecastSum / 3;
  if (avg <= 0) return { coverMonths: null, risk: "ok" };
  const coverMonths = estInventory / avg;
  if (estInventory <= 0) return { coverMonths, risk: "shortage" };
  if (coverMonths < 1) return { coverMonths, risk: "low" };
  return { coverMonths, risk: "ok" };
}

/** 품목별 수요 예측 + 재고 추정 (연/분기/월 필터 미적용: 항상 최근 실적 기준) */
export async function getPlanningData(f: Filters): Promise<PlanningData> {
  "use cache";
  cacheLife("hours");

  // 1) 최근 12개월 순판매 상위 300개 품번의 36개월 월별 순판매
  const q1 = new Q();
  const c1 = [...salesConds(q1, f, { ignorePeriod: true }), "product_code IS NOT NULL", `shipment_date >= ${q1.p(SI_FROM)}::date`];
  const itemMonthly = run<{ code: string; name: string; customer: string | null; ym: string; v: number }>(
    `WITH base AS (
       SELECT product_code AS code, max(product_name) AS name, max(customer_name) AS customer,
              to_char(shipment_date, 'YYYY-MM') AS ym, sum(shipment_qty)::float8 AS v
       FROM sales_records ${where(c1)}
       GROUP BY 1, 4
     ), top AS (
       SELECT code FROM base WHERE ym >= ${q1.p(LAST12_FROM.slice(0, 7))}
       GROUP BY 1 HAVING sum(v) > 0 ORDER BY sum(v) DESC LIMIT 300
     )
     SELECT b.code, b.name, b.customer, b.ym, b.v FROM base b JOIN top USING (code)`,
    q1
  );

  // 2) 전체 월별 순판매 (36개월)
  const q2 = new Q();
  const c2 = [...salesConds(q2, f, { ignorePeriod: true }), `shipment_date >= ${q2.p(SI_FROM)}::date`];
  const totalMonthly = run<{ ym: string; v: number }>(
    `SELECT to_char(shipment_date, 'YYYY-MM') AS ym, sum(shipment_qty)::float8 AS v
     FROM sales_records ${where(c2)} GROUP BY 1 ORDER BY 1`,
    q2
  );

  // 3) 매칭 품번별 5개년 누적 순입고·순판매 (전표구분 필터와 무관)
  const q3 = new Q();
  const p3 = where([
    ...prodConds(q3, f, { ignorePeriod: true, ignoreSlip: true, matched: true }),
    "product_code IS NOT NULL",
  ]);
  const s3 = where([...salesConds(q3, f, { ignorePeriod: true, matched: true }), "product_code IS NOT NULL"]);
  const cumulative = run<{ code: string; prod: number; sales: number }>(
    `WITH p AS (
       SELECT product_code AS code, ${NET_RECEIPT} AS v FROM production_records ${p3} GROUP BY 1
     ), s AS (
       SELECT product_code AS code, sum(shipment_qty)::float8 AS v FROM sales_records ${s3} GROUP BY 1
     )
     SELECT p.code, p.v AS prod, coalesce(s.v, 0)::float8 AS sales
     FROM p LEFT JOIN s USING (code)`,
    q3
  );

  // 4) 매칭 품목 월별 순입고·순판매 (60개월)
  const q4 = new Q();
  const p4 = where(prodConds(q4, f, { ignorePeriod: true, ignoreSlip: true, matched: true }));
  const s4 = where(salesConds(q4, f, { ignorePeriod: true, matched: true }));
  const matchedMonthly = run<{ ym: string; production: number; sales: number }>(
    `WITH p AS (
       SELECT to_char(production_date, 'YYYY-MM') AS ym, ${NET_RECEIPT} AS v
       FROM production_records ${p4} GROUP BY 1
     ), s AS (
       SELECT to_char(shipment_date, 'YYYY-MM') AS ym, sum(shipment_qty)::float8 AS v
       FROM sales_records ${s4} GROUP BY 1
     )
     SELECT coalesce(p.ym, s.ym) AS ym,
            coalesce(p.v, 0)::float8 AS production, coalesce(s.v, 0)::float8 AS sales
     FROM p FULL JOIN s ON p.ym = s.ym ORDER BY 1`,
    q4
  );

  const [itemRows, totalRows, cumRows, matchedRows] = await Promise.all([
    itemMonthly,
    totalMonthly,
    cumulative,
    matchedMonthly,
  ]);

  // 품번별 예측
  const cumMap = new Map(cumRows.map((r) => [r.code, r.prod - r.sales]));
  const byCode = new Map<string, { name: string; customer: string | null; monthly: Map<string, number> }>();
  for (const r of itemRows) {
    let entry = byCode.get(r.code);
    if (!entry) {
      entry = { name: (r.name ?? r.code).trim(), customer: r.customer, monthly: new Map() };
      byCode.set(r.code, entry);
    }
    entry.monthly.set(r.ym, r.v);
  }
  const items: PlanningItem[] = [];
  for (const [code, entry] of byCode) {
    const fc = computeForecast(entry.monthly);
    const forecastSum = fc.forecast.reduce((a, b) => a + b, 0);
    const estInventory = cumMap.has(code) ? (cumMap.get(code) as number) : null;
    items.push({
      code,
      name: entry.name,
      customer: entry.customer,
      last12: fc.last12,
      trendPct: fc.trendPct,
      forecast: fc.forecast,
      forecastSum,
      estInventory,
      ...classify(estInventory, forecastSum),
    });
  }
  items.sort((a, b) => b.last12 - a.last12);

  // 전체 예측 시계열: 최근 24개월 실적 + 향후 3개월 예측
  const totalMap = new Map(totalRows.map((r) => [r.ym, r.v]));
  const totalFc = computeForecast(totalMap);
  const recent = totalRows.filter((r) => r.ym >= `${LATEST_YEAR - 1}-01`);
  const totalSeries: PlanningSeriesPoint[] = recent.map((r, i) => ({
    ym: r.ym,
    actual: r.v,
    // 마지막 실적 점에서 예측선이 이어지도록 연결
    forecast: i === recent.length - 1 ? r.v : null,
  }));
  FORECAST_MONTHS.forEach((ym, i) => totalSeries.push({ ym, actual: null, forecast: totalFc.forecast[i] }));

  let running = 0;
  const inventorySeries: InventoryPoint[] = matchedRows.map((r) => {
    const flow = r.production - r.sales;
    running += flow;
    return { ym: r.ym, production: r.production, sales: r.sales, flow, cumulative: running };
  });

  return { items, totalSeries, totalTrendPct: totalFc.trendPct, inventorySeries };
}

export interface PlanningItemDetail {
  code: string;
  name: string | null;
  series: { ym: string; production: number; sales: number; cumulative: number; forecast: number | null }[];
  forecast: ForecastResult;
}

/** 품번 1개의 월별 순입고·순판매·누적(추정 재고)·예측 */
export async function getPlanningItem(f: Filters, productCode: string): Promise<PlanningItemDetail> {
  "use cache";
  cacheLife("hours");

  // 품번을 직접 지정하므로 거래선·품종·포장단위 필터는 적용하지 않는다
  const base: Filters = { ...f, customers: [], productTypes: [], packUnits: [], depts: [] };
  const q = new Q();
  const p = where([
    ...prodConds(q, base, { ignorePeriod: true, ignoreSlip: true }),
    `product_code = ${q.p(productCode)}`,
  ]);
  const s = where([...salesConds(q, base, { ignorePeriod: true }), `product_code = ${q.p(productCode)}`]);
  const rows = await run<{ ym: string; name: string | null; production: number; sales: number }>(
    `WITH p AS (
       SELECT to_char(production_date, 'YYYY-MM') AS ym, ${NET_RECEIPT} AS v, max(product_name) AS name
       FROM production_records ${p} GROUP BY 1
     ), s AS (
       SELECT to_char(shipment_date, 'YYYY-MM') AS ym, sum(shipment_qty)::float8 AS v, max(product_name) AS name
       FROM sales_records ${s} GROUP BY 1
     )
     SELECT coalesce(p.ym, s.ym) AS ym, coalesce(s.name, p.name) AS name,
            coalesce(p.v, 0)::float8 AS production, coalesce(s.v, 0)::float8 AS sales
     FROM p FULL JOIN s ON p.ym = s.ym ORDER BY 1`,
    q
  );

  const forecast = computeForecast(new Map(rows.map((r) => [r.ym, r.sales])));
  let running = 0;
  const series: PlanningItemDetail["series"] = rows.map((r) => {
    running += r.production - r.sales;
    return { ym: r.ym, production: r.production, sales: r.sales, cumulative: running, forecast: null };
  });
  FORECAST_MONTHS.forEach((ym, i) =>
    series.push({ ym, production: 0, sales: 0, cumulative: running, forecast: forecast.forecast[i] })
  );

  return {
    code: productCode,
    name: rows.find((r) => r.name)?.name?.trim() ?? null,
    series,
    forecast,
  };
}
