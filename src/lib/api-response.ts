import { NextResponse } from "next/server";
import { parseFilters, searchParamsToRaw, type Filters } from "@/lib/filters";

// 모든 API 응답은 { data, error, meta } 형식
export function apiOk<T>(data: T, meta: Record<string, unknown> = {}) {
  return NextResponse.json({ data, error: null, meta });
}

export function apiFail(message: string, status = 500, meta: Record<string, unknown> = {}) {
  return NextResponse.json({ data: null, error: message, meta }, { status });
}

export function pageParams(searchParams: URLSearchParams, defaultSize = 20, maxSize = 100) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    maxSize,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? String(defaultSize), 10) || defaultSize)
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** 요청 URL의 공통 필터 쿼리를 Filters 로 변환 */
export function filtersFromRequest(request: Request): { filters: Filters; searchParams: URLSearchParams } {
  const { searchParams } = new URL(request.url);
  return { filters: parseFilters(searchParamsToRaw(searchParams)), searchParams };
}
