"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { downloadCsv, formatCell, type TableColumn, type TableRow } from "@/lib/table-data";
import { EmptyState } from "./empty-state";

interface PagedTableProps {
  /** page·pageSize 를 제외한 API 경로 (쿼리스트링 포함 가능) */
  endpoint: string;
  columns: TableColumn[];
  rowKey: string;
  pageSize?: number;
  csvName: string;
  caption: string;
  selectedKey?: string | null;
  onRowClick?: (row: TableRow) => void;
  emptyText?: string;
}

interface Loaded {
  requestKey: string;
  rows: TableRow[];
  total: number;
  error: string | null;
}

const EXPORT_LIMIT = 1000;

function withParams(endpoint: string, page: number, pageSize: number): string {
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${page}&pageSize=${pageSize}`;
}

/** 서버 페이지네이션 표: 집계 결과만 페이지 단위로 받아 온다 */
export function PagedTable({
  endpoint,
  columns,
  rowKey,
  pageSize = 10,
  csvName,
  caption,
  selectedKey,
  onRowClick,
  emptyText,
}: PagedTableProps) {
  const [pageState, setPageState] = useState({ endpoint, page: 1 });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [exporting, setExporting] = useState(false);

  // 조건(endpoint)이 바뀌면 1페이지로 돌아간다
  const page = pageState.endpoint === endpoint ? pageState.page : 1;
  const requestKey = withParams(endpoint, page, pageSize);
  const loading = loaded?.requestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    fetch(requestKey)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setLoaded({
          requestKey,
          rows: (json.data as TableRow[] | null) ?? [],
          total: Number(json.meta?.total ?? 0),
          error: json.error ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ requestKey, rows: [], total: 0, error: "데이터를 불러오지 못했습니다." });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch(withParams(endpoint, 1, EXPORT_LIMIT));
      const json = await res.json();
      downloadCsv(csvName, { columns, rows: (json.data as TableRow[] | null) ?? [] });
    } finally {
      setExporting(false);
    }
  }

  const total = loaded?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rows = loaded?.rows ?? [];

  if (!loaded) {
    return (
      <div className="space-y-2" role="status" aria-label="표를 불러오는 중">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-8 w-full" />
        ))}
      </div>
    );
  }
  if (loaded.error) return <EmptyState text={loaded.error} />;
  if (!loading && rows.length === 0) return <EmptyState text={emptyText} />;

  return (
    <div>
      <div className={`overflow-x-auto rounded-lg border border-border transition-opacity ${loading ? "opacity-60" : ""}`}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground ${
                    c.format && c.format !== "text" ? "text-right" : "text-left"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = String(row[rowKey]);
              const selected = selectedKey === key;
              return (
                <tr
                  key={key}
                  className={`border-t border-border ${selected ? "bg-brand-navy-soft" : "hover:bg-muted/40"}`}
                >
                  {columns.map((c, i) => {
                    const text = formatCell(row[c.key], c.format);
                    const numeric = c.format && c.format !== "text";
                    return (
                      <td
                        key={c.key}
                        className={`px-3 py-1.5 ${numeric ? "whitespace-nowrap text-right tabular-nums" : "max-w-64 truncate text-left"}`}
                        title={numeric ? undefined : text}
                      >
                        {i === 0 && onRowClick ? (
                          <button
                            type="button"
                            onClick={() => onRowClick(row)}
                            aria-pressed={selected}
                            className="max-w-full truncate text-left font-medium text-brand-navy underline decoration-brand-navy/30 underline-offset-2 hover:decoration-brand-navy"
                          >
                            {text}
                          </button>
                        ) : (
                          text
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          총 {total.toLocaleString("ko-KR")}건 · {page} / {pageCount} 페이지
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-white px-2 hover:bg-muted disabled:opacity-50"
          >
            <Download className="size-3.5" aria-hidden />
            {exporting ? "내보내는 중…" : `CSV (최대 ${EXPORT_LIMIT.toLocaleString("ko-KR")}건)`}
          </button>
          <button
            type="button"
            onClick={() => setPageState({ endpoint, page: page - 1 })}
            disabled={page <= 1 || loading}
            aria-label="이전 페이지"
            className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-white hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPageState({ endpoint, page: page + 1 })}
            disabled={page >= pageCount || loading}
            aria-label="다음 페이지"
            className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-white hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
