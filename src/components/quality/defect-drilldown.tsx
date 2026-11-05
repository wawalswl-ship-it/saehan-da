"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { ComboChart } from "@/components/charts/combo-chart";
import { EmptyState } from "@/components/kit/empty-state";
import { PagedTable } from "@/components/kit/paged-table";
import { DEPT_NAMES, STATUS_COLORS, formatFullNumber } from "@/lib/format";
import { downloadCsv, type TableColumn, type TableData } from "@/lib/table-data";

type GroupBy = "product" | "machine" | "shift";

const GROUP_TABS: { key: GroupBy; label: string }[] = [
  { key: "product", label: "품목" },
  { key: "machine", label: "호기" },
  { key: "shift", label: "작업조" },
];

const MIN_QTY_OPTIONS = [
  { value: 0, label: "제한 없음" },
  { value: 10000, label: "1만 개 이상" },
  { value: 50000, label: "5만 개 이상" },
  { value: 100000, label: "10만 개 이상" },
];

const COLUMNS: Record<GroupBy, TableColumn[]> = {
  product: [
    { key: "label", label: "품목" },
    { key: "key", label: "품번" },
    { key: "sub", label: "거래선" },
    { key: "qtyA", label: "A급(개)", format: "int" },
    { key: "qtyC", label: "C급(개)", format: "int" },
    { key: "rate", label: "불량률(%)", format: "pct" },
  ],
  machine: [
    { key: "label", label: "부서 · 호기" },
    { key: "sub", label: "부서명" },
    { key: "qtyA", label: "A급(개)", format: "int" },
    { key: "qtyC", label: "C급(개)", format: "int" },
    { key: "rate", label: "불량률(%)", format: "pct" },
  ],
  shift: [
    { key: "label", label: "작업조" },
    { key: "qtyA", label: "A급(개)", format: "int" },
    { key: "qtyC", label: "C급(개)", format: "int" },
    { key: "rate", label: "불량률(%)", format: "pct" },
  ],
};

interface HistoryRow {
  ym: string;
  dept: string;
  machine: string;
  shift: string;
  qtyA: number;
  qtyC: number;
}

interface History {
  code: string;
  name: string | null;
  rows: HistoryRow[];
  error: string | null;
}

const HISTORY_COLUMNS: TableColumn[] = [
  { key: "ym", label: "연월" },
  { key: "dept", label: "부서" },
  { key: "machine", label: "호기" },
  { key: "shift", label: "작업조" },
  { key: "qtyA", label: "A급(개)", format: "int" },
  { key: "qtyC", label: "C급(개)", format: "int" },
  { key: "rate", label: "불량률(%)", format: "pct" },
];

function rate(a: number, c: number): number | null {
  return a + c > 0 ? (c / (a + c)) * 100 : null;
}

/** 불량률 상위 품목/호기/작업조 → 품목 선택 시 월별 불량 이력과 CSV 내보내기 */
export function DefectDrilldown({ filterQuery }: { filterQuery: string }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("product");
  const [minQty, setMinQty] = useState(50000);
  const [selected, setSelected] = useState<{ code: string; label: string } | null>(null);
  const [history, setHistory] = useState<History | null>(null);

  const suffix = filterQuery ? `&${filterQuery}` : "";
  const endpoint = `/api/quality/ranking?groupBy=${groupBy}&minQty=${minQty}${suffix}`;
  const selectedCode = selected?.code ?? null;
  const historyLoading = selectedCode !== null && history?.code !== selectedCode;

  useEffect(() => {
    if (!selectedCode) return;
    let cancelled = false;
    fetch(`/api/quality/history?productCode=${encodeURIComponent(selectedCode)}${suffix}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setHistory({
          code: selectedCode,
          name: json.meta?.productName ?? null,
          rows: (json.data as HistoryRow[] | null) ?? [],
          error: json.error ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setHistory({ code: selectedCode, name: null, rows: [], error: "불량 이력을 불러오지 못했습니다." });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCode, suffix]);

  // 월 단위로 묶어 추이 차트용 데이터 생성
  const monthly = new Map<string, { a: number; c: number }>();
  if (history && history.code === selectedCode) {
    for (const r of history.rows) {
      const m = monthly.get(r.ym) ?? { a: 0, c: 0 };
      m.a += r.qtyA;
      m.c += r.qtyC;
      monthly.set(r.ym, m);
    }
  }
  const trend = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, v]) => ({ ym, rate: rate(v.a, v.c) }));
  const totalA = [...monthly.values()].reduce((s, v) => s + v.a, 0);
  const totalC = [...monthly.values()].reduce((s, v) => s + v.c, 0);

  const historyTable: TableData = {
    columns: HISTORY_COLUMNS,
    rows: (history?.rows ?? []).map((r) => ({
      ...r,
      dept: DEPT_NAMES[r.dept] ?? r.dept,
      rate: rate(r.qtyA, r.qtyC),
    })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-input p-0.5" role="group" aria-label="집계 단위">
          {GROUP_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={groupBy === t.key}
              onClick={() => {
                setGroupBy(t.key);
                setSelected(null);
              }}
              className={`h-8 rounded px-3 text-sm ${
                groupBy === t.key ? "bg-brand-navy font-semibold text-white" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          최소 생산량(A급+C급)
          <select
            value={minQty}
            onChange={(e) => setMinQty(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-white px-2 text-sm text-foreground"
          >
            {MIN_QTY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <PagedTable
        endpoint={endpoint}
        columns={COLUMNS[groupBy]}
        rowKey="key"
        pageSize={10}
        csvName={`불량률_상위_${GROUP_TABS.find((t) => t.key === groupBy)?.label}`}
        caption={`불량률 상위 ${GROUP_TABS.find((t) => t.key === groupBy)?.label} 목록`}
        selectedKey={selectedCode}
        onRowClick={
          groupBy === "product"
            ? (row) => setSelected({ code: String(row.key), label: String(row.label ?? row.key) })
            : undefined
        }
        emptyText="조건에 맞는 실적이 없습니다. 최소 생산량 기준이나 필터를 조정해 보세요."
      />

      {groupBy === "product" && !selected && (
        <p className="text-xs text-muted-foreground">품목명을 누르면 해당 품목의 월별 불량 이력을 확인하고 CSV로 내보낼 수 있습니다.</p>
      )}

      {selected && (
        <section aria-live="polite" className="rounded-lg border border-border bg-muted/30 p-3">
          <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{selected.label} — 불량 이력</h3>
              <p className="text-xs text-muted-foreground">
                품번 {selected.code} · 전체 기간(2021–2025)
                {!historyLoading && history && history.rows.length > 0 && (
                  <>
                    {" "}· A급 {formatFullNumber(totalA)}개 · C급 {formatFullNumber(totalC)}개 · 불량률{" "}
                    {rate(totalA, totalC)?.toFixed(2)}%
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadCsv(`불량이력_${selected.code}`, historyTable)}
              disabled={historyLoading || !history || history.rows.length === 0}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-navy px-3 text-xs font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
            >
              <Download className="size-3.5" aria-hidden />
              불량 이력 CSV
            </button>
          </header>
          {historyLoading ? (
            <div className="skeleton h-56 w-full" role="status" aria-label="불량 이력을 불러오는 중" />
          ) : history?.error ? (
            <EmptyState text={history.error} />
          ) : trend.length === 0 ? (
            <EmptyState text="선택한 조건에서 이 품목의 생산 실적이 없습니다." />
          ) : (
            <ComboChart
              data={trend}
              xKey="ym"
              xKind="ym"
              kind="pct"
              unit="%"
              height={240}
              series={[{ key: "rate", label: "월별 불량률", type: "bar", color: STATUS_COLORS.danger }]}
            />
          )}
        </section>
      )}
    </div>
  );
}
