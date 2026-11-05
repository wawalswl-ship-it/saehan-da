import { client } from "@/db";
import { parseFilters, searchParamsToRaw } from "@/lib/filters";
import { Q, prodConds, salesConds } from "@/lib/sql";

// 사용 가능한 차원 정의
export const PRODUCTION_DIMENSIONS = {
  year: { label: "연도", expr: `extract(year from production_date)::int` },
  quarter: { label: "분기", expr: `'Q' || extract(quarter from production_date)::int` },
  month: { label: "월", expr: `extract(month from production_date)::int` },
  department: { label: "부서", expr: `department_code` },
  work_shift: { label: "작업조", expr: `work_shift` },
  machine_no: { label: "생산호기", expr: `machine_no` },
  product_type: { label: "품종", expr: `product_type` },
  customer_name: { label: "거래선", expr: `customer_name` },
  slip_type: { label: "전표구분", expr: `slip_type_name` },
  pack_unit: { label: "포장단위", expr: `pack_unit` },
} as const;

export const SALES_DIMENSIONS = {
  year: { label: "연도", expr: `extract(year from shipment_date)::int` },
  quarter: { label: "분기", expr: `'Q' || extract(quarter from shipment_date)::int` },
  month: { label: "월", expr: `extract(month from shipment_date)::int` },
  shipment_type: { label: "출고구분", expr: `shipment_type` },
  sales_type: { label: "판매형태", expr: `sales_type` },
  product_type: { label: "품종", expr: `product_type` },
  customer_name: { label: "거래선", expr: `customer_name` },
  volume_range: {
    label: "용량대",
    expr: `CASE WHEN volume <= 500 THEN '~500ml' WHEN volume <= 1000 THEN '501~1000ml' WHEN volume <= 2000 THEN '1001~2000ml' ELSE '2001ml~' END`,
  },
  pack_unit: { label: "포장단위", expr: `pack_unit` },
} as const;

export const PRODUCTION_MEASURES = {
  qty_grade_a: { label: "생산량(A급)", expr: `sum(qty_grade_a)::bigint` },
  qty_grade_c: { label: "불량(C급)", expr: `sum(qty_grade_c)::bigint` },
  defect_rate: {
    label: "불량률(%)",
    expr: `round(sum(qty_grade_c)::numeric / nullif(sum(qty_grade_a) + sum(qty_grade_c), 0) * 100, 2)`,
  },
  row_count: { label: "건수", expr: `count(*)::int` },
} as const;

export const SALES_MEASURES = {
  shipment_qty: { label: "출고수량", expr: `sum(shipment_qty)::bigint` },
  normal_qty: {
    label: "정상출고",
    expr: `sum(case when shipment_type = '정상' then shipment_qty else 0 end)::bigint`,
  },
  return_qty: {
    label: "반품",
    expr: `sum(case when shipment_type = '반품' then shipment_qty else 0 end)::bigint`,
  },
  row_count: { label: "건수", expr: `count(*)::int` },
} as const;

export type ProductionDimKey = keyof typeof PRODUCTION_DIMENSIONS;
export type SalesDimKey = keyof typeof SALES_DIMENSIONS;
export type ProductionMeasureKey = keyof typeof PRODUCTION_MEASURES;
export type SalesMeasureKey = keyof typeof SALES_MEASURES;

interface AnalysisParams {
  dataset: "production" | "sales";
  rows: string[];    // row dimensions
  columns: string[]; // column dimension (single for pivot)
  measures: string[];
  filters?: Record<string, string[]>;
  /** 상단 공통 필터의 쿼리스트링. null/undefined 면 미적용 */
  globalQuery?: string | null;
}

export async function runAnalysis(params: AnalysisParams) {
  const { dataset, rows, columns, measures, filters, globalQuery } = params;

  const dims = dataset === "production" ? PRODUCTION_DIMENSIONS : SALES_DIMENSIONS;
  const meas = dataset === "production" ? PRODUCTION_MEASURES : SALES_MEASURES;
  const table = dataset === "production" ? "production_records" : "sales_records";

  // Validate dimensions and measures
  const allDimKeys = [...rows, ...columns];
  for (const d of allDimKeys) {
    if (!(d in dims)) throw new Error(`Invalid dimension: ${d}`);
  }
  for (const m of measures) {
    if (!(m in meas)) throw new Error(`Invalid measure: ${m}`);
  }

  // Build SELECT
  const selectParts: string[] = [];
  const groupParts: string[] = [];

  for (const d of allDimKeys) {
    const dim = dims[d as keyof typeof dims];
    selectParts.push(`${dim.expr} as "${d}"`);
    groupParts.push(dim.expr);
  }

  for (const m of measures) {
    const measure = meas[m as keyof typeof meas];
    selectParts.push(`${measure.expr} as "${m}"`);
  }

  // Build WHERE
  const whereParts: string[] = [];
  if (filters) {
    for (const [key, values] of Object.entries(filters)) {
      if (values.length === 0) continue;
      if (!(key in dims)) continue;
      const dim = dims[key as keyof typeof dims];
      const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
      whereParts.push(`${dim.expr} IN (${escaped})`);
    }
  }

  // 상단 공통 필터 (선택 적용): 값은 모두 $n 파라미터로 바인딩
  const q = new Q();
  if (typeof globalQuery === "string") {
    const global = parseFilters(searchParamsToRaw(new URLSearchParams(globalQuery)));
    whereParts.push(...(dataset === "production" ? prodConds(q, global) : salesConds(q, global)));
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  // Build ORDER BY
  const orderParts = allDimKeys.map((d) => {
    const dim = dims[d as keyof typeof dims];
    return dim.expr;
  });

  const query = `
    SELECT ${selectParts.join(", ")}
    FROM ${table}
    ${whereClause}
    GROUP BY ${groupParts.join(", ")}
    ORDER BY ${orderParts.join(", ")}
    LIMIT 5000
  `;

  const resultRows = await client.unsafe(query, q.params as never[]);
  return {
    rows: resultRows as Record<string, unknown>[],
    query,
    totalRows: resultRows.length,
  };
}

// 차원별 값 목록 조회 (필터용)
export async function getDimensionValues(
  dataset: "production" | "sales",
  dimension: string
) {
  const dims = dataset === "production" ? PRODUCTION_DIMENSIONS : SALES_DIMENSIONS;
  if (!(dimension in dims)) throw new Error(`Invalid dimension: ${dimension}`);

  const dim = dims[dimension as keyof typeof dims];
  const table = dataset === "production" ? "production_records" : "sales_records";

  const query = `
    SELECT DISTINCT ${dim.expr} as value, count(*)::int as cnt
    FROM ${table}
    WHERE ${dim.expr} IS NOT NULL
    GROUP BY ${dim.expr}
    ORDER BY cnt DESC
    LIMIT 200
  `;

  const rows = await client.unsafe(query);
  return rows as Record<string, unknown>[];
}
