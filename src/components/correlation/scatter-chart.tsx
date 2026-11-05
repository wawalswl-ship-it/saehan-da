"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import { formatNumber } from "@/lib/format";

interface ScatterPoint {
  production: number;
  sales: number;
  label: string;
}

export function ProductionSalesScatter({
  data,
  title,
}: {
  data: ScatterPoint[];
  title: string;
}) {
  if (data.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-medium mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid vertical={false} stroke="#e6eaf0" />
          <XAxis
            dataKey="production"
            type="number"
            name="생산량"
            tickFormatter={formatNumber}
            label={{ value: "생산량(A급)", position: "bottom", offset: 20 }}
          />
          <YAxis
            dataKey="sales"
            type="number"
            name="판매량"
            tickFormatter={formatNumber}
            label={{ value: "판매량", angle: -90, position: "insideLeft", offset: -5 }}
          />
          <ZAxis range={[40, 40]} />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as ScatterPoint;
              return (
                <div className="bg-background border rounded-md p-2 shadow-md text-xs">
                  <p className="font-medium">{d.label}</p>
                  <p>생산: {formatNumber(d.production)}</p>
                  <p>판매: {formatNumber(d.sales)}</p>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="#1f3a68" fillOpacity={0.55} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
