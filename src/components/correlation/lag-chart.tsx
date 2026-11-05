"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface LagData {
  lag: number;
  correlation: number;
  pairs: number;
}

export function LagCorrelationChart({ data }: { data: LagData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke="#e6eaf0" />
        <XAxis
          dataKey="lag"
          tickFormatter={(v) => `${v}개월`}
        />
        <YAxis domain={[-1, 1]} tickFormatter={(v) => v.toFixed(1)} />
        <Tooltip
          formatter={(value) => Number(value).toFixed(4)}
          labelFormatter={(label) => `리드타임: ${label}개월`}
        />
        <ReferenceLine y={0} stroke="#888" />
        <Bar dataKey="correlation" name="상관계수" radius={[4, 4, 0, 0]} maxBarSize={32}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.correlation >= 0.7 ? "#1f3a68" : entry.correlation >= 0.4 ? "#3b5a8f" : "#8792a2"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
