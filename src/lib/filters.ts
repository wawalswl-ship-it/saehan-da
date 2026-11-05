// 공통 필터: URL 쿼리스트링 ↔ Filters 변환 (서버·클라이언트 공용, DB 의존 없음)

export const YEARS = [2021, 2022, 2023, 2024, 2025] as const;
export const FIRST_YEAR = 2021;
export const LATEST_YEAR = 2025;
export const DATA_PERIOD_LABEL = "2021.01–2025.12";

export const DEPT_CODES = ["1211", "1212", "1219"] as const;
export const SLIP_CODES = ["21", "22", "32"] as const;
/** 생산 집계 기본 전표구분: 21 본가공입고 (22·32는 필터로 포함 선택) */
export const DEFAULT_SLIPS: string[] = ["21"];

export const SLIP_LABELS: Record<string, string> = {
  "21": "21 본가공입고",
  "22": "22 재가공입고",
  "32": "32 재가공투입",
};

export interface Filters {
  /** null = 전체 기간(2021–2025) */
  year: number | null;
  quarter: number | null;
  month: number | null;
  depts: string[];
  slips: string[];
  customers: string[];
  productTypes: string[];
  packUnits: string[];
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** 공통 필터가 쓰는 쿼리 키 (페이지 이동 시 유지) */
export const FILTER_KEYS = ["year", "q", "m", "dept", "slip", "cust", "type", "pack"] as const;

function toList(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  const arr = Array.isArray(v) ? v : [v];
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))].sort();
}

function toIntIn(v: string | string[] | undefined, min: number, max: number): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function parseFilters(sp: RawSearchParams): Filters {
  const rawYear = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  const year = rawYear === "all" ? null : (toIntIn(sp.year, FIRST_YEAR, LATEST_YEAR) ?? LATEST_YEAR);
  const month = toIntIn(sp.m, 1, 12);
  // 월이 지정되면 분기는 무시
  const quarter = month ? null : toIntIn(sp.q, 1, 4);
  const depts = toList(sp.dept).filter((d) => (DEPT_CODES as readonly string[]).includes(d));
  const slips = toList(sp.slip).filter((s) => (SLIP_CODES as readonly string[]).includes(s));
  return {
    year,
    quarter,
    month,
    depts,
    slips: slips.length > 0 ? slips : [...DEFAULT_SLIPS],
    customers: toList(sp.cust).slice(0, 50),
    productTypes: toList(sp.type).slice(0, 50),
    packUnits: toList(sp.pack).slice(0, 20),
  };
}

export function searchParamsToRaw(usp: URLSearchParams): RawSearchParams {
  const raw: RawSearchParams = {};
  for (const key of new Set(usp.keys())) {
    const all = usp.getAll(key);
    raw[key] = all.length > 1 ? all : all[0];
  }
  return raw;
}

function isDefaultSlips(slips: string[]): boolean {
  return slips.length === DEFAULT_SLIPS.length && slips.every((s) => DEFAULT_SLIPS.includes(s));
}

/** 기본값은 생략한 정규화 쿼리스트링 (앞의 ? 없음) */
export function filtersToQuery(f: Filters): string {
  const usp = new URLSearchParams();
  if (f.year === null) usp.set("year", "all");
  else if (f.year !== LATEST_YEAR) usp.set("year", String(f.year));
  if (f.month) usp.set("m", String(f.month));
  else if (f.quarter) usp.set("q", String(f.quarter));
  for (const d of f.depts) usp.append("dept", d);
  if (!isDefaultSlips(f.slips)) for (const s of f.slips) usp.append("slip", s);
  for (const c of f.customers) usp.append("cust", c);
  for (const t of f.productTypes) usp.append("type", t);
  for (const p of f.packUnits) usp.append("pack", p);
  return usp.toString();
}

export function periodLabel(f: Filters): string {
  const y = f.year === null ? "전체 기간(2021–2025)" : `${f.year}년`;
  if (f.month) return `${y} ${f.month}월`;
  if (f.quarter) return `${y} ${f.quarter}분기`;
  return y;
}

export function slipLabel(f: Filters): string {
  if (f.slips.length === SLIP_CODES.length) return "전표 21·22·32 전체";
  return `전표 ${f.slips.join("·")}`;
}

/** 전년 동기 필터. 비교 불가(전체 기간·첫 해)면 null */
export function prevYearFilters(f: Filters): Filters | null {
  if (f.year === null || f.year <= FIRST_YEAR) return null;
  return { ...f, year: f.year - 1 };
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.year !== LATEST_YEAR ? 1 : 0) +
    (f.quarter || f.month ? 1 : 0) +
    (f.depts.length ? 1 : 0) +
    (isDefaultSlips(f.slips) ? 0 : 1) +
    (f.customers.length ? 1 : 0) +
    (f.productTypes.length ? 1 : 0) +
    (f.packUnits.length ? 1 : 0)
  );
}
