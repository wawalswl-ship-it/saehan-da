import { cacheLife } from "next/cache";
import { Q, run } from "@/lib/sql";

export type FilterOptionKind = "customer" | "productType" | "packUnit";

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

const COLUMN: Record<FilterOptionKind, string> = {
  customer: "customer_name",
  productType: "product_type",
  packUnit: "pack_unit",
};

/** 필터 선택지 — 생산·판매 양쪽 값을 합쳐 건수 내림차순 */
export async function getFilterOptions(kind: FilterOptionKind): Promise<FilterOption[]> {
  "use cache";
  cacheLife("hours");

  const col = COLUMN[kind];
  // 품종은 코드만으로는 알아보기 어려워 대표 품명을 함께 보여준다
  const hint = kind === "productType" ? "max(product_name)" : "NULL::text";
  const rows = await run<{ value: string; hint: string | null; count: number }>(
    `SELECT value, max(hint) AS hint, sum(n)::int AS count
     FROM (
       SELECT ${col} AS value, ${hint} AS hint, count(*) AS n
       FROM production_records WHERE ${col} IS NOT NULL GROUP BY 1
       UNION ALL
       SELECT ${col} AS value, ${hint} AS hint, count(*) AS n
       FROM sales_records WHERE ${col} IS NOT NULL GROUP BY 1
     ) u
     GROUP BY 1
     ORDER BY 3 DESC, 1
     LIMIT 1000`,
    new Q()
  );
  return rows.map((r) => ({
    value: r.value,
    label: r.hint ? `${r.value} · ${r.hint.trim()}` : r.value,
    count: r.count,
  }));
}
