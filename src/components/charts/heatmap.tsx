"use client";

import { useState } from "react";
import { formatFullNumber, formatNumber } from "@/lib/format";

export interface HeatmapMetric {
  key: string;
  label: string;
  kind: "qty" | "pct";
  unit: string;
  /** navy: 수량, red: 불량률 */
  ramp: "navy" | "red";
}

export interface HeatmapRow {
  key: string;
  label: string;
  /** 행 머리 색 점 (부서 색 등) */
  color?: string;
  /** metricKey → 열 key → 값 */
  values: Record<string, Record<string, number | null>>;
  /** metricKey → 행 합계/전체 값 */
  totals?: Record<string, number | null>;
}

interface HeatmapProps {
  rowHeader: string;
  columns: { key: string; label: string }[];
  rows: HeatmapRow[];
  metrics: HeatmapMetric[];
  totalLabel?: string;
}

const RAMPS: Record<HeatmapMetric["ramp"], [number[], number[]]> = {
  navy: [
    [238, 243, 250],
    [31, 58, 104],
  ],
  red: [
    [253, 240, 238],
    [180, 35, 24],
  ],
};

function rgbAt(ramp: HeatmapMetric["ramp"], t: number): number[] {
  const [a, b] = RAMPS[ramp];
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DARK_INK_LUM = luminance([26, 29, 35]);

function mix(ramp: HeatmapMetric["ramp"], t: number): string {
  const c = rgbAt(ramp, t);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** 셀 배경·글자색. 중간 농도에서 대비가 4.5:1 아래로 떨어지면 한 단계 더 진하게 올린다 */
function shade(ramp: HeatmapMetric["ramp"], t: number): { background: string; color: string } {
  let step = t;
  for (;;) {
    const lum = luminance(rgbAt(ramp, step));
    const onDark = (lum + 0.05) / (DARK_INK_LUM + 0.05);
    const onWhite = 1.05 / (lum + 0.05);
    if (onDark >= 4.5) return { background: mix(ramp, step), color: "#1a1d23" };
    if (onWhite >= 4.5 || step >= 1) return { background: mix(ramp, step), color: "#ffffff" };
    step = Math.min(1, step + 0.02);
  }
}

function cellText(v: number, m: HeatmapMetric): string {
  return m.kind === "pct" ? `${v.toFixed(2)}%` : formatNumber(v);
}

function exactText(v: number, m: HeatmapMetric): string {
  return m.kind === "pct" ? `${v.toFixed(2)}%` : `${formatFullNumber(v)} ${m.unit}`;
}

/** 표 형태 히트맵: 셀에 값을 직접 적고 색은 보조 수단으로만 쓴다 */
export function Heatmap({ rowHeader, columns, rows, metrics, totalLabel = "합계" }: HeatmapProps) {
  const [metricKey, setMetricKey] = useState(metrics[0].key);
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  // 이상치 하나가 전체 색을 지배하지 않도록 95 백분위로 상한을 둔다
  const all: number[] = [];
  for (const r of rows) {
    for (const c of columns) {
      const v = r.values[metric.key]?.[c.key];
      if (typeof v === "number" && v > 0) all.push(v);
    }
  }
  all.sort((a, b) => a - b);
  const cap = all.length ? all[Math.min(all.length - 1, Math.floor(all.length * 0.95))] : 1;
  const hasTotals = rows.some((r) => r.totals && r.totals[metric.key] !== undefined);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {metrics.length > 1 ? (
          <div className="inline-flex rounded-md border border-input p-0.5" role="group" aria-label="표시 지표">
            {metrics.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={m.key === metric.key}
                onClick={() => setMetricKey(m.key)}
                className={`h-7 rounded px-2.5 text-xs ${
                  m.key === metric.key ? "bg-brand-navy font-semibold text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
          <span>낮음</span>
          <span
            className="h-2 w-24 rounded"
            style={{ background: `linear-gradient(to right, ${mix(metric.ramp, 0)}, ${mix(metric.ramp, 1)})` }}
          />
          <span>높음 ({cellText(cap, metric)}+)</span>
        </div>
      </div>

      <div className="max-h-[520px] overflow-auto rounded-lg border border-border">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <caption className="sr-only">
            {rowHeader}별 {metric.label} ({metric.unit})
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-20 border-b border-border bg-muted px-2 py-2 text-left font-semibold text-muted-foreground"
              >
                {rowHeader}
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className="sticky top-0 z-10 border-b border-border bg-muted px-1.5 py-2 text-center font-semibold text-muted-foreground"
                >
                  {c.label}
                </th>
              ))}
              {hasTotals && (
                <th
                  scope="col"
                  className="sticky top-0 z-10 border-b border-l border-border bg-muted px-2 py-2 text-right font-semibold text-muted-foreground"
                >
                  {totalLabel}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-40 border-b border-border bg-white px-2 py-1.5 text-left font-medium"
                >
                  <span className="flex items-center gap-1.5">
                    {r.color && <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} aria-hidden />}
                    <span className="truncate" title={r.label}>{r.label}</span>
                  </span>
                </th>
                {columns.map((c) => {
                  const v = r.values[metric.key]?.[c.key];
                  if (typeof v !== "number" || (metric.kind === "qty" && v === 0)) {
                    return (
                      <td key={c.key} className="border-b border-border px-1.5 py-1.5 text-center text-muted-foreground">
                        –
                      </td>
                    );
                  }
                  const t = Math.max(0, Math.min(1, v / cap));
                  return (
                    <td
                      key={c.key}
                      title={`${r.label} · ${c.label}: ${exactText(v, metric)}`}
                      className="whitespace-nowrap border-b border-white px-1.5 py-1.5 text-center tabular-nums"
                      style={shade(metric.ramp, t)}
                    >
                      {cellText(v, metric)}
                    </td>
                  );
                })}
                {hasTotals && (
                  <td className="whitespace-nowrap border-b border-l border-border px-2 py-1.5 text-right font-semibold tabular-nums">
                    {typeof r.totals?.[metric.key] === "number" ? cellText(r.totals[metric.key] as number, metric) : "–"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
