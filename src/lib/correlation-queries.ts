import { client } from "@/db";

// 생산 vs 판매 비교는 생산·판매 양쪽에 존재하는 품종(매칭 품목)만 사용한다.
// 판매실적에는 캡·라벨 등 부자재가 포함되어 전체 수량을 직접 비교할 수 없기 때문이다.
const MATCHED_PROD = `product_type IN (SELECT product_type FROM sales_records WHERE product_type IS NOT NULL)`;
const MATCHED_SALES = `product_type IN (SELECT product_type FROM production_records WHERE product_type IS NOT NULL)`;

interface YearMonthQty {
  year: number;
  month: number;
  qty: string;
}

interface MonthlyPair {
  ym: string;
  production: string;
  sales: string;
}

// 공통 품종 목록 (생산·판매 양쪽에 존재)
export async function getCommonProductTypes() {
  const rows = await client.unsafe(`
    SELECT p.product_type,
           max(p.product_name) as product_name,
           sum(p.qty_grade_a)::bigint as total_prod,
           s.total_sales
    FROM production_records p
    INNER JOIN (
      SELECT product_type, sum(shipment_qty)::bigint as total_sales
      FROM sales_records
      WHERE shipment_type = '정상'
      GROUP BY product_type
    ) s ON p.product_type = s.product_type
    GROUP BY p.product_type, s.total_sales
    ORDER BY total_prod DESC
    LIMIT 100
  `);
  return rows as unknown as { product_type: string; product_name: string; total_prod: string; total_sales: string }[];
}

// 품종별 월별 생산·판매 시계열 (특정 품종)
export async function getProductTimeSeries(productType: string) {
  const production = (await client.unsafe(
    `
    SELECT extract(year from production_date)::int as year,
           extract(month from production_date)::int as month,
           sum(qty_grade_a)::bigint as qty
    FROM production_records
    WHERE product_type = $1
    GROUP BY year, month
    ORDER BY year, month
  `,
    [productType]
  )) as unknown as YearMonthQty[];

  const sales = (await client.unsafe(
    `
    SELECT extract(year from shipment_date)::int as year,
           extract(month from shipment_date)::int as month,
           sum(shipment_qty)::bigint as qty
    FROM sales_records
    WHERE product_type = $1 AND shipment_type = '정상'
    GROUP BY year, month
    ORDER BY year, month
  `,
    [productType]
  )) as unknown as YearMonthQty[];

  const periodOf = (r: YearMonthQty) => `${r.year}-${String(r.month).padStart(2, "0")}`;

  // 모든 연월을 통합
  const allPeriods = new Set<string>();
  for (const r of [...production, ...sales]) allPeriods.add(periodOf(r));

  const prodMap = new Map(production.map((r) => [periodOf(r), Number(r.qty)]));
  const salesMap = new Map(sales.map((r) => [periodOf(r), Number(r.qty)]));

  return [...allPeriods].sort().map((period) => ({
    period,
    production: prodMap.get(period) ?? 0,
    sales: salesMap.get(period) ?? 0,
  }));
}

// 월별 생산·판매 (매칭 품목 기준, 월별 집계)
async function getMatchedMonthly(): Promise<MonthlyPair[]> {
  const rows = await client.unsafe(`
    SELECT p.ym, p.production, coalesce(s.sales, 0) as sales
    FROM (
      SELECT to_char(production_date, 'YYYY-MM') as ym,
             sum(qty_grade_a)::bigint as production
      FROM production_records
      WHERE ${MATCHED_PROD}
      GROUP BY ym
    ) p
    LEFT JOIN (
      SELECT to_char(shipment_date, 'YYYY-MM') as ym,
             sum(shipment_qty)::bigint as sales
      FROM sales_records
      WHERE shipment_type = '정상' AND ${MATCHED_SALES}
      GROUP BY ym
    ) s ON p.ym = s.ym
    ORDER BY p.ym
  `);
  return rows as unknown as MonthlyPair[];
}

// 월별 생산·판매 산점도 데이터 (매칭 품목 기준)
export async function getScatterData() {
  return getMatchedMonthly();
}

// 품종별 5개년 생산·판매 산점도 (공통 품종)
export async function getProductScatterData() {
  const rows = await client.unsafe(`
    SELECT p.product_type,
           p.product_name,
           p.production,
           coalesce(s.sales, 0) as sales
    FROM (
      SELECT product_type,
             max(product_name) as product_name,
             sum(qty_grade_a)::bigint as production
      FROM production_records
      GROUP BY product_type
    ) p
    INNER JOIN (
      SELECT product_type,
             sum(shipment_qty)::bigint as sales
      FROM sales_records
      WHERE shipment_type = '정상'
      GROUP BY product_type
    ) s ON p.product_type = s.product_type
    WHERE p.production > 0 AND s.sales > 0
    ORDER BY p.production DESC
  `);
  return rows as unknown as { product_type: string; product_name: string; production: string; sales: string }[];
}

// 리드타임(lag) 상관분석: 월별 생산과 N개월 후 판매의 상관계수 (매칭 품목 기준)
export async function getLagCorrelation() {
  const monthly = await getMatchedMonthly();

  const data = monthly.map((r) => ({
    ym: r.ym,
    production: Number(r.production),
    sales: Number(r.sales),
  }));

  // lag 0~6개월 상관계수 계산
  const results: { lag: number; correlation: number; pairs: number }[] = [];

  for (let lag = 0; lag <= 6; lag++) {
    const pairs: { prod: number; sales: number }[] = [];
    for (let i = 0; i < data.length - lag; i++) {
      pairs.push({
        prod: data[i].production,
        sales: data[i + lag].sales,
      });
    }

    if (pairs.length < 3) {
      results.push({ lag, correlation: 0, pairs: pairs.length });
      continue;
    }

    const n = pairs.length;
    const sumX = pairs.reduce((s, p) => s + p.prod, 0);
    const sumY = pairs.reduce((s, p) => s + p.sales, 0);
    const sumXY = pairs.reduce((s, p) => s + p.prod * p.sales, 0);
    const sumX2 = pairs.reduce((s, p) => s + p.prod * p.prod, 0);
    const sumY2 = pairs.reduce((s, p) => s + p.sales * p.sales, 0);

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const corr = den === 0 ? 0 : num / den;

    results.push({
      lag,
      correlation: Math.round(corr * 10000) / 10000,
      pairs: n,
    });
  }

  return { monthly: data, lagCorrelations: results };
}
