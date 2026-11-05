"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionSalesScatter } from "./scatter-chart";
import { LagCorrelationChart } from "./lag-chart";
import { ProductTimeSeriesChart } from "./product-timeseries-chart";
import { formatNumber } from "@/lib/format";

interface CommonProduct {
  product_type: string;
  product_name: string;
  total_prod: string;
  total_sales: string;
}

interface ScatterMonthly {
  ym: string;
  production: string;
  sales: string;
}

interface ProductScatter {
  product_type: string;
  product_name: string;
  production: string;
  sales: string;
}

interface LagCorr {
  lag: number;
  correlation: number;
  pairs: number;
}

interface MonthlyProdSales {
  ym: string;
  production: number;
  sales: number;
}

interface CorrelationData {
  commonProducts: CommonProduct[];
  scatterMonthly: ScatterMonthly[];
  productScatter: ProductScatter[];
  lagCorrelation: {
    monthly: MonthlyProdSales[];
    lagCorrelations: LagCorr[];
  };
}

interface TimeSeriesPoint {
  period: string;
  production: number;
  sales: number;
}

function pearsonCorrelation(pairs: { x: number; y: number }[]): number {
  const n = pairs.length;
  if (n < 3) return 0;
  const sumX = pairs.reduce((s, p) => s + p.x, 0);
  const sumY = pairs.reduce((s, p) => s + p.y, 0);
  const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = pairs.reduce((s, p) => s + p.y * p.y, 0);
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return den === 0 ? 0 : num / den;
}

function corrLabel(r: number): { text: string; color: string } {
  const abs = Math.abs(r);
  if (abs >= 0.8) return { text: "매우 강한 상관", color: "text-status-good" };
  if (abs >= 0.6) return { text: "강한 상관", color: "text-brand-navy" };
  if (abs >= 0.4) return { text: "보통 상관", color: "text-foreground" };
  if (abs >= 0.2) return { text: "약한 상관", color: "text-muted-foreground" };
  return { text: "거의 없음", color: "text-muted-foreground" };
}

export function CorrelationPageClient() {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[] | null>(null);
  const [tsLoading, setTsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/correlation")
      .then((r) => r.json())
      .then((json) => {
        setData(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadTimeSeries = useCallback(async (productType: string) => {
    setSelectedProduct(productType);
    setTsLoading(true);
    try {
      const res = await fetch(`/api/correlation?type=product-timeseries&productType=${encodeURIComponent(productType)}`);
      const json = await res.json();
      setTimeSeries(json.data);
    } finally {
      setTsLoading(false);
    }
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">데이터 로딩 중...</div>
      </div>
    );
  }

  // 월별 산점도 데이터
  const monthlyScatter = data.scatterMonthly.map((d) => ({
    production: Number(d.production),
    sales: Number(d.sales),
    label: d.ym,
  }));

  const monthlyCorr = pearsonCorrelation(
    monthlyScatter.map((d) => ({ x: d.production, y: d.sales }))
  );
  const monthlyLabel = corrLabel(monthlyCorr);

  // 품종별 산점도 데이터
  const productScatter = data.productScatter.map((d) => ({
    production: Number(d.production),
    sales: Number(d.sales),
    label: (d.product_name || d.product_type).trim(),
  }));

  const productCorr = pearsonCorrelation(
    productScatter.map((d) => ({ x: d.production, y: d.sales }))
  );
  const productLabel = corrLabel(productCorr);

  // 최적 lag
  const bestLag = data.lagCorrelation.lagCorrelations.reduce((best, cur) =>
    cur.correlation > best.correlation ? cur : best
  );

  const selectedProductInfo = data.commonProducts.find(
    (p) => p.product_type === selectedProduct
  );

  return (
    <div className="space-y-6">
      {/* 상관계수 요약 KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              월별 생산-판매 상관계수 (매칭 품목)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyCorr.toFixed(4)}</div>
            <p className={`text-xs mt-1 ${monthlyLabel.color}`}>
              {monthlyLabel.text} ({monthlyScatter.length}개월)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              품종별 생산-판매 상관계수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productCorr.toFixed(4)}</div>
            <p className={`text-xs mt-1 ${productLabel.color}`}>
              {productLabel.text} ({productScatter.length}개 품종)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              최적 리드타임
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bestLag.lag}개월</div>
            <p className="text-xs mt-1 text-brand-navy">
              상관계수 {bestLag.correlation.toFixed(4)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 산점도 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>월별 생산-판매 산점도 (매칭 품목 기준)</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductionSalesScatter
              data={monthlyScatter}
              title={`r = ${monthlyCorr.toFixed(4)} (${monthlyLabel.text})`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>품종별 생산-판매 산점도</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductionSalesScatter
              data={productScatter}
              title={`r = ${productCorr.toFixed(4)} (${productLabel.text})`}
            />
          </CardContent>
        </Card>
      </div>

      {/* 리드타임 분석 */}
      <Card>
        <CardHeader>
          <CardTitle>리드타임(Lag) 상관분석 (매칭 품목 기준)</CardTitle>
          <p className="text-xs text-muted-foreground">
            생산 시점과 N개월 후 판매의 상관계수 — 가장 높은 상관을 보이는 lag가 최적 리드타임
          </p>
        </CardHeader>
        <CardContent>
          <LagCorrelationChart data={data.lagCorrelation.lagCorrelations} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">리드타임</th>
                  <th className="p-2 text-right font-medium">상관계수(r)</th>
                  <th className="p-2 text-right font-medium">r²</th>
                  <th className="p-2 text-left font-medium">해석</th>
                  <th className="p-2 text-right font-medium">데이터쌍</th>
                </tr>
              </thead>
              <tbody>
                {data.lagCorrelation.lagCorrelations.map((row) => {
                  const label = corrLabel(row.correlation);
                  return (
                    <tr key={row.lag} className={`border-b hover:bg-muted/50 ${row.lag === bestLag.lag ? "bg-brand-navy-soft" : ""}`}>
                      <td className="p-2">{row.lag}개월</td>
                      <td className="p-2 text-right tabular-nums font-medium">{row.correlation.toFixed(4)}</td>
                      <td className="p-2 text-right tabular-nums">{(row.correlation ** 2).toFixed(4)}</td>
                      <td className={`p-2 ${label.color}`}>{label.text}</td>
                      <td className="p-2 text-right">{row.pairs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 품종별 시계열 비교 */}
      <Card>
        <CardHeader>
          <CardTitle>품종별 생산 vs 판매 시계열 비교</CardTitle>
          <p className="text-xs text-muted-foreground">
            공통 품종을 선택하면 해당 품종의 월별 생산·판매 추이를 비교합니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-64 mb-4">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">품종</th>
                  <th className="p-2 text-left font-medium">품명</th>
                  <th className="p-2 text-right font-medium">5년 생산량</th>
                  <th className="p-2 text-right font-medium">5년 판매량</th>
                  <th className="p-2 text-right font-medium">비율</th>
                  <th className="p-2 text-center font-medium">선택</th>
                </tr>
              </thead>
              <tbody>
                {data.commonProducts.map((p) => {
                  const prod = Number(p.total_prod);
                  const sales = Number(p.total_sales);
                  const ratio = prod > 0 ? ((sales / prod) * 100).toFixed(0) : "-";
                  const isSelected = selectedProduct === p.product_type;
                  return (
                    <tr
                      key={p.product_type}
                      className={`border-b hover:bg-muted/50 cursor-pointer ${isSelected ? "bg-brand-navy-soft" : ""}`}
                      onClick={() => loadTimeSeries(p.product_type)}
                    >
                      <td className="p-2 text-xs">{p.product_type}</td>
                      <td className="p-2 text-xs truncate max-w-48">{p.product_name?.trim()}</td>
                      <td className="p-2 text-right text-xs tabular-nums">{formatNumber(prod)}</td>
                      <td className="p-2 text-right text-xs tabular-nums">{formatNumber(sales)}</td>
                      <td className="p-2 text-right text-xs tabular-nums">{ratio}%</td>
                      <td className="p-2 text-center">
                        {isSelected && <span className="text-primary text-xs font-bold">&#10003;</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedProduct && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">
                {selectedProductInfo?.product_name?.trim() ?? selectedProduct} — 월별 추이
              </p>
              {tsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">로딩 중...</p>
              ) : timeSeries ? (
                <ProductTimeSeriesChart data={timeSeries} />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
