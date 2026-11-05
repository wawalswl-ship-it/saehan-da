"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatNumber, CHART_COLORS } from "@/lib/format";

interface ResultChartProps {
  data: Record<string, unknown>[];
  rowDims: string[];
  colDim: string | null;
  measures: string[];
  dimLabels: Record<string, string>;
  measureLabels: Record<string, string>;
}

export function ResultChart({
  data,
  rowDims,
  colDim,
  measures,
  dimLabels,
  measureLabels,
}: ResultChartProps) {
  if (data.length === 0) return null;

  const mainMeasure = measures[0];

  // 피벗 모드: 행 차원을 X축, 컬럼 차원 값들을 각 바로
  if (colDim) {
    const colValues = [...new Set(data.map((r) => String(r[colDim] ?? "-")))].sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    const rowKeyFn = (row: Record<string, unknown>) =>
      rowDims.map((d) => String(row[d] ?? "")).join(" / ");

    const pivotData = new Map<string, Record<string, number | string>>();
    for (const row of data) {
      const rk = rowKeyFn(row);
      if (!pivotData.has(rk)) pivotData.set(rk, { name: rk });
      const cv = String(row[colDim] ?? "-");
      pivotData.get(rk)![cv] = Number(row[mainMeasure] ?? 0);
    }

    const chartData = [...pivotData.values()];
    if (chartData.length > 30) return null; // too many bars

    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
          <CartesianGrid vertical={false} stroke="#e6eaf0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatNumber} />
          <Tooltip formatter={(value) => formatNumber(Number(value))} />
          <Legend />
          {colValues.map((cv, i) => (
            <Bar
              key={cv}
              dataKey={cv}
              name={cv}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // 비피벗: 첫 번째 행 차원을 X축, 측정값들을 바로
  const chartData = data.map((row) => {
    const item: Record<string, number | string> = {
      name: rowDims.map((d) => String(row[d] ?? "")).join(" / "),
    };
    for (const m of measures) {
      item[m] = Number(row[m] ?? 0);
    }
    return item;
  });

  if (chartData.length > 40) return null;

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke="#e6eaf0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatNumber} />
        <Tooltip formatter={(value) => formatNumber(Number(value))} />
        <Legend />
        {measures.map((m, i) => (
          <Bar
            key={m}
            dataKey={m}
            name={measureLabels[m] ?? m}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
