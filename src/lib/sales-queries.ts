import { cacheLife } from "next/cache";
import type { Filters } from "@/lib/filters";
import { Q, run, salesConds, where } from "@/lib/sql";

export interface SalesMonthlyRow {
  ym: string;
  normal: number;
  returned: number; // 음수
  net: number;
}

/** 월별 정상/반품/순판매 */
export async function getSalesMonthly(f: Filters): Promise<SalesMonthlyRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<SalesMonthlyRow>(
    `SELECT to_char(shipment_date, 'YYYY-MM') AS ym,
            coalesce(sum(shipment_qty) FILTER (WHERE shipment_type = '정상'), 0)::float8 AS normal,
            coalesce(sum(shipment_qty) FILTER (WHERE shipment_type = '반품'), 0)::float8 AS returned,
            sum(shipment_qty)::float8 AS net
     FROM sales_records ${where(salesConds(q, f))}
     GROUP BY 1 ORDER BY 1`,
    q
  );
}

export interface ParetoRow {
  name: string;
  value: number;
}

export interface ParetoResult {
  rows: ParetoRow[];
  total: number;
  customerCount: number;
}

/** 거래선별 순판매 상위 N + 전체 합계(누적 비중 계산용) */
export async function getCustomerPareto(f: Filters, limit = 20): Promise<ParetoResult> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  const rows = await run<{ name: string; value: number; total: number; n: number }>(
    `WITH c AS (
       SELECT coalesce(customer_name, '미기재') AS name, sum(shipment_qty)::float8 AS value
       FROM sales_records ${where(salesConds(q, f))}
       GROUP BY 1
     )
     SELECT name, value,
            (SELECT coalesce(sum(value), 0) FROM c)::float8 AS total,
            (SELECT count(*) FROM c)::int AS n
     FROM c ORDER BY value DESC LIMIT ${q.p(limit)}::int`,
    q
  );
  return {
    rows: rows.map((r) => ({ name: r.name, value: r.value })),
    total: rows[0]?.total ?? 0,
    customerCount: rows[0]?.n ?? 0,
  };
}

export interface VolumeRow {
  bucket: string;
  ord: number;
  net: number;
  records: number;
}

/** 용량(ml) 구간별 순판매 */
export async function getVolumeShare(f: Filters): Promise<VolumeRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<VolumeRow>(
    `SELECT CASE
              WHEN volume IS NULL OR volume = 0 THEN '용량 없음(캡·부자재 등)'
              WHEN volume <= 300 THEN '300ml 이하'
              WHEN volume <= 500 THEN '301–500ml'
              WHEN volume <= 1000 THEN '501–1,000ml'
              WHEN volume <= 2000 THEN '1,001–2,000ml'
              ELSE '2,001ml 이상'
            END AS bucket,
            CASE
              WHEN volume IS NULL OR volume = 0 THEN 6
              WHEN volume <= 300 THEN 1
              WHEN volume <= 500 THEN 2
              WHEN volume <= 1000 THEN 3
              WHEN volume <= 2000 THEN 4
              ELSE 5
            END AS ord,
            sum(shipment_qty)::float8 AS net,
            count(*)::int AS records
     FROM sales_records ${where(salesConds(q, f))}
     GROUP BY 1, 2 ORDER BY 2`,
    q
  );
}

export interface CustomerMonthRow {
  name: string;
  month: number;
  net: number;
}

/** 순판매 상위 거래선 × 월 (전체 기간 선택 시 월은 연도 합산) */
export async function getCustomerMonth(f: Filters, topN = 15): Promise<CustomerMonthRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  const w = where([...salesConds(q, f), "customer_name IS NOT NULL"]);
  return run<CustomerMonthRow>(
    `WITH base AS (
       SELECT customer_name AS name,
              extract(month FROM shipment_date)::int AS month,
              sum(shipment_qty)::float8 AS net
       FROM sales_records ${w}
       GROUP BY 1, 2
     ), top AS (
       SELECT name FROM base GROUP BY 1 ORDER BY sum(net) DESC LIMIT ${q.p(topN)}::int
     )
     SELECT b.name, b.month, b.net FROM base b JOIN top USING (name)
     ORDER BY 1, 2`,
    q
  );
}

export interface ReturnRow {
  key: string;
  name: string;
  returned: number; // 양수(절댓값)
  normal: number;
}

async function returnsBy(f: Filters, by: "product" | "customer", limit: number) {
  const keyExpr = by === "product" ? "product_code" : "customer_name";
  const nameExpr = by === "product" ? "max(product_name)" : "customer_name";
  const q = new Q();
  return run<ReturnRow>(
    `SELECT ${keyExpr} AS key, ${nameExpr} AS name,
            abs(coalesce(sum(shipment_qty) FILTER (WHERE shipment_type = '반품'), 0))::float8 AS returned,
            coalesce(sum(shipment_qty) FILTER (WHERE shipment_type = '정상'), 0)::float8 AS normal
     FROM sales_records ${where([...salesConds(q, f), `${keyExpr} IS NOT NULL`])}
     GROUP BY ${keyExpr}
     HAVING coalesce(sum(shipment_qty) FILTER (WHERE shipment_type = '반품'), 0) < 0
     ORDER BY 3 DESC
     LIMIT ${q.p(limit)}::int`,
    q
  );
}

export async function getReturnTopProducts(f: Filters, limit = 10): Promise<ReturnRow[]> {
  "use cache";
  cacheLife("hours");
  return returnsBy(f, "product", limit);
}

export async function getReturnTopCustomers(f: Filters, limit = 10): Promise<ReturnRow[]> {
  "use cache";
  cacheLife("hours");
  return returnsBy(f, "customer", limit);
}
