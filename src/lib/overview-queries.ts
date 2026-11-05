import { cacheLife } from "next/cache";
import type { Filters } from "@/lib/filters";
import { Q, prodConds, run, salesConds, where } from "@/lib/sql";

export interface KpiValues {
  qtyA: number;
  qtyC: number;
  normal: number;
  returned: number; // 음수
  productTypes: number;
  customers: number;
}

/** 기간 KPI: 생산(A급·C급) + 판매(정상·반품·품종 수·거래선 수) */
export async function getKpis(f: Filters): Promise<KpiValues> {
  "use cache";
  cacheLife("hours");

  const qp = new Q();
  const qs = new Q();
  const [[prod], [sales]] = await Promise.all([
    run<{ a: number; c: number }>(
      `SELECT coalesce(sum(qty_grade_a), 0)::float8 AS a,
              coalesce(sum(qty_grade_c), 0)::float8 AS c
       FROM production_records ${where(prodConds(qp, f))}`,
      qp
    ),
    run<{ normal: number; returned: number; types: number; customers: number }>(
      `SELECT coalesce(sum(shipment_qty) FILTER (WHERE shipment_type = '정상'), 0)::float8 AS normal,
              coalesce(sum(shipment_qty) FILTER (WHERE shipment_type = '반품'), 0)::float8 AS returned,
              count(DISTINCT product_type)::int AS types,
              count(DISTINCT customer_name)::int AS customers
       FROM sales_records ${where(salesConds(qs, f))}`,
      qs
    ),
  ]);

  return {
    qtyA: prod.a,
    qtyC: prod.c,
    normal: sales.normal,
    returned: sales.returned,
    productTypes: sales.types,
    customers: sales.customers,
  };
}

export interface YearlyMatchedRow {
  year: number;
  production: number;
  sales: number;
}

/** 연도별 생산 vs 순판매 — 생산·판매 양쪽에 품번이 있는 "매칭 품목"만 */
export async function getYearlyMatched(f: Filters): Promise<YearlyMatchedRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  const p = where(prodConds(q, f, { ignorePeriod: true, matched: true }));
  const s = where(salesConds(q, f, { ignorePeriod: true, matched: true }));
  return run<YearlyMatchedRow>(
    `WITH p AS (
       SELECT extract(year FROM production_date)::int AS y, sum(qty_grade_a)::float8 AS v
       FROM production_records ${p} GROUP BY 1
     ), s AS (
       SELECT extract(year FROM shipment_date)::int AS y, sum(shipment_qty)::float8 AS v
       FROM sales_records ${s} GROUP BY 1
     )
     SELECT coalesce(p.y, s.y) AS year,
            coalesce(p.v, 0)::float8 AS production,
            coalesce(s.v, 0)::float8 AS sales
     FROM p FULL JOIN s ON p.y = s.y
     ORDER BY 1`,
    q
  );
}

export interface YearMonthRow {
  year: number;
  month: number;
  production: number;
  sales: number;
}

/** 5개년 월별 생산·순판매 (계절성 겹침 차트용, 연/분기/월 필터 미적용) */
export async function getMonthlyByYear(f: Filters): Promise<YearMonthRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  const p = where(prodConds(q, f, { ignorePeriod: true }));
  const s = where(salesConds(q, f, { ignorePeriod: true }));
  return run<YearMonthRow>(
    `WITH p AS (
       SELECT extract(year FROM production_date)::int AS y,
              extract(month FROM production_date)::int AS m,
              sum(qty_grade_a)::float8 AS v
       FROM production_records ${p} GROUP BY 1, 2
     ), s AS (
       SELECT extract(year FROM shipment_date)::int AS y,
              extract(month FROM shipment_date)::int AS m,
              sum(shipment_qty)::float8 AS v
       FROM sales_records ${s} GROUP BY 1, 2
     )
     SELECT coalesce(p.y, s.y) AS year, coalesce(p.m, s.m) AS month,
            coalesce(p.v, 0)::float8 AS production, coalesce(s.v, 0)::float8 AS sales
     FROM p FULL JOIN s ON p.y = s.y AND p.m = s.m
     ORDER BY 1, 2`,
    q
  );
}

export interface DeptShareRow {
  dept: string;
  qtyA: number;
  qtyC: number;
}

export async function getDeptShare(f: Filters): Promise<DeptShareRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<DeptShareRow>(
    `SELECT department_code::text AS dept,
            sum(qty_grade_a)::float8 AS "qtyA",
            sum(qty_grade_c)::float8 AS "qtyC"
     FROM production_records ${where(prodConds(q, f))}
     GROUP BY 1 ORDER BY 1`,
    q
  );
}

export interface TopRow {
  key: string;
  name: string;
  value: number;
  prev: number | null;
}

async function topSales(f: Filters, prevF: Filters | null, by: "customer" | "product", limit: number) {
  const keyExpr = by === "customer" ? "customer_name" : "product_code";
  const nameExpr = by === "customer" ? "customer_name" : "max(product_name)";

  const q = new Q();
  const conds = [...salesConds(q, f), `${keyExpr} IS NOT NULL`];
  const rows = await run<{ key: string; name: string; value: number }>(
    `SELECT ${keyExpr} AS key, ${nameExpr} AS name, sum(shipment_qty)::float8 AS value
     FROM sales_records ${where(conds)}
     GROUP BY ${keyExpr}
     ORDER BY 3 DESC
     LIMIT ${q.p(limit)}::int`,
    q
  );
  if (!prevF || rows.length === 0) return rows.map((r) => ({ ...r, prev: null }));

  const q2 = new Q();
  const conds2 = [...salesConds(q2, prevF), `${keyExpr} IN (${q2.list(rows.map((r) => r.key))})`];
  const prev = await run<{ key: string; value: number }>(
    `SELECT ${keyExpr} AS key, sum(shipment_qty)::float8 AS value
     FROM sales_records ${where(conds2)} GROUP BY 1`,
    q2
  );
  const prevMap = new Map(prev.map((r) => [r.key, r.value]));
  return rows.map((r) => ({ ...r, prev: prevMap.get(r.key) ?? null }));
}

/** 순판매 기준 TOP N 거래선 (전년 동기 값 포함) */
export async function getTopCustomers(f: Filters, prevF: Filters | null, limit = 10): Promise<TopRow[]> {
  "use cache";
  cacheLife("hours");
  return topSales(f, prevF, "customer", limit);
}

/** 순판매 기준 TOP N 품목(품번) (전년 동기 값 포함) */
export async function getTopProducts(f: Filters, prevF: Filters | null, limit = 10): Promise<TopRow[]> {
  "use cache";
  cacheLife("hours");
  return topSales(f, prevF, "product", limit);
}

export interface PrdSummaryRow {
  year: number;
  qtyAAll: number;
  qtyCAll: number;
  qtyA21: number;
  qtyC21: number;
  net: number;
  normal: number;
  returned: number;
  productTypes: number;
  customers: number;
}

/** PRD 2.5 검증용 연도별 요약 (필터 미적용, 전표 21·22·32 전체 + 전표 21 단독) */
export async function getPrdSummary(): Promise<PrdSummaryRow[]> {
  "use cache";
  cacheLife("hours");

  return run<PrdSummaryRow>(
    `WITH p AS (
       SELECT extract(year FROM production_date)::int AS y,
              sum(qty_grade_a)::float8 AS a_all,
              sum(qty_grade_c)::float8 AS c_all,
              coalesce(sum(qty_grade_a) FILTER (WHERE slip_type = '21'), 0)::float8 AS a_21,
              coalesce(sum(qty_grade_c) FILTER (WHERE slip_type = '21'), 0)::float8 AS c_21
       FROM production_records GROUP BY 1
     ), s AS (
       SELECT extract(year FROM shipment_date)::int AS y,
              sum(shipment_qty)::float8 AS net,
              coalesce(sum(shipment_qty) FILTER (WHERE shipment_type = '정상'), 0)::float8 AS normal,
              coalesce(sum(shipment_qty) FILTER (WHERE shipment_type = '반품'), 0)::float8 AS returned,
              count(DISTINCT product_type)::int AS types,
              count(DISTINCT customer_name)::int AS customers
       FROM sales_records GROUP BY 1
     )
     SELECT p.y AS year, p.a_all AS "qtyAAll", p.c_all AS "qtyCAll",
            p.a_21 AS "qtyA21", p.c_21 AS "qtyC21",
            s.net, s.normal, s.returned, s.types AS "productTypes", s.customers
     FROM p JOIN s ON p.y = s.y
     ORDER BY 1`,
    new Q()
  );
}
