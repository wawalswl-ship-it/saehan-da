"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { FILTER_KEYS } from "@/lib/filters";

export const NAV_LINKS = [
  { href: "/", label: "종합 현황" },
  { href: "/production", label: "생산" },
  { href: "/sales", label: "판매" },
  { href: "/quality", label: "품질" },
  { href: "/planning", label: "생산계획 지원" },
  { href: "/logistics", label: "물류" },
  { href: "/analysis", label: "자유 분석" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // 기존 /correlation 은 생산계획 지원의 하위 기능
  if (href === "/planning" && pathname.startsWith("/correlation")) return true;
  return pathname.startsWith(href);
}

/** 페이지를 옮겨도 공통 필터(쿼리스트링)는 유지한다 */
function useFilterQuery(): string {
  const searchParams = useSearchParams();
  const usp = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    for (const v of searchParams.getAll(key)) usp.append(key, v);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export function SiteHeader({ userSlot }: { userSlot?: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const query = useFilterQuery();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 bg-brand-navy text-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        {!isLogin && (
        <button
          type="button"
          className="-ml-2 inline-flex size-10 items-center justify-center rounded-md hover:bg-white/10 lg:hidden"
          aria-label="메뉴 열기"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" aria-hidden />
        </button>
        )}

        <Link href={isLogin ? "/login" : `/${query}`} className="flex shrink-0 items-baseline gap-2">
          <span className="text-base font-bold tracking-tight">새한프라텍</span>
          <span className="hidden text-[11px] font-medium tracking-wide text-white/70 sm:inline">
            One-Stop Packaging Partner
          </span>
        </Link>

        <nav aria-label="주 메뉴" className="ml-4 hidden h-full items-stretch gap-1 lg:flex">
          {(isLogin ? [] : NAV_LINKS).map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={`${link.href}${query}`}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center px-3 text-sm transition-colors ${
                  active
                    ? "font-semibold text-white after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t after:bg-white"
                    : "text-white/75 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">{userSlot}</div>
      </div>

      {/* 모바일 드로어 */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="메뉴">
          <button
            type="button"
            aria-label="메뉴 닫기"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white text-foreground shadow-xl">
            <div className="flex h-14 items-center justify-between bg-brand-navy px-4 text-white">
              <span className="font-bold">새한프라텍</span>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-md hover:bg-white/10"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto p-2">
              {NAV_LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={`${link.href}${query}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center rounded-md border-l-[3px] px-3 text-[15px] ${
                      active
                        ? "border-brand-navy bg-brand-navy-soft font-semibold text-brand-navy-dark"
                        : "border-transparent text-foreground hover:bg-muted"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">One-Stop Packaging Partner</p>
          </div>
        </div>
      )}
    </header>
  );
}
