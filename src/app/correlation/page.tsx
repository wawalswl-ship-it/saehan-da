import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { CorrelationPageClient } from "@/components/correlation/correlation-page-client";

export const metadata: Metadata = { title: "생산-판매 상관분석" };

export default function CorrelationPage() {
  return (
    <PageShell
      title="생산-판매 상관분석"
      description="생산량과 판매량의 상관관계와 시차(리드타임)를 분석합니다."
      solves="생산지원팀의 출하 예측 기반 생산계획 수립"
    >
      <p className="rounded-lg bg-brand-navy-soft px-3 py-2 text-sm text-brand-navy-dark">
        <strong className="font-semibold">매칭 품목 기준</strong> · 생산과 판매 양쪽에 있는 품종만으로 계산하며, 전체 기간(2021–2025)
        기준으로 공통 필터는 적용되지 않습니다. 이 분석은{" "}
        <Link href="/planning?tab=correlation" className="font-semibold underline underline-offset-2">
          생산계획 지원 › 상관·시차 분석
        </Link>{" "}
        탭에서도 볼 수 있습니다.
      </p>
      <CorrelationPageClient />
    </PageShell>
  );
}
