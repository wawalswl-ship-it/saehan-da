"use client";

import { useState, type ReactNode } from "react";
import { BarChart3, Download, Table2 } from "lucide-react";
import { downloadCsv, type TableData } from "@/lib/table-data";
import { DataTable } from "./data-table";
import { EmptyState } from "./empty-state";

interface ChartCardProps {
  title: string;
  description?: string;
  /** 집계 기준 배지 (예: "매칭 품목 기준") */
  badges?: string[];
  /** 차트 아래 주석 */
  note?: ReactNode;
  /** 표 보기 + CSV 다운로드에 쓰는 데이터 */
  table?: TableData;
  csvName?: string;
  /** 본문이 이미 표인 카드는 표 보기 전환을 숨긴다 */
  tableToggle?: boolean;
  emptyText?: string;
  className?: string;
  children: ReactNode;
}

/** 흰 카드(라운드 12px·옅은 보더) + 표 보기 전환 + CSV 다운로드 */
export function ChartCard({
  title,
  description,
  badges,
  note,
  table,
  csvName,
  tableToggle = true,
  emptyText,
  className = "",
  children,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const isEmpty = table !== undefined && table.rows.length === 0;

  return (
    <section
      className={`flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-snug">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          {badges && badges.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {badges.map((b) => (
                <span
                  key={b}
                  className="rounded border border-brand-navy-mid/30 bg-brand-navy-soft px-1.5 py-0.5 text-[11px] font-medium text-brand-navy-dark"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
        {table && !isEmpty && (
          <div className="flex shrink-0 items-center gap-1">
            {tableToggle && (<button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              title={showTable ? "차트 보기" : "표 보기"}
              aria-label={`${title} ${showTable ? "차트 보기" : "표 보기"}`}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {showTable ? <BarChart3 className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
            </button>)}
            <button
              type="button"
              onClick={() => downloadCsv(csvName ?? title, table)}
              title="CSV 다운로드"
              aria-label={`${title} CSV 다운로드`}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Download className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </header>

      <div className="min-w-0 flex-1">
        {isEmpty ? (
          <EmptyState text={emptyText} />
        ) : showTable && table ? (
          <DataTable table={table} />
        ) : (
          children
        )}
      </div>

      {note && <div className="mt-3 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">{note}</div>}
    </section>
  );
}
