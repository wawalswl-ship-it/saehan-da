import type { Metadata } from "next";
import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { PageSkeleton } from "@/components/kit/skeletons";
import { ChartCard } from "@/components/kit/chart-card";
import { KpiCard } from "@/components/kit/kpi-card";
import { UrlTabs } from "@/components/kit/url-tabs";
import { ComboChart } from "@/components/charts/combo-chart";
import { CorrelationPageClient } from "@/components/correlation/correlation-page-client";
import { PlanningItems } from "@/components/planning/planning-items";
import { filtersToQuery, parseFilters, type RawSearchParams } from "@/lib/filters";
import { SERIES_COLORS, formatFullNumber, formatNumber } from "@/lib/format";
import { FORECAST_MONTHS, getPlanningData } from "@/lib/planning-queries";
import type { TableData } from "@/lib/table-data";

export const metadata: Metadata = { title: "생산계획 지원" };

type PageProps = { searchParams: Promise<RawSearchParams> };

export default function PlanningPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="생산계획 지원"
      description="품목별 수요 예측과 재고 추이 추정으로 생산계획 수립을 돕습니다."
      solves="생산지원팀의 수작업 생산계획 수립과 재고 부족 예측"
    >
      <Suspense fallback={<PageSkeleton cards={2} />}>
        <PlanningContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

function EstimateNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm text-foreground"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden />
      <span>
        <strong className="font-semibold">참고용 추정치</strong> · {children}
      </span>
    </p>
  );
}

async function PlanningContent({ searchParams }: PageProps) {
  const f = parseFilters(await searchParams);
  const data = await getPlanningData(f);
  const filterQuery = filtersToQuery(f);
  const forecastTotal = data.totalSeries.filter((p) => p.actual === null).reduce((s, p) => s + (p.forecast ?? 0), 0);

  const totalTable: TableData = {
    columns: [
      { key: "ym", label: "연월" },
      { key: "actual", label: "순판매 실적(개)", format: "int" },
      { key: "forecast", label: "수요 예측(개)", format: "int" },
    ],
    rows: data.totalSeries.map((p) => ({ ym: p.ym, actual: p.actual, forecast: p.actual === null ? p.forecast : null })),
  };

  const inventoryTable: TableData = {
    columns: [
      { key: "ym", label: "연월" },
      { key: "production", label: "순입고(개)", format: "int" },
      { key: "sales", label: "순판매(개)", format: "int" },
      { key: "flow", label: "순입고 − 순판매(개)", format: "int" },
      { key: "cumulative", label: "누적(추정 재고, 개)", format: "int" },
    ],
    rows: data.inventorySeries.map((p) => ({ ...p })),
  };

  const riskItems = data.items
    .filter((i) => i.risk === "shortage" || i.risk === "low")
    .sort((a, b) => b.forecastSum - (b.estInventory ?? 0) - (a.forecastSum - (a.estInventory ?? 0)));
  const shortageCount = riskItems.filter((i) => i.risk === "shortage").length;
  const lowCount = riskItems.length - shortageCount;
  const unknownCount = data.items.filter((i) => i.risk === "unknown").length;
  const lastInventory = data.inventorySeries.at(-1)?.cumulative ?? 0;

  const forecastTab = (
    <>
      <EstimateNotice>
        예측 = 최근 12개월 월평균 × 계절지수(최근 3년) × 추세 보정(최근 12개월 ÷ 직전 12개월, ±30% 제한). 수주·프로모션·신제품 등
        계획 정보는 반영하지 않으므로 실제 생산계획은 영업 정보와 함께 판단해야 합니다.
      </EstimateNotice>
      <ChartCard
        title="전체 순판매 실적과 향후 3개월 수요 예측"
        description={`최근 24개월 실적 + ${FORECAST_MONTHS[0]}–${FORECAST_MONTHS[2]} 예측 · 연/분기/월 필터 미적용`}
        badges={["참고용 추정치"]}
        table={totalTable}
        csvName="전체_수요예측_참고용"
        note={`향후 3개월 예측 합계 ${formatFullNumber(forecastTotal)}개${
          data.totalTrendPct === null
            ? ""
            : ` · 최근 12개월은 직전 12개월 대비 ${data.totalTrendPct >= 0 ? "▲" : "▼"} ${Math.abs(data.totalTrendPct).toFixed(1)}%`
        }. 점선이 예측 구간입니다.`}
      >
        <ComboChart
          data={data.totalSeries}
          xKey="ym"
          xKind="ym"
          kind="qty"
          unit="개"
          height={300}
          series={[
            { key: "actual", label: "순판매 실적", type: "line", color: SERIES_COLORS.production, emphasis: true },
            { key: "forecast", label: "수요 예측(참고용)", type: "line", color: SERIES_COLORS.returned, dashed: true },
          ]}
        />
      </ChartCard>
      <section className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <header className="mb-3">
          <h2 className="text-[15px] font-semibold">품목별 수요 예측</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            최근 12개월 순판매 상위 {data.items.length.toLocaleString("ko-KR")}개 품번 · 품목명을 누르면 월별 추이를 볼 수 있습니다.
          </p>
        </header>
        <PlanningItems items={data.items} mode="forecast" forecastMonths={FORECAST_MONTHS} filterQuery={filterQuery} />
      </section>
    </>
  );

  const inventoryTab = (
    <>
      <EstimateNotice>
        ERP에 재고 수량이 없어 2021년 1월 재고를 0으로 가정하고 월별 (순입고 − 순판매)를 누적한 값입니다. 순입고 = 본가공입고(21) +
        재가공입고(22) − 재가공투입(32). 기초 재고·외주 입고·폐기는 반영되지 않아 실제 재고와 다를 수 있습니다.
      </EstimateNotice>
      <section aria-label="재고 추정 요약" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="추정 누적 재고"
          value={formatNumber(lastInventory)}
          unit="개"
          exact={`${formatFullNumber(lastInventory)}개`}
          deltaFallback="2025년 12월 말 기준"
          basis="매칭 품목 기준"
        />
        <KpiCard label="부족 위험 품목" value={String(shortageCount)} unit="개" deltaFallback="추정 재고 ≤ 0" basis="향후 수요가 있는 품목" />
        <KpiCard label="주의 품목" value={String(lowCount)} unit="개" deltaFallback="커버 1개월 미만" basis="추정 재고 ÷ 월평균 예측" />
        <KpiCard label="추정 불가 품목" value={String(unknownCount)} unit="개" deltaFallback="생산 실적 없음" basis="외주·부자재 등" />
      </section>
      <ChartCard
        title="월별 (순입고 − 순판매)와 누적 재고 추정"
        description="2021–2025 · 연/분기/월 필터 미적용"
        badges={["매칭 품목 기준", "순입고 = 전표 21 + 22 − 32", "기초 재고 0 가정"]}
        table={inventoryTable}
        csvName="재고_추이_추정_참고용"
        note="막대는 그 달의 (순입고 − 순판매), 선은 2021년 1월부터의 누적입니다. 누적선이 내려가는 구간은 판매가 입고를 앞선 기간입니다. 전표구분 필터와 무관하게 계산합니다."
      >
        <ComboChart
          data={data.inventorySeries}
          xKey="ym"
          xKind="ym"
          kind="qty"
          unit="개"
          height={320}
          series={[
            { key: "flow", label: "순입고 − 순판매(월)", type: "bar", color: SERIES_COLORS.sales },
            { key: "cumulative", label: "누적(추정 재고)", type: "line", color: SERIES_COLORS.production, emphasis: true },
          ]}
        />
      </ChartCard>
      <section className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <header className="mb-3">
          <h2 className="text-[15px] font-semibold">재고 부족 위험 품목</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            추정 재고가 향후 3개월 예측 수요의 1개월분에 못 미치는 품목 · 부족분이 큰 순 · 커버(개월) = 추정 재고 ÷ 월평균 예측
          </p>
        </header>
        <PlanningItems items={riskItems} mode="risk" forecastMonths={FORECAST_MONTHS} filterQuery={filterQuery} />
      </section>
    </>
  );

  const correlationTab = (
    <>
      <p className="rounded-lg bg-brand-navy-soft px-3 py-2 text-sm text-brand-navy-dark">
        <strong className="font-semibold">매칭 품목 기준</strong> · 생산과 판매 양쪽에 있는 품종만으로 상관계수·시차(리드타임)를
        계산합니다. 이 탭은 전체 기간(2021–2025) 기준이며 공통 필터가 적용되지 않습니다.
      </p>
      <CorrelationPageClient />
    </>
  );

  return (
    <UrlTabs
      ariaLabel="생산계획 지원 메뉴"
      tabs={[
        { key: "forecast", label: "수요 예측", content: forecastTab },
        { key: "inventory", label: "재고 추정", content: inventoryTab },
        { key: "correlation", label: "상관·시차 분석", content: correlationTab },
      ]}
    />
  );
}
