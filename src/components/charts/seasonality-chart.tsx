"use client";

import { useState } from "react";
import { YEARS } from "@/lib/filters";
import { YEAR_COLORS } from "@/lib/format";
import { ComboChart, type ComboSeries } from "./combo-chart";

type Row = Record<string, string | number | null>;

const METRICS = [
  { key: "s", label: "순판매" },
  { key: "p", label: "생산량(A급)" },
] as const;

/** 5개년 월별 겹침 추이: 같은 색상의 농도로 연도를 구분하고 최신 연도를 굵게 강조 */
export function SeasonalityChart({ data }: { data: Row[] }) {
  const [metric, setMetric] = useState<"s" | "p">("s");

  const series: ComboSeries[] = YEARS.map((y) => ({
    key: `${metric}${y}`,
    label: `${y}년`,
    type: "line",
    color: YEAR_COLORS[y],
    emphasis: y === YEARS[YEARS.length - 1],
    prevKey: y > YEARS[0] ? `${metric}${y - 1}` : undefined,
  }));

  return (
    <div>
      <div className="mb-2 inline-flex rounded-md border border-input p-0.5" role="group" aria-label="표시 지표">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={`h-7 rounded px-2.5 text-xs ${
              metric === m.key ? "bg-brand-navy font-semibold text-white" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <ComboChart data={data} xKey="month" series={series} kind="qty" unit="개" height={300} />
    </div>
  );
}
