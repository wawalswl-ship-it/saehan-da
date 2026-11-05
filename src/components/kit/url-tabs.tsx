"use client";

import { type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface UrlTabsProps {
  /** 탭 상태를 저장할 쿼리 키 */
  param?: string;
  tabs: { key: string; label: string; content: ReactNode }[];
  ariaLabel: string;
}

/** 선택한 탭을 URL 쿼리스트링에 저장해 공유 가능한 탭 */
export function UrlTabs({ param = "tab", tabs, ariaLabel }: UrlTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get(param);
  const active = tabs.find((t) => t.key === requested) ?? tabs[0];

  function select(key: string) {
    const usp = new URLSearchParams(searchParams.toString());
    if (key === tabs[0].key) usp.delete(param);
    else usp.set(param, key);
    const qs = usp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const selected = t.key === active.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`panel-${t.key}`}
              onClick={() => select(t.key)}
              className={`-mb-px h-10 shrink-0 whitespace-nowrap border-b-[3px] px-3 text-sm ${
                selected
                  ? "border-brand-navy font-semibold text-brand-navy-dark"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${active.key}`} aria-labelledby={`tab-${active.key}`} className="space-y-4 pt-4">
        {active.content}
      </div>
    </div>
  );
}
