import { formatCell, type TableData } from "@/lib/table-data";

/** 집계 결과 표 (차트의 표 보기 겸용). 숫자는 우측 정렬 + tabular-nums */
export function DataTable({ table, maxHeight = 360 }: { table: TableData; maxHeight?: number }) {
  return (
    <div className="overflow-auto rounded-lg border border-border" style={{ maxHeight }}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            {table.columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground ${
                  c.format && c.format !== "text" ? "text-right" : "text-left"
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-border hover:bg-muted/40">
              {table.columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-1.5 ${
                    c.format && c.format !== "text" ? "whitespace-nowrap text-right tabular-nums" : "text-left"
                  }`}
                >
                  {formatCell(row[c.key], c.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
