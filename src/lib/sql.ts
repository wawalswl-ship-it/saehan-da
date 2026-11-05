import { client } from "@/db";
import type { Filters } from "@/lib/filters";

/** 파라미터 바인딩 수집기: 값은 항상 $n 으로만 쿼리에 들어간다 */
export class Q {
  params: (string | number)[] = [];

  p(value: string | number): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  list(values: (string | number)[]): string {
    return values.map((v) => this.p(v)).join(", ");
  }
}

/** 집계 쿼리 실행 → 직렬화 가능한 plain object 배열 */
export async function run<T>(text: string, q: Q): Promise<T[]> {
  const rows = await client.unsafe(text, q.params as never[]);
  return rows.map((r) => ({ ...r })) as unknown as T[];
}

export interface CondOptions {
  /** 연/분기/월 조건 전체 무시 (다년 추세용) */
  ignorePeriod?: boolean;
  /** 전표구분 조건 무시 (전표구분 구성 차트용) */
  ignoreSlip?: boolean;
  /** 생산·판매 양쪽에 품번이 존재하는 품목만 */
  matched?: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function periodConds(q: Q, col: string, f: Filters, o: CondOptions): string[] {
  if (o.ignorePeriod) return [];
  const conds: string[] = [];
  if (f.year !== null) {
    let fromMonth = 1;
    let toMonth = 12;
    if (f.month) {
      fromMonth = toMonth = f.month;
    } else if (f.quarter) {
      fromMonth = (f.quarter - 1) * 3 + 1;
      toMonth = fromMonth + 2;
    }
    const from = `${f.year}-${pad(fromMonth)}-01`;
    const to = toMonth === 12 ? `${f.year + 1}-01-01` : `${f.year}-${pad(toMonth + 1)}-01`;
    conds.push(`${col} >= ${q.p(from)}::date`, `${col} < ${q.p(to)}::date`);
  } else if (f.month) {
    conds.push(`extract(month from ${col}) = ${q.p(f.month)}::int`);
  } else if (f.quarter) {
    conds.push(`extract(quarter from ${col}) = ${q.p(f.quarter)}::int`);
  }
  return conds;
}

export function prodConds(q: Q, f: Filters, o: CondOptions = {}): string[] {
  const c = periodConds(q, "production_date", f, o);
  if (f.depts.length) c.push(`department_code::text IN (${q.list(f.depts)})`);
  if (!o.ignoreSlip && f.slips.length) c.push(`slip_type::text IN (${q.list(f.slips)})`);
  if (f.customers.length) c.push(`customer_name IN (${q.list(f.customers)})`);
  if (f.productTypes.length) c.push(`product_type IN (${q.list(f.productTypes)})`);
  if (f.packUnits.length) c.push(`pack_unit IN (${q.list(f.packUnits)})`);
  if (o.matched) {
    c.push(`product_code IN (SELECT product_code FROM sales_records WHERE product_code IS NOT NULL)`);
  }
  return c;
}

export function salesConds(q: Q, f: Filters, o: CondOptions = {}): string[] {
  const c = periodConds(q, "shipment_date", f, o);
  // 판매실적에는 부서 컬럼이 없어 "해당 부서가 생산한 품번"으로 연결한다
  if (f.depts.length) {
    c.push(
      `product_code IN (SELECT product_code FROM production_records WHERE department_code::text IN (${q.list(f.depts)}))`
    );
  }
  if (f.customers.length) c.push(`customer_name IN (${q.list(f.customers)})`);
  if (f.productTypes.length) c.push(`product_type IN (${q.list(f.productTypes)})`);
  if (f.packUnits.length) c.push(`pack_unit IN (${q.list(f.packUnits)})`);
  if (o.matched) {
    c.push(`product_code IN (SELECT product_code FROM production_records WHERE product_code IS NOT NULL)`);
  }
  return c;
}

export function where(conds: string[]): string {
  return conds.length ? `WHERE ${conds.join(" AND ")}` : "";
}
