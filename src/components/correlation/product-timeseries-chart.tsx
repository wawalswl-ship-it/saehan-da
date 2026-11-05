"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatNumber } from "@/lib/format";

interface TimeSeriesData {
  period: string;
  production: number;
  sales: number;
}

export function ProductTimeSeriesChart({ data }: { data: TimeSeriesData[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke="#e6eaf0" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 10 }}
          interval={Math.max(0, Math.floor(data.length / 12) - 1)}
        />
        <YAxis tickFormatter={formatNumber} />
        <Tooltip formatter={(value) => formatNumber(Number(value))} />
        <Legend />
        <Line
          type="monotone"
          dataKey="production"
          name="생산(A급)"
          stroke="#1f3a68"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="sales"
          name="판매(정상)"
          stroke="#3f96d6"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
