import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { CardSkeleton } from "@/components/kit/skeletons";
import { AnalysisPageClient } from "@/components/analysis/analysis-page-client";

export const metadata: Metadata = { title: "자유 분석" };

export default function AnalysisPage() {
  return (
    <PageShell
      title="자유 분석"
      description="생산·판매 실적을 원하는 차원으로 묶어 피벗 표와 차트로 보고, CSV로 내려받습니다."
      solves="기술연구소의 ERP 데이터 수작업 집계"
    >
      <Suspense fallback={<CardSkeleton height={360} />}>
        <AnalysisPageClient />
      </Suspense>
    </PageShell>
  );
}
