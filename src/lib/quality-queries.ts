import { cacheLife } from "next/cache";
import type { Filters } from "@/lib/filters";
import { Q, prodConds, run, where } from "@/lib/sql";

export interface DefectMonthlyRow {
  ym: string;
  dept: string;
  qtyA: number;
  qtyC: number;
}

/** 월별·부서별 A급/C급 — 관리한계 기준선 계산을 위해 항상 전체 기간(2021–2025) */
export async function getDefectMonthly(f: Filters): Promise<DefectMonthlyRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<DefectMonthlyRow>(
    `SELECT to_char(production_date, 'YYYY-MM') AS ym,
            department_code::text AS dept,
            sum(qty_grade_a)::float8 AS "qtyA",
            sum(qty_grade_c)::float8 AS "qtyC"
     FROM production_records ${where(prodConds(q, f, { ignorePeriod: true }))}
     GROUP BY 1, 2 ORDER BY 1, 2`,
    q
  );
}

export type DefectGroupBy = "product" | "machine" | "shift";

export interface DefectRankRow {
  key: string;
  label: string;
  sub: string | null;
  qtyA: number;
  qtyC: number;
  rate: number;
}

const GROUPS: Record<DefectGroupBy, { key: string; label: string; sub: string; groupBy: string }> = {
  product: {
    key: "coalesce(product_code, '미기재')",
    label: "max(product_name)",
    sub: "max(customer_name)",
    groupBy: "product_code",
  },
  machine: {
    key: "department_code::text || '-' || coalesce(machine_no, '미기재')",
    label: "department_code::text || ' · ' || coalesce(machine_no, '미기재') || '호기'",
    sub: "max(department_name)",
    groupBy: "department_code, machine_no",
  },
  shift: {
    key: "coalesce(work_shift, '미기재')",
    label: "coalesce(work_shift, '미기재')",
    sub: "NULL::text",
    groupBy: "work_shift",
  },
};

/** 불량률 상위 (품목/호기/작업조) — 페이지네이션, 최소 생산량 기준 적용 */
export async function getDefectRanking(
  f: Filters,
  groupBy: DefectGroupBy,
  minQty: number,
  limit: number,
  offset: number
): Promise<{ rows: DefectRankRow[]; total: number }> {
  "use cache";
  cacheLife("hours");

  const g = GROUPS[groupBy];
  const q = new Q();
  const w = where(prodConds(q, f));
  const rows = await run<DefectRankRow & { total: number }>(
    `SELECT key, label, sub, "qtyA", "qtyC", rate, count(*) OVER ()::int AS total
     FROM (
       SELECT ${g.key} AS key, ${g.label} AS label, ${g.sub} AS sub,
              sum(qty_grade_a)::float8 AS "qtyA",
              sum(qty_grade_c)::float8 AS "qtyC",
              (sum(qty_grade_c)::float8 / nullif(sum(qty_grade_a) + sum(qty_grade_c), 0) * 100)::float8 AS rate
       FROM production_records ${w}
       GROUP BY ${g.groupBy}
       HAVING sum(qty_grade_a) + sum(qty_grade_c) >= ${q.p(minQty)}::bigint
     ) t
     ORDER BY rate DESC NULLS LAST, "qtyC" DESC, key
     LIMIT ${q.p(limit)}::int OFFSET ${q.p(offset)}::int`,
    q
  );
  return {
    rows: rows.map((r) => ({ key: r.key, label: r.label, sub: r.sub, qtyA: r.qtyA, qtyC: r.qtyC, rate: r.rate })),
    total: rows[0]?.total ?? 0,
  };
}

export interface DefectHistoryRow {
  ym: string;
  dept: string;
  machine: string;
  shift: string;
  qtyA: number;
  qtyC: number;
}

/** 품목(품번) 불량 이력 — 월 × 부서 × 호기 × 작업조 (CSV 내보내기용, 전체 기간) */
export async function getProductDefectHistory(
  f: Filters,
  productCode: string
): Promise<{ name: string | null; rows: DefectHistoryRow[] }> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  const conds = [
    ...prodConds(q, { ...f, customers: [], productTypes: [], packUnits: [] }, { ignorePeriod: true }),
    `product_code = ${q.p(productCode)}`,
  ];
  const rows = await run<DefectHistoryRow & { name: string | null }>(
    `SELECT to_char(production_date, 'YYYY-MM') AS ym,
            department_code::text AS dept,
            coalesce(machine_no, '미기재') AS machine,
            coalesce(work_shift, '미기재') AS shift,
            max(product_name) AS name,
            sum(qty_grade_a)::float8 AS "qtyA",
            sum(qty_grade_c)::float8 AS "qtyC"
     FROM production_records ${where(conds)}
     GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4
     LIMIT 5000`,
    q
  );
  return {
    name: rows[0]?.name ?? null,
    rows: rows.map((r) => ({ ym: r.ym, dept: r.dept, machine: r.machine, shift: r.shift, qtyA: r.qtyA, qtyC: r.qtyC })),
  };
}
