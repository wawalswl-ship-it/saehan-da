import { cacheLife } from "next/cache";
import type { Filters } from "@/lib/filters";
import { Q, prodConds, run, where } from "@/lib/sql";

export interface DeptMonthlyRow {
  ym: string;
  dept: string;
  qtyA: number;
}

/** 부서별 월별 생산량(A급) — 누적 막대용 */
export async function getDeptMonthly(f: Filters): Promise<DeptMonthlyRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<DeptMonthlyRow>(
    `SELECT to_char(production_date, 'YYYY-MM') AS ym,
            department_code::text AS dept,
            sum(qty_grade_a)::float8 AS "qtyA"
     FROM production_records ${where(prodConds(q, f))}
     GROUP BY 1, 2 ORDER BY 1, 2`,
    q
  );
}

export interface MachineMonthRow {
  dept: string;
  machine: string;
  month: number;
  qtyA: number;
  qtyC: number;
}

/** 호기 × 월 생산량·불량 (전체 기간 선택 시 월은 연도 합산) */
export async function getMachineMonth(f: Filters): Promise<MachineMonthRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<MachineMonthRow>(
    `SELECT department_code::text AS dept,
            coalesce(machine_no, '미기재') AS machine,
            extract(month FROM production_date)::int AS month,
            sum(qty_grade_a)::float8 AS "qtyA",
            sum(qty_grade_c)::float8 AS "qtyC"
     FROM production_records ${where(prodConds(q, f))}
     GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`,
    q
  );
}

export interface ShiftRow {
  shift: string;
  dept: string;
  qtyA: number;
  qtyC: number;
  records: number;
}

/** 작업조 × 부서 생산량·불량 */
export async function getShiftStats(f: Filters): Promise<ShiftRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<ShiftRow>(
    `SELECT coalesce(work_shift, '미기재') AS shift,
            department_code::text AS dept,
            sum(qty_grade_a)::float8 AS "qtyA",
            sum(qty_grade_c)::float8 AS "qtyC",
            count(*)::int AS records
     FROM production_records ${where(prodConds(q, f))}
     GROUP BY 1, 2 ORDER BY 1, 2`,
    q
  );
}

export interface SlipRow {
  slip: string;
  qtyA: number;
  qtyC: number;
  records: number;
}

/** 전표구분 구성 — 전표구분 필터와 무관하게 21·22·32 전부 */
export async function getSlipComposition(f: Filters): Promise<SlipRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<SlipRow>(
    `SELECT coalesce(slip_type_name, '미기재') AS slip,
            sum(qty_grade_a)::float8 AS "qtyA",
            sum(qty_grade_c)::float8 AS "qtyC",
            count(*)::int AS records
     FROM production_records ${where(prodConds(q, f, { ignoreSlip: true }))}
     GROUP BY 1 ORDER BY 1`,
    q
  );
}
