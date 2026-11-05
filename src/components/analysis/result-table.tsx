"use client";

import { formatNumber } from "@/lib/format";

interface ResultTableProps {
  data: Record<string, unknown>[];
  rowDims: string[];
  colDim: string | null;
  measures: string[];
  dimLabels: Record<string, string>;
  measureLabels: Record<string, string>;
}

export function ResultTable({
  data,
  rowDims,
  colDim,
  measures,
  dimLabels,
  measureLabels,
}: ResultTableProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">결과가 없습니다.</p>;
  }

  // 피벗이 없는 경우: 단순 테이블
  if (!colDim) {
    const allCols = [...rowDims, ...measures];
    return (
      <div className="overflow-auto max-h-[600px]">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-background z-10">
            <tr>
              {allCols.map((col) => (
                <th
                  key={col}
                  className={`p-2 border-b font-medium text-xs ${
                    measures.includes(col) ? "text-right" : "text-left"
                  }`}
                >
                  {dimLabels[col] ?? measureLabels[col] ?? col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b hover:bg-muted/50">
                {allCols.map((col) => {
                  const val = row[col];
                  const isMeasure = measures.includes(col);
                  return (
                    <td
                      key={col}
                      className={`p-2 text-xs ${isMeasure ? "text-right tabular-nums" : "text-left"}`}
                    >
                      {isMeasure
                        ? typeof val === "number" || typeof val === "bigint" || typeof val === "string"
                          ? col === "defect_rate"
                            ? `${val}%`
                            : formatNumber(Number(val))
                          : "-"
                        : String(val ?? "-")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 피벗 모드: colDim 값들을 열 헤더로
  const colValues = [...new Set(data.map((r) => String(r[colDim] ?? "-")))].sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  // 행 키 생성
  const rowKeyFn = (row: Record<string, unknown>) =>
    rowDims.map((d) => String(row[d] ?? "-")).join("|||");

  // 피벗 맵 구성
  const pivotMap = new Map<string, Map<string, Record<string, unknown>>>();
  const rowInfoMap = new Map<string, Record<string, unknown>>();

  for (const row of data) {
    const rk = rowKeyFn(row);
    const cv = String(row[colDim] ?? "-");
    if (!pivotMap.has(rk)) pivotMap.set(rk, new Map());
    pivotMap.get(rk)!.set(cv, row);
    if (!rowInfoMap.has(rk)) {
      const info: Record<string, unknown> = {};
      for (const d of rowDims) info[d] = row[d];
      rowInfoMap.set(rk, info);
    }
  }

  const rowKeys = [...pivotMap.keys()];
  const mainMeasure = measures[0];

  return (
    <div className="overflow-auto max-h-[600px]">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-background z-10">
          <tr>
            {rowDims.map((d) => (
              <th key={d} className="p-2 border-b font-medium text-xs text-left">
                {dimLabels[d] ?? d}
              </th>
            ))}
            {colValues.map((cv) => (
              <th key={cv} className="p-2 border-b font-medium text-xs text-right">
                {cv}
              </th>
            ))}
            <th className="p-2 border-b font-medium text-xs text-right bg-muted/50">합계</th>
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((rk) => {
            const rowInfo = rowInfoMap.get(rk)!;
            const colMap = pivotMap.get(rk)!;
            let rowTotal = 0;
            return (
              <tr key={rk} className="border-b hover:bg-muted/50">
                {rowDims.map((d) => (
                  <td key={d} className="p-2 text-xs">{String(rowInfo[d] ?? "-")}</td>
                ))}
                {colValues.map((cv) => {
                  const cell = colMap.get(cv);
                  const val = cell ? Number(cell[mainMeasure] ?? 0) : 0;
                  rowTotal += val;
                  return (
                    <td key={cv} className="p-2 text-xs text-right tabular-nums">
                      {val !== 0
                        ? mainMeasure === "defect_rate"
                          ? `${val}%`
                          : formatNumber(val)
                        : "-"}
                    </td>
                  );
                })}
                <td className="p-2 text-xs text-right tabular-nums font-medium bg-muted/50">
                  {mainMeasure === "defect_rate" ? "-" : formatNumber(rowTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
        {mainMeasure !== "defect_rate" && (
          <tfoot className="sticky bottom-0 bg-background">
            <tr className="border-t-2">
              <td colSpan={rowDims.length} className="p-2 text-xs font-medium">
                합계
              </td>
              {colValues.map((cv) => {
                const colTotal = rowKeys.reduce((sum, rk) => {
                  const cell = pivotMap.get(rk)!.get(cv);
                  return sum + (cell ? Number(cell[mainMeasure] ?? 0) : 0);
                }, 0);
                return (
                  <td key={cv} className="p-2 text-xs text-right tabular-nums font-medium">
                    {formatNumber(colTotal)}
                  </td>
                );
              })}
              <td className="p-2 text-xs text-right tabular-nums font-bold bg-muted/50">
                {formatNumber(
                  data.reduce((s, r) => s + Number(r[mainMeasure] ?? 0), 0)
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
