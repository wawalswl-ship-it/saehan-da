import { Minus, TrendingDown, TrendingUp } from "lucide-react";

export interface KpiDelta {
  /** 증감 방향 */
  direction: "up" | "down" | "flat";
  /** 표시 문자열 (예: "12.3%", "0.21%p") */
  text: string;
  /** 증가가 좋은 지표인지에 따라 정해지는 의미 */
  tone: "good" | "bad" | "neutral";
}

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  /** 축약 전 정확한 값 */
  exact?: string;
  delta?: KpiDelta | null;
  /** 전년 대비를 계산할 수 없는 이유 등 */
  deltaFallback?: string;
  basis?: string;
}

const toneClass: Record<KpiDelta["tone"], string> = {
  good: "text-status-good",
  bad: "text-status-danger",
  neutral: "text-muted-foreground",
};

export function KpiCard({ label, value, unit, exact, delta, deltaFallback, basis }: KpiCardProps) {
  const Icon = delta?.direction === "up" ? TrendingUp : delta?.direction === "down" ? TrendingDown : Minus;
  const word = delta?.direction === "up" ? "증가" : delta?.direction === "down" ? "감소" : "변동 없음";
  const arrow = delta?.direction === "up" ? "▲" : delta?.direction === "down" ? "▼" : "–";

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </p>
      {exact && <p className="mt-0.5 truncate text-xs text-muted-foreground" title={exact}>{exact}</p>}
      <p className="mt-2 text-xs">
        {delta ? (
          <span className={`inline-flex items-center gap-1 font-medium ${toneClass[delta.tone]}`}>
            <Icon className="size-3.5" aria-hidden />
            <span>
              전년 대비 {arrow} {delta.text}
              <span className="sr-only"> {word}</span>
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{deltaFallback ?? "전년 대비 비교 없음"}</span>
        )}
      </p>
      {basis && <p className="mt-1 text-[11px] text-muted-foreground">{basis}</p>}
    </div>
  );
}

/** 전년 대비 증감률(%) → KpiDelta. higherIsBetter=false 면 증가가 '나쁨' */
export function pctDelta(current: number, prev: number | null | undefined, higherIsBetter = true): KpiDelta | null {
  if (prev === null || prev === undefined || prev === 0) return null;
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  return toDelta(pct, `${Math.abs(pct).toFixed(1)}%`, higherIsBetter);
}

/** 비율 지표의 전년 대비 차이(%p) */
export function pointDelta(current: number | null, prev: number | null | undefined, higherIsBetter = false): KpiDelta | null {
  if (current === null || prev === null || prev === undefined) return null;
  const diff = current - prev;
  return toDelta(diff, `${Math.abs(diff).toFixed(2)}%p`, higherIsBetter);
}

function toDelta(diff: number, text: string, higherIsBetter: boolean): KpiDelta {
  if (Math.abs(diff) < 0.005) return { direction: "flat", text, tone: "neutral" };
  const up = diff > 0;
  return { direction: up ? "up" : "down", text, tone: up === higherIsBetter ? "good" : "bad" };
}
