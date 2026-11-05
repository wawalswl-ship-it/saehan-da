import type { Metadata } from "next";
import { Suspense } from "react";
import { DATA_PERIOD_LABEL } from "@/lib/filters";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="bg-brand-navy px-6 py-5 text-white">
            <p className="text-xs font-medium tracking-wide text-white/75">One-Stop Packaging Partner</p>
            <h1 className="mt-1 text-lg font-bold tracking-tight">새한프라텍 생산·판매 분석</h1>
            <p className="mt-1 text-xs text-white/75">데이터 기간 {DATA_PERIOD_LABEL}</p>
          </div>
          <div className="px-6 py-6">
            <p className="mb-4 text-sm text-muted-foreground">사내 실적 데이터입니다. 발급받은 계정으로 로그인하세요.</p>
            {/* next 쿼리를 읽는 클라이언트 폼은 Suspense 안에서 렌더링 */}
            <Suspense fallback={<div className="skeleton h-56 w-full" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">계정 문의: 기술연구소</p>
      </div>
    </main>
  );
}
