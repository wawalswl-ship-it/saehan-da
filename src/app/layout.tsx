import type { Metadata } from "next";
import { Suspense } from "react";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { FilterBar, FilterBarFallback } from "@/components/layout/filter-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { UserMenu } from "@/components/layout/user-menu";

export const metadata: Metadata = {
  title: {
    default: "새한프라텍 생산·판매 분석",
    template: "%s | 새한프라텍 생산·판매 분석",
  },
  description: "새한프라텍 생산·판매 실적(2021–2025) 분석 대시보드",
};

function HeaderFallback() {
  return (
    <div className="sticky top-0 z-40 h-14 bg-brand-navy text-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <span className="text-base font-bold tracking-tight">새한프라텍</span>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
        >
          본문으로 건너뛰기
        </a>
        {/* URL 쿼리를 읽는 클라이언트 컴포넌트는 Suspense 안에서 렌더링 */}
        <Suspense fallback={<HeaderFallback />}>
          <SiteHeader
            userSlot={
              <Suspense fallback={null}>
                <UserMenu />
              </Suspense>
            }
          />
        </Suspense>
        <Suspense fallback={<FilterBarFallback />}>
          <FilterBar />
        </Suspense>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
