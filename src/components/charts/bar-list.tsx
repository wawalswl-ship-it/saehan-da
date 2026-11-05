import { BRAND } from "@/lib/format";

export interface BarListItem {
  key: string;
  label: string;
  sub?: string;
  /** 막대 길이를 정하는 값 */
  value: number;
  /** 막대 끝에 적는 값 (단위 포함) */
  valueText: string;
  /** 값 옆 보조 표기 (비중, 전년 대비 등) */
  extra?: string;
  color?: string;
}

interface BarListProps {
  items: BarListItem[];
  /** 순위 번호 표시 */
  ranked?: boolean;
  /** 막대 길이 기준 최댓값 (기본: 항목 중 최댓값) */
  max?: number;
  color?: string;
  ariaLabel: string;
}

/** 순위·비중용 가로 막대 목록. 값은 막대 끝에 직접 표기한다 */
export function BarList({ items, ranked = false, max, color = BRAND.navy, ariaLabel }: BarListProps) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="space-y-2.5" aria-label={ariaLabel}>
      {items.map((item, i) => {
        const width = Math.max(0, Math.min(100, (item.value / top) * 100));
        return (
          <li key={item.key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-1.5">
                {ranked && <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>}
                <span className="truncate" title={item.sub ? `${item.label} (${item.sub})` : item.label}>
                  {item.label}
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">
                <span className="font-semibold">{item.valueText}</span>
                {item.extra && <span className="ml-1.5 text-xs text-muted-foreground">{item.extra}</span>}
              </span>
            </div>
            <div className={`mt-1 h-2 rounded-r bg-muted ${ranked ? "ml-[26px]" : ""}`}>
              <div
                className="h-2 rounded-r"
                style={{ width: `${width}%`, backgroundColor: item.color ?? color, minWidth: item.value > 0 ? 2 : 0 }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
