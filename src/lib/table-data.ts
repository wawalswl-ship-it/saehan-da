// 차트 카드의 "표 보기"와 CSV 다운로드가 함께 쓰는 직렬화 가능한 표 데이터
import { formatFullNumber, formatNumber, formatPct } from "@/lib/format";

export type CellFormat = "text" | "int" | "compact" | "pct" | "dec2";

export interface TableColumn {
  key: string;
  label: string;
  format?: CellFormat;
}

export type TableRow = Record<string, string | number | null | undefined>;

export interface TableData {
  columns: TableColumn[];
  rows: TableRow[];
}

export function formatCell(value: TableRow[string], format: CellFormat = "text"): string {
  if (value === null || value === undefined || value === "") return "-";
  if (format === "text") return String(value);
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  switch (format) {
    case "int":
      return formatFullNumber(n);
    case "compact":
      return formatNumber(n);
    case "pct":
      return formatPct(n);
    case "dec2":
      return n.toFixed(2);
  }
}

function csvEscape(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** 원값 그대로(축약 없이) CSV 문자열 생성 */
export function toCsv(table: TableData): string {
  const lines = [table.columns.map((c) => csvEscape(c.label)).join(",")];
  for (const row of table.rows) {
    lines.push(
      table.columns
        .map((c) => {
          const v = row[c.key];
          if (v === null || v === undefined) return "";
          if (typeof v === "number") {
            if (c.format === "pct" || c.format === "dec2") return v.toFixed(c.format === "pct" ? 3 : 2);
            return String(v);
          }
          return csvEscape(String(v));
        })
        .join(",")
    );
  }
  return lines.join("\r\n");
}

/** 브라우저에서 CSV 저장 (Excel 한글 인식을 위해 UTF-8 BOM 포함) */
export function downloadCsv(fileName: string, table: TableData): void {
  const blob = new Blob(["﻿" + toCsv(table)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
