"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatFullNumber, formatNumber, WEEKDAY_LABELS } from "@/lib/format";

export type ValueKind = "qty" | "pct" | "count" | "index";
export type XKind = "ym" | "date" | "plain";

export interface ComboSeries {
  key: string;
  label: string;
  type: "bar" | "line";
  color: string;
  stackId?: string;
  /** 예측·기준선 등 실적이 아닌 선 */
  dashed?: boolean;
  /** 강조 계열(굵은 선) */
  emphasis?: boolean;
  /** 같은 행에 들어 있는 전년 동기 값의 키 → 툴팁에 전년 대비 표시 */
  prevKey?: string;
}

export interface RefLine {
  y: number;
  label: string;
  tone?: "neutral" | "danger";
}

export interface RefArea {
  x1: string;
  x2: string;
  label: string;
}

type Row = Record<string, string | number | null | undefined>;

interface ComboChartProps {
  /** 직렬화 가능한 행 배열 (x 값 + 계열별 숫자) */
  data: object[];
  xKey: string;
  series: ComboSeries[];
  kind: ValueKind;
  /** 값 단위 (예: "개", "%", "건") */
  unit: string;
  xKind?: XKind;
  height?: number;
  refLines?: RefLine[];
  refAreas?: RefArea[];
}

const AXIS = "#c9d1dc";
const INK_MUTED = "#5b6472";

function axisValue(v: number, kind: ValueKind): string {
  if (kind === "qty") return formatNumber(v);
  if (kind === "pct") return `${Number.isInteger(v) ? v : v.toFixed(Math.abs(v) < 10 ? 1 : 0)}%`;
  if (kind === "index") return v.toFixed(2);
  return formatFullNumber(v);
}

function exactValue(v: number, kind: ValueKind, unit: string): string {
  if (kind === "pct") return `${v.toFixed(2)}%`;
  if (kind === "index") return v.toFixed(2);
  return `${formatFullNumber(v)}${unit ? ` ${unit}` : ""}`;
}

function xTick(value: string, xKind: XKind, singleYear: boolean): string {
  if (xKind === "ym") {
    const [y, m] = value.split("-");
    return singleYear ? `${Number(m)}월` : `${y.slice(2)}.${m}`;
  }
  if (xKind === "date") {
    const [, m, d] = value.split("-");
    return `${Number(m)}/${Number(d)}`;
  }
  return value.length > 9 ? `${value.slice(0, 8)}…` : value;
}

function xTitle(value: string, xKind: XKind): string {
  if (xKind === "ym") {
    const [y, m] = value.split("-");
    return `${y}년 ${Number(m)}월`;
  }
  if (xKind === "date") {
    const [y, m, d] = value.split("-").map(Number);
    const dow = WEEKDAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${value} (${dow})`;
  }
  return value;
}

function yoyText(current: number, prev: number, kind: ValueKind): string {
  if (kind === "pct") {
    const diff = current - prev;
    return `전년 대비 ${diff > 0 ? "▲" : diff < 0 ? "▼" : "–"} ${Math.abs(diff).toFixed(2)}%p`;
  }
  if (prev === 0) return "전년 실적 없음";
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  return `전년 대비 ${pct > 0 ? "▲" : pct < 0 ? "▼" : "–"} ${Math.abs(pct).toFixed(1)}%`;
}

function Swatch({ s }: { s: ComboSeries }) {
  if (s.type === "bar") {
    return <span className="inline-block size-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} aria-hidden />;
  }
  return (
    <span
      className="inline-block w-4 border-t-2"
      style={{ borderColor: s.color, borderStyle: s.dashed ? "dashed" : "solid" }}
      aria-hidden
    />
  );
}

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: { dataKey?: string | number; value?: number | null; payload?: Row }[];
}

export function ComboChart({
  data: rawData,
  xKey,
  series,
  kind,
  unit,
  xKind = "plain",
  height = 300,
  refLines = [],
  refAreas = [],
}: ComboChartProps) {
  const data = rawData as Row[];
  const years = new Set(data.map((d) => String(d[xKey]).slice(0, 4)));
  const singleYear = xKind === "ym" && years.size <= 1;
  const dense = data.length > 24;
  // 긴 범주 이름(거래선 등)이 많으면 기울여서 겹치지 않게 한다
  const angled = xKind === "plain" && data.length > 8 && data.some((d) => String(d[xKey]).length > 4);

  function renderTooltip(props: TipProps) {
    if (!props.active || !props.payload?.length) return null;
    const row = props.payload[0]?.payload ?? {};
    return (
      <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs shadow-md">
        <p className="mb-1 font-semibold text-foreground">{xTitle(String(props.label ?? ""), xKind)}</p>
        <ul className="space-y-1">
          {series.map((s) => {
            const v = row[s.key];
            if (typeof v !== "number") return null;
            const prev = s.prevKey ? row[s.prevKey] : undefined;
            return (
              <li key={s.key}>
                <span className="flex items-center gap-1.5">
                  <Swatch s={s} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">
                    {exactValue(v, kind, unit)}
                  </span>
                </span>
                {typeof prev === "number" && (
                  <span className="block pl-5 text-[11px] text-muted-foreground">{yoyText(v, prev, kind)}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="범례">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <Swatch s={s} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#e6eaf0" />
          <XAxis
            dataKey={xKey}
            tickFormatter={(v) => xTick(String(v), xKind, singleYear)}
            tickLine={false}
            axisLine={{ stroke: AXIS }}
            minTickGap={dense ? 24 : 8}
            interval={angled ? 0 : "preserveStartEnd"}
            tickMargin={6}
            angle={angled ? -40 : 0}
            textAnchor={angled ? "end" : "middle"}
            height={angled ? 76 : 30}
          />
          <YAxis
            tickFormatter={(v) => axisValue(Number(v), kind)}
            domain={
              refLines.length
                ? [(min: number) => Math.min(0, min), (max: number) => Math.max(max, ...refLines.map((r) => r.y)) * 1.12]
                : [0, "auto"]
            }
            tickLine={false}
            axisLine={false}
            width={52}
            tickMargin={4}
          />
          <Tooltip
            content={(p) => renderTooltip(p as unknown as TipProps)}
            cursor={{ fill: "#1f3a68", fillOpacity: 0.05, stroke: "#c9d1dc" }}
            isAnimationActive={false}
          />
          {refAreas.map((a) => (
            <ReferenceArea
              key={a.label}
              x1={a.x1}
              x2={a.x2}
              fill={INK_MUTED}
              fillOpacity={0.1}
              stroke="none"
              label={{ value: a.label, position: "insideTop", fontSize: 11, fill: INK_MUTED }}
            />
          ))}
          {series.map((s) =>
            s.type === "bar" ? (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                stackId={s.stackId}
                maxBarSize={24}
                radius={s.stackId ? 0 : [4, 4, 0, 0]}
                stroke="#ffffff"
                strokeWidth={s.stackId ? 1.5 : 0}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={s.color}
                strokeWidth={s.emphasis ? 3 : 2}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                strokeLinecap="round"
                dot={dense ? false : { r: 3, fill: s.color, stroke: "#ffffff", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: s.color, stroke: "#ffffff", strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )
          )}
          {refLines.map((r) => (
            <ReferenceLine
              key={r.label}
              y={r.y}
              stroke={r.tone === "danger" ? "#b42318" : INK_MUTED}
              strokeDasharray="5 4"
              strokeWidth={1}
              label={{
                value: r.label,
                position: "insideTopRight",
                fontSize: 11,
                fill: r.tone === "danger" ? "#b42318" : INK_MUTED,
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
