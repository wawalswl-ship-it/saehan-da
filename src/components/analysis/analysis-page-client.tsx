"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filtersToQuery, parseFilters, periodLabel, searchParamsToRaw, slipLabel } from "@/lib/filters";
import { downloadCsv, type TableData } from "@/lib/table-data";
import { DimensionSelector } from "./dimension-selector";
import { FilterPanel } from "./filter-panel";
import { ResultTable } from "./result-table";
import { ResultChart } from "./result-chart";

interface DimOption {
  key: string;
  label: string;
}

interface SchemaData {
  production: { dimensions: DimOption[]; measures: DimOption[] };
  sales: { dimensions: DimOption[]; measures: DimOption[] };
}

interface AnalysisResult {
  rows: Record<string, unknown>[];
  totalRows: number;
}

export function AnalysisPageClient() {
  const searchParams = useSearchParams();
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [dataset, setDataset] = useState<"production" | "sales">("production");
  const [rowDims, setRowDims] = useState<string[]>(["year"]);
  const [colDim, setColDim] = useState<string[]>([]);
  const [measures, setMeasures] = useState<string[]>(["qty_grade_a"]);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [useGlobal, setUseGlobal] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");

  // 상단 공통 필터 (선택 시에만 적용)
  const globalFilters = parseFilters(searchParamsToRaw(searchParams));
  const globalQuery = filtersToQuery(globalFilters);
  const globalSummary = [
    periodLabel(globalFilters),
    dataset === "production" ? slipLabel(globalFilters) : null,
    globalFilters.depts.length ? `부서 ${globalFilters.depts.join("·")}` : null,
    globalFilters.customers.length ? `거래선 ${globalFilters.customers.length}개` : null,
    globalFilters.productTypes.length ? `품종 ${globalFilters.productTypes.length}개` : null,
    globalFilters.packUnits.length ? `포장단위 ${globalFilters.packUnits.length}개` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    fetch("/api/analysis")
      .then((r) => r.json())
      .then((json) => setSchema(json.data));
  }, []);

  // 데이터셋 변경 시 초기화
  function handleDatasetChange(ds: "production" | "sales") {
    setDataset(ds);
    setRowDims(["year"]);
    setColDim([]);
    setMeasures(ds === "production" ? ["qty_grade_a"] : ["shipment_qty"]);
    setFilters({});
    setResult(null);
    setError(null);
  }

  const runQuery = useCallback(async () => {
    if (rowDims.length === 0 || measures.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          rows: rowDims,
          columns: colDim,
          measures,
          filters,
          // null 이면 공통 필터 미적용, 문자열이면(빈 문자열 포함) 필터 바 상태 그대로 적용
          globalQuery: useGlobal ? globalQuery : null,
        }),
      });
      const json = await res.json();
      if (json.data) setResult(json.data);
      else setError(json.error ?? "분석 중 오류가 발생했습니다.");
    } catch {
      setError("분석 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [dataset, rowDims, colDim, measures, filters, useGlobal, globalQuery]);

  if (!schema) {
    return (
      <div className="space-y-3" role="status" aria-label="분석 설정을 불러오는 중">
        <div className="skeleton h-9 w-48" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="skeleton h-96" />
          <div className="skeleton h-96 lg:col-span-3" />
        </div>
      </div>
    );
  }

  const currentSchema = schema[dataset];
  const dimLabels = Object.fromEntries(currentSchema.dimensions.map((d) => [d.key, d.label]));
  const measureLabels = Object.fromEntries(currentSchema.measures.map((m) => [m.key, m.label]));
  const allSelectedDims = [...rowDims, ...colDim];

  // 결과 CSV: 조회된 집계 행 그대로 (차원 + 측정값)
  function exportCsv() {
    if (!result) return;
    const table: TableData = {
      columns: [
        ...allSelectedDims.map((d) => ({ key: d, label: dimLabels[d] ?? d })),
        ...measures.map((m) => ({ key: m, label: measureLabels[m] ?? m })),
      ],
      rows: result.rows.map((row) => {
        const out: Record<string, string | number | null> = {};
        for (const d of allSelectedDims) out[d] = row[d] === null || row[d] === undefined ? null : String(row[d]);
        for (const m of measures) out[m] = row[m] === null || row[m] === undefined ? null : Number(row[m]);
        return out;
      }),
    };
    downloadCsv(`자유분석_${dataset === "production" ? "생산실적" : "판매실적"}`, table);
  }

  const toggleClass = (active: boolean) =>
    `px-4 h-9 rounded-md text-sm font-medium transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-white border border-input text-foreground hover:bg-muted"
    }`;

  return (
    <div className="space-y-4">
      {/* 데이터셋 선택 */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => handleDatasetChange("production")} aria-pressed={dataset === "production"} className={toggleClass(dataset === "production")}>
          생산실적
        </button>
        <button onClick={() => handleDatasetChange("sales")} aria-pressed={dataset === "sales"} className={toggleClass(dataset === "sales")}>
          판매실적
        </button>
        <label className="ml-auto flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useGlobal}
            onChange={(e) => setUseGlobal(e.target.checked)}
            className="size-4 accent-[#1f3a68]"
          />
          <span>
            상단 공통 필터 적용
            <span className="ml-1 text-xs text-muted-foreground">
              ({useGlobal ? globalSummary : "미적용: 전체 데이터 대상"})
            </span>
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 좌측: 설정 패널 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">행 차원 (최대 3개)</CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionSelector title="" available={currentSchema.dimensions} selected={rowDims} onChange={setRowDims} max={3} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">열 피벗 (최대 1개)</CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionSelector
                title=""
                available={currentSchema.dimensions.filter((d) => !rowDims.includes(d.key))}
                selected={colDim}
                onChange={setColDim}
                max={1}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">측정값</CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionSelector title="" available={currentSchema.measures} selected={measures} onChange={setMeasures} max={4} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">필터</CardTitle>
            </CardHeader>
            <CardContent>
              <FilterPanel
                dataset={dataset}
                dimensions={allSelectedDims}
                dimensionLabels={dimLabels}
                filters={filters}
                onChange={setFilters}
              />
            </CardContent>
          </Card>

          <button
            onClick={runQuery}
            disabled={loading || rowDims.length === 0 || measures.length === 0}
            className="w-full px-4 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-brand-navy-dark disabled:opacity-50 transition-colors"
          >
            {loading ? "분석 중..." : "분석 실행"}
          </button>
        </div>

        {/* 우측: 결과 */}
        <div className="lg:col-span-3">
          {error && (
            <p role="alert" className="mb-3 rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
              {error}
            </p>
          )}
          {result ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm">분석 결과 ({result.totalRows.toLocaleString()}행)</CardTitle>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewMode("table")}
                      aria-pressed={viewMode === "table"}
                      className={`px-3 h-8 text-xs rounded transition-colors ${
                        viewMode === "table" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      테이블
                    </button>
                    <button
                      onClick={() => setViewMode("chart")}
                      aria-pressed={viewMode === "chart"}
                      className={`px-3 h-8 text-xs rounded transition-colors ${
                        viewMode === "chart" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      차트
                    </button>
                    <button
                      onClick={exportCsv}
                      disabled={result.rows.length === 0}
                      className="ml-1 inline-flex h-8 items-center gap-1 rounded border border-input bg-white px-2.5 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      <Download className="size-3.5" aria-hidden />
                      CSV 다운로드
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === "table" ? (
                  <ResultTable
                    data={result.rows}
                    rowDims={rowDims}
                    colDim={colDim[0] ?? null}
                    measures={measures}
                    dimLabels={dimLabels}
                    measureLabels={measureLabels}
                  />
                ) : (
                  <ResultChart
                    data={result.rows}
                    rowDims={rowDims}
                    colDim={colDim[0] ?? null}
                    measures={measures}
                    dimLabels={dimLabels}
                    measureLabels={measureLabels}
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="text-center text-muted-foreground space-y-3">
                  <p className="text-lg font-medium text-foreground">자유 분석</p>
                  <p className="text-sm">
                    좌측에서 행 차원, 열 피벗, 측정값을 선택한 후<br />
                    &quot;분석 실행&quot; 버튼을 클릭하세요.
                  </p>
                  <div className="text-xs text-left max-w-md mx-auto space-y-2 pt-4">
                    <p className="font-medium">분석 예시:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>행: 연도 + 부서, 측정값: 생산량 → 부서별 연도 추이</li>
                      <li>행: 부서, 열 피벗: 연도, 측정값: 불량률 → 피벗 테이블</li>
                      <li>행: 거래선, 측정값: 출고수량 → 거래선별 판매 순위</li>
                      <li>행: 월, 열 피벗: 연도, 측정값: 출고수량 → 계절 비교</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
