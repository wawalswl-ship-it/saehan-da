"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, CircleAlert, Download, Search } from "lucide-react";
import { ComboChart } from "@/components/charts/combo-chart";
import { EmptyState } from "@/components/kit/empty-state";
import { SERIES_COLORS, formatFullNumber, formatNumber } from "@/lib/format";
import { downloadCsv, type TableData } from "@/lib/table-data";
import type { PlanningItem, PlanningItemDetail, RiskLevel } from "@/lib/planning-queries";

interface PlanningItemsProps {
  items: PlanningItem[];
  /** forecast: 품목별 수요 예측 / risk: 재고 부족 위험 품목 */
  mode: "forecast" | "risk";
  forecastMonths: string[];
  filterQuery: string;
}

const PAGE_SIZE = 10;

const RISK_LABEL: Record<RiskLevel, string> = {
  shortage: "부족 위험",
  low: "주의",
  ok: "여유",
  unknown: "생산 실적 없음",
};

function RiskBadge({ risk }: { risk: RiskLevel }) {
  if (risk === "shortage") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-status-danger/40 bg-status-danger/10 px-1.5 py-0.5 text-xs font-semibold text-status-danger">
        <CircleAlert className="size-3.5" aria-hidden />
        {RISK_LABEL.shortage}
      </span>
    );
  }
  if (risk === "low") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-status-warning/40 bg-status-warning/10 px-1.5 py-0.5 text-xs font-semibold text-status-warning">
        <AlertTriangle className="size-3.5" aria-hidden />
        {RISK_LABEL.low}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{RISK_LABEL[risk]}</span>;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y.slice(2)}.${m}`;
}

interface Detail {
  code: string;
  data: PlanningItemDetail | null;
  error: string | null;
}

/** 품목별 예측·재고 추정 표 (집계 결과 300건 이내, 클라이언트 페이지네이션) + 품목 상세 차트 */
export function PlanningItems({ items, mode, forecastMonths, filterQuery }: PlanningItemsProps) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const kw = keyword.trim().toLowerCase();
  const filtered = items.filter(
    (i) =>
      !kw ||
      i.name.toLowerCase().includes(kw) ||
      i.code.toLowerCase().includes(kw) ||
      (i.customer ?? "").toLowerCase().includes(kw)
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const detailLoading = selectedCode !== null && detail?.code !== selectedCode;
  const suffix = filterQuery ? `&${filterQuery}` : "";

  useEffect(() => {
    if (!selectedCode) return;
    let cancelled = false;
    fetch(`/api/planning/item?productCode=${encodeURIComponent(selectedCode)}${suffix}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setDetail({ code: selectedCode, data: json.data ?? null, error: json.error ?? null });
      })
      .catch(() => {
        if (!cancelled) setDetail({ code: selectedCode, data: null, error: "품목 상세를 불러오지 못했습니다." });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCode, suffix]);

  const csv: TableData = {
    columns: [
      { key: "name", label: "품목" },
      { key: "code", label: "품번" },
      { key: "customer", label: "거래선" },
      { key: "last12", label: "최근 12개월 순판매(개)", format: "int" },
      { key: "trendPct", label: "전년 대비 추세(%)", format: "pct" },
      ...forecastMonths.map((ym, i) => ({ key: `f${i}`, label: `${ym} 예측(개)`, format: "int" as const })),
      { key: "forecastSum", label: "3개월 예측 합계(개)", format: "int" },
      { key: "estInventory", label: "추정 재고(개)", format: "int" },
      { key: "coverMonths", label: "커버(개월)", format: "dec2" },
      { key: "risk", label: "재고 위험도" },
    ],
    rows: filtered.map((i) => ({
      name: i.name,
      code: i.code,
      customer: i.customer,
      last12: i.last12,
      trendPct: i.trendPct,
      f0: i.forecast[0],
      f1: i.forecast[1],
      f2: i.forecast[2],
      forecastSum: i.forecastSum,
      estInventory: i.estInventory,
      coverMonths: i.coverMonths,
      risk: RISK_LABEL[i.risk],
    })),
  };

  const selected = items.find((i) => i.code === selectedCode) ?? null;
  // 상세 차트: 최근 24개월 + 예측 3개월
  const series = detail?.data?.series.slice(-27) ?? [];
  const flowData = series.map((p) => ({
    ym: p.ym,
    production: p.forecast === null ? p.production : null,
    sales: p.forecast === null ? p.sales : null,
    forecast: p.forecast,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-white px-2 sm:w-72">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">품목·품번·거래선 검색</span>
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="품목·품번·거래선 검색"
            className="h-full w-full bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => downloadCsv(mode === "forecast" ? "품목별_수요예측_참고용" : "재고부족_위험_품목_참고용", csv)}
          disabled={filtered.length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-2.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden />
          CSV 다운로드
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          text={
            mode === "risk"
              ? "선택한 조건에서 재고 부족 위험으로 추정되는 품목이 없습니다."
              : "선택한 조건에 해당하는 품목이 없습니다."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                {mode === "forecast" ? "품목별 향후 3개월 수요 예측(참고용 추정치)" : "재고 부족 위험 품목(참고용 추정치)"}
              </caption>
              <thead className="bg-muted text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">품목</th>
                  <th scope="col" className="px-3 py-2 text-left">거래선</th>
                  {mode === "forecast" ? (
                    <>
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-right">최근 12개월(개)</th>
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-right">추세</th>
                      {forecastMonths.map((ym) => (
                        <th key={ym} scope="col" className="whitespace-nowrap px-3 py-2 text-right">
                          {monthLabel(ym)} 예측
                        </th>
                      ))}
                    </>
                  ) : (
                    <>
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-right">추정 재고(개)</th>
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-right">3개월 예측(개)</th>
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-right">커버(개월)</th>
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-left">위험도</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => {
                  const isSelected = i.code === selectedCode;
                  return (
                    <tr key={i.code} className={`border-t border-border ${isSelected ? "bg-brand-navy-soft" : "hover:bg-muted/40"}`}>
                      <td className="max-w-60 px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedCode(isSelected ? null : i.code)}
                          aria-pressed={isSelected}
                          className="block max-w-full truncate text-left font-medium text-brand-navy underline decoration-brand-navy/30 underline-offset-2 hover:decoration-brand-navy"
                          title={i.name}
                        >
                          {i.name}
                        </button>
                        <span className="block text-xs text-muted-foreground">{i.code}</span>
                      </td>
                      <td className="max-w-44 truncate px-3 py-1.5 text-muted-foreground" title={i.customer ?? ""}>
                        {i.customer ?? "-"}
                      </td>
                      {mode === "forecast" ? (
                        <>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{formatFullNumber(i.last12)}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                            {i.trendPct === null
                              ? "신규"
                              : `${i.trendPct > 0 ? "▲" : i.trendPct < 0 ? "▼" : "–"} ${Math.abs(i.trendPct).toFixed(1)}%`}
                          </td>
                          {i.forecast.map((v, idx) => (
                            <td key={idx} className="whitespace-nowrap px-3 py-1.5 text-right font-medium tabular-nums">
                              {formatFullNumber(v)}
                            </td>
                          ))}
                        </>
                      ) : (
                        <>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                            {i.estInventory === null ? "-" : formatFullNumber(i.estInventory)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{formatFullNumber(i.forecastSum)}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                            {i.coverMonths === null ? "-" : i.coverMonths.toFixed(1)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5"><RiskBadge risk={i.risk} /></td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              총 {filtered.length.toLocaleString("ko-KR")}개 품목 · {current} / {pageCount} 페이지
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(current - 1)}
                disabled={current <= 1}
                aria-label="이전 페이지"
                className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-white hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setPage(current + 1)}
                disabled={current >= pageCount}
                aria-label="다음 페이지"
                className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-white hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <section aria-live="polite" className="rounded-lg border border-border bg-muted/30 p-3">
          <header className="mb-2">
            <h3 className="text-sm font-semibold">{selected.name} — 월별 입고·판매와 예측</h3>
            <p className="text-xs text-muted-foreground">
              품번 {selected.code} · 최근 24개월 실적 + 향후 3개월 예측(참고용 추정치)
              {selected.estInventory !== null && ` · 추정 재고 ${formatNumber(selected.estInventory)}개`}
            </p>
          </header>
          {detailLoading ? (
            <div className="skeleton h-60 w-full" role="status" aria-label="품목 상세를 불러오는 중" />
          ) : detail?.error || !detail?.data ? (
            <EmptyState text={detail?.error ?? "품목 상세가 없습니다."} />
          ) : (
            <ComboChart
              data={flowData}
              xKey="ym"
              xKind="ym"
              kind="qty"
              unit="개"
              height={260}
              series={[
                { key: "production", label: "순입고(21+22−32)", type: "bar", color: SERIES_COLORS.production },
                { key: "sales", label: "순판매", type: "bar", color: SERIES_COLORS.sales },
                { key: "forecast", label: "수요 예측(참고용)", type: "line", color: SERIES_COLORS.returned, dashed: true },
              ]}
            />
          )}
        </section>
      )}
    </div>
  );
}
