"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Link2, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  DEPT_CODES,
  FILTER_KEYS,
  SLIP_CODES,
  SLIP_LABELS,
  YEARS,
  activeFilterCount,
  filtersToQuery,
  parseFilters,
  periodLabel,
  searchParamsToRaw,
  type Filters,
} from "@/lib/filters";
import { DEPT_COLORS, DEPT_NAMES } from "@/lib/format";
import { MultiSelect } from "./multi-select";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-white px-2 text-sm text-foreground md:w-auto";

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors ${
        pressed
          ? "border-brand-navy bg-brand-navy-soft font-semibold text-brand-navy-dark"
          : "border-input bg-white text-foreground hover:bg-muted"
      }`}
    >
      {pressed && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/** 모든 페이지 공통 필터. 상태는 URL 쿼리스트링에만 저장한다 */
export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const filters = parseFilters(searchParamsToRaw(searchParams));
  const activeCount = activeFilterCount(filters);

  // 재조회 중에는 이전 화면을 흐리게 유지 (스켈레톤 깜빡임 방지)
  useEffect(() => {
    document.body.dataset.pending = isPending ? "true" : "false";
    return () => {
      document.body.dataset.pending = "false";
    };
  }, [isPending]);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    // 공통 필터 외의 쿼리(tab 등)는 그대로 둔다
    const usp = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (!(FILTER_KEYS as readonly string[]).includes(key)) usp.append(key, value);
    }
    const filterQuery = filtersToQuery(next);
    const rest = usp.toString();
    const qs = [filterQuery, rest].filter(Boolean).join("&");
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function toggleIn(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (pathname === "/login") return null;

  return (
    <section aria-label="공통 필터" className="border-b border-border bg-white">
      <div
        className={`h-0.5 bg-brand-navy-mid transition-opacity ${isPending ? "animate-pulse opacity-100" : "opacity-0"}`}
        aria-hidden
      />
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
        {/* 모바일: 접힌 상태 요약 */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="filter-panel"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            필터
            {activeCount > 0 && (
              <span className="rounded-full bg-brand-navy px-1.5 text-xs text-white">{activeCount}</span>
            )}
          </button>
          <span className="truncate text-sm text-muted-foreground">{periodLabel(filters)}</span>
        </div>

        <div
          id="filter-panel"
          className={`${expanded ? "mt-3 flex" : "hidden"} flex-col gap-3 md:mt-0 md:flex md:flex-row md:flex-wrap md:items-end md:gap-x-4 md:gap-y-2`}
        >
          <Group label="기간">
            <label className="sr-only" htmlFor="filter-year">연도</label>
            <select
              id="filter-year"
              className={selectClass}
              value={filters.year === null ? "all" : String(filters.year)}
              onChange={(e) => update({ year: e.target.value === "all" ? null : Number(e.target.value) })}
            >
              {[...YEARS].reverse().map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
              <option value="all">전체 기간</option>
            </select>
            <label className="sr-only" htmlFor="filter-quarter">분기</label>
            <select
              id="filter-quarter"
              className={selectClass}
              value={filters.quarter ?? ""}
              onChange={(e) => update({ quarter: e.target.value ? Number(e.target.value) : null, month: null })}
            >
              <option value="">분기 전체</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}분기</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="filter-month">월</label>
            <select
              id="filter-month"
              className={selectClass}
              value={filters.month ?? ""}
              onChange={(e) => update({ month: e.target.value ? Number(e.target.value) : null, quarter: null })}
            >
              <option value="">월 전체</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}월</option>
              ))}
            </select>
          </Group>

          <Group label="부서">
            {DEPT_CODES.map((code) => (
              <Chip
                key={code}
                pressed={filters.depts.includes(code)}
                onClick={() => update({ depts: toggleIn(filters.depts, code) })}
              >
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: DEPT_COLORS[code] }} aria-hidden />
                {DEPT_NAMES[code]}
              </Chip>
            ))}
          </Group>

          <Group label="전표구분(생산)">
            {SLIP_CODES.map((code) => (
              <Chip
                key={code}
                pressed={filters.slips.includes(code)}
                onClick={() => update({ slips: toggleIn(filters.slips, code) })}
              >
                {SLIP_LABELS[code]}
              </Chip>
            ))}
          </Group>

          <Group label="거래선 · 품종 · 포장단위">
            <MultiSelect
              label="거래선"
              kind="customer"
              selected={filters.customers}
              onApply={(v) => update({ customers: [...v].sort() })}
            />
            <MultiSelect
              label="품종"
              kind="productType"
              selected={filters.productTypes}
              onApply={(v) => update({ productTypes: [...v].sort() })}
            />
            <MultiSelect
              label="포장단위"
              kind="packUnit"
              selected={filters.packUnits}
              onApply={(v) => update({ packUnits: [...v].sort() })}
              searchable={false}
            />
          </Group>

          <div className="flex items-center gap-1.5 md:ml-auto">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-2.5 text-sm hover:bg-muted"
            >
              {copied ? <Check className="size-4 text-status-good" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
              <span aria-live="polite">{copied ? "링크 복사됨" : "링크 복사"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const usp = new URLSearchParams();
                for (const [key, value] of searchParams.entries()) {
                  if (!(FILTER_KEYS as readonly string[]).includes(key)) usp.append(key, value);
                }
                const rest = usp.toString();
                startTransition(() => router.push(rest ? `${pathname}?${rest}` : pathname, { scroll: false }));
              }}
              disabled={activeCount === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-2.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              <RotateCcw className="size-4" aria-hidden />
              초기화
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FilterBarFallback() {
  return (
    <div className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="skeleton h-9 w-24" />
        <div className="skeleton hidden h-9 w-64 md:block" />
        <div className="skeleton hidden h-9 w-64 md:block" />
      </div>
    </div>
  );
}
