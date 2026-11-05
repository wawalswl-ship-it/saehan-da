import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PageSkeleton } from "@/components/kit/skeletons";
import { ChartCard } from "@/components/kit/chart-card";
import { DataTable } from "@/components/kit/data-table";
import { KpiCard, pctDelta, pointDelta } from "@/components/kit/kpi-card";
import { BarList } from "@/components/charts/bar-list";
import { ComboChart } from "@/components/charts/combo-chart";
import { SeasonalityChart } from "@/components/charts/seasonality-chart";
import {
  DATA_PERIOD_LABEL,
  FIRST_YEAR,
  YEARS,
  parseFilters,
  periodLabel,
  prevYearFilters,
  slipLabel,
  type RawSearchParams,
} from "@/lib/filters";
import {
  DEPT_COLORS,
  DEPT_NAMES,
  MONTH_LABELS,
  SERIES_COLORS,
  formatFullNumber,
  formatNumber,
  formatPct,
  ratioPct,
} from "@/lib/format";
import {
  getDeptShare,
  getKpis,
  getMonthlyByYear,
  getPrdSummary,
  getTopCustomers,
  getTopProducts,
  getYearlyMatched,
  type TopRow,
} from "@/lib/overview-queries";
import { requireSession } from "@/lib/session";
import type { TableData } from "@/lib/table-data";

type PageProps = { searchParams: Promise<RawSearchParams> };

function Banner() {
  return (
    <div className="bg-brand-navy-dark text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <span className="font-semibold">새한프라텍 생산·판매 분석</span>
        <span className="text-xs text-white/80">데이터 기간 {DATA_PERIOD_LABEL}</span>
      </div>
    </div>
  );
}

export default function OverviewPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="종합 현황"
      description="생산·판매 핵심 지표와 5개년 추세를 한 화면에서 확인합니다."
      solves="기술연구소의 ERP 데이터 수작업 집계"
      banner={<Banner />}
    >
      <Suspense fallback={<PageSkeleton kpis cards={4} />}>
        <OverviewContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

function yoyExtra(row: TopRow): string | undefined {
  if (row.prev === null) return undefined;
  if (row.prev === 0) return "전년 실적 없음";
  const pct = ((row.value - row.prev) / Math.abs(row.prev)) * 100;
  return `전년 대비 ${pct > 0 ? "▲" : pct < 0 ? "▼" : "–"} ${Math.abs(pct).toFixed(1)}%`;
}

async function OverviewContent({ searchParams }: PageProps) {
  await requireSession();
  const f = parseFilters(await searchParams);
  const prevF = prevYearFilters(f);

  const [kpi, prevKpi, yearly, monthly, deptShare, topCustomers, topProducts, prd] = await Promise.all([
    getKpis(f),
    prevF ? getKpis(prevF) : Promise.resolve(null),
    getYearlyMatched(f),
    getMonthlyByYear(f),
    getDeptShare(f),
    getTopCustomers(f, prevF),
    getTopProducts(f, prevF),
    getPrdSummary(),
  ]);

  const period = periodLabel(f);
  const noPrevText =
    f.year === null ? "전체 기간: 전년 대비 없음" : f.year <= FIRST_YEAR ? `${f.year}년: 전년 데이터 없음` : "전년 실적 없음";

  const defect = ratioPct(kpi.qtyC, kpi.qtyA + kpi.qtyC);
  const prevDefect = prevKpi ? ratioPct(prevKpi.qtyC, prevKpi.qtyA + prevKpi.qtyC) : null;
  const net = kpi.normal + kpi.returned;
  const prevNet = prevKpi ? prevKpi.normal + prevKpi.returned : null;
  const returnRate = ratioPct(Math.abs(kpi.returned), kpi.normal);
  const prevReturnRate = prevKpi ? ratioPct(Math.abs(prevKpi.returned), prevKpi.normal) : null;

  // 연도별 생산 vs 판매 (매칭 품목)
  const yearlyData = yearly.map((r) => ({ year: `${r.year}년`, production: r.production, sales: r.sales }));
  const yearlyTable: TableData = {
    columns: [
      { key: "year", label: "연도" },
      { key: "production", label: "생산량(A급, 개)", format: "int" },
      { key: "sales", label: "순판매(개)", format: "int" },
      { key: "ratio", label: "판매/생산(%)", format: "pct" },
    ],
    rows: yearly.map((r) => ({
      year: r.year,
      production: r.production,
      sales: r.sales,
      ratio: ratioPct(r.sales, r.production),
    })),
  };

  // 5개년 월별 겹침
  const seasonalData = MONTH_LABELS.map((label, i) => {
    const row: Record<string, string | number | null> = { month: label };
    for (const y of YEARS) {
      const hit = monthly.find((r) => r.year === y && r.month === i + 1);
      row[`s${y}`] = hit ? hit.sales : null;
      row[`p${y}`] = hit ? hit.production : null;
    }
    return row;
  });
  const seasonalTable: TableData = {
    columns: [
      { key: "month", label: "월" },
      ...YEARS.map((y) => ({ key: `s${y}`, label: `${y} 순판매(개)`, format: "int" as const })),
      ...YEARS.map((y) => ({ key: `p${y}`, label: `${y} 생산량(개)`, format: "int" as const })),
    ],
    rows: monthly.length ? seasonalData : [],
  };

  // 부서별 비중
  const deptTotal = deptShare.reduce((s, r) => s + r.qtyA, 0);
  const deptTable: TableData = {
    columns: [
      { key: "dept", label: "부서" },
      { key: "qtyA", label: "생산량(A급, 개)", format: "int" },
      { key: "share", label: "비중(%)", format: "pct" },
    ],
    rows: deptShare.map((r) => ({
      dept: DEPT_NAMES[r.dept] ?? r.dept,
      qtyA: r.qtyA,
      share: ratioPct(r.qtyA, deptTotal),
    })),
  };

  const topTable = (rows: TopRow[], nameLabel: string): TableData => ({
    columns: [
      { key: "rank", label: "순위", format: "int" },
      { key: "name", label: nameLabel },
      { key: "value", label: "순판매(개)", format: "int" },
      { key: "prev", label: "전년 동기(개)", format: "int" },
    ],
    rows: rows.map((r, i) => ({ rank: i + 1, name: r.name?.trim() ?? r.key, value: r.value, prev: r.prev })),
  });

  // PRD 2.5 검증용 요약
  const prdTable: TableData = {
    columns: [
      { key: "year", label: "연도" },
      { key: "qtyAAll", label: "생산 A급(개)", format: "int" },
      { key: "defectPrd", label: "불량률 C÷A(%)", format: "pct" },
      { key: "net", label: "순판매(개)", format: "int" },
      { key: "normal", label: "정상출고(개)", format: "int" },
      { key: "returned", label: "반품(개)", format: "int" },
      { key: "productTypes", label: "품종 수", format: "int" },
      { key: "customers", label: "거래선 수", format: "int" },
      { key: "qtyA21", label: "(참고) 전표 21 A급(개)", format: "int" },
      { key: "defect21", label: "(참고) 전표 21 불량률 C÷(A+C)(%)", format: "pct" },
    ],
    rows: prd.map((r) => ({
      year: r.year,
      qtyAAll: r.qtyAAll,
      defectPrd: ratioPct(r.qtyCAll, r.qtyAAll),
      net: r.net,
      normal: r.normal,
      returned: r.returned,
      productTypes: r.productTypes,
      customers: r.customers,
      qtyA21: r.qtyA21,
      defect21: ratioPct(r.qtyC21, r.qtyA21 + r.qtyC21),
    })),
  };

  return (
    <>
      <section aria-label={`${period} 핵심 지표`} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="생산량"
          value={formatNumber(kpi.qtyA)}
          unit="개"
          exact={`${formatFullNumber(kpi.qtyA)}개`}
          delta={pctDelta(kpi.qtyA, prevKpi?.qtyA)}
          deltaFallback={noPrevText}
          basis={`A급 · ${slipLabel(f)}`}
        />
        <KpiCard
          label="불량률"
          value={formatPct(defect)}
          exact={`C급 ${formatFullNumber(kpi.qtyC)}개`}
          delta={pointDelta(defect, prevDefect, false)}
          deltaFallback={noPrevText}
          basis="C급 ÷ (A급 + C급)"
        />
        <KpiCard
          label="순판매"
          value={formatNumber(net)}
          unit="개"
          exact={`${formatFullNumber(net)}개`}
          delta={pctDelta(net, prevNet)}
          deltaFallback={noPrevText}
          basis="정상 + 반품(음수)"
        />
        <KpiCard
          label="반품률"
          value={formatPct(returnRate)}
          exact={`반품 ${formatFullNumber(Math.abs(kpi.returned))}개`}
          delta={pointDelta(returnRate, prevReturnRate, false)}
          deltaFallback={noPrevText}
          basis="|반품| ÷ 정상"
        />
        <KpiCard
          label="품종 수"
          value={formatFullNumber(kpi.productTypes)}
          unit="종"
          delta={pctDelta(kpi.productTypes, prevKpi?.productTypes)}
          deltaFallback={noPrevText}
          basis="판매 품종 기준"
        />
        <KpiCard
          label="거래선 수"
          value={formatFullNumber(kpi.customers)}
          unit="곳"
          delta={pctDelta(kpi.customers, prevKpi?.customers)}
          deltaFallback={noPrevText}
          basis="판매 거래선 기준"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="연도별 생산 vs 판매"
          description="2021–2025 · 연/분기/월 필터 미적용"
          badges={["매칭 품목 기준", slipLabel(f)]}
          table={yearlyTable}
          csvName="연도별_생산_판매_매칭품목"
          note="판매실적에는 캡·라벨 등 부자재가 포함되어 전체 수량을 직접 비교할 수 없습니다. 생산·판매 양쪽에 같은 품번이 있는 품목만 집계했습니다."
        >
          <ComboChart
            data={yearlyData}
            xKey="year"
            kind="qty"
            unit="개"
            series={[
              { key: "production", label: "생산량(A급)", type: "bar", color: SERIES_COLORS.production },
              { key: "sales", label: "순판매", type: "bar", color: SERIES_COLORS.sales },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="5개년 월별 겹침 추이 (계절성)"
          description="같은 달을 연도별로 겹쳐 본 추이 · 연/분기/월 필터 미적용"
          table={seasonalTable}
          csvName="5개년_월별_추이"
          note="진할수록 최근 연도이며 2025년을 굵게 표시합니다. 판매는 부자재 포함 전체 순판매입니다."
        >
          <SeasonalityChart data={seasonalData} />
        </ChartCard>

        <ChartCard
          title="부서별 생산 비중"
          description={`${period} · 생산량(A급)`}
          badges={[slipLabel(f)]}
          table={deptTable}
          csvName="부서별_생산_비중"
          note="1212 PE 팀은 2024년 10~12월 실적이 없고, 2025년에는 소량만 생산했습니다."
        >
          <BarList
            ariaLabel="부서별 생산량과 비중"
            items={deptShare.map((r) => ({
              key: r.dept,
              label: DEPT_NAMES[r.dept] ?? r.dept,
              value: r.qtyA,
              valueText: `${formatNumber(r.qtyA)}개`,
              extra: formatPct(ratioPct(r.qtyA, deptTotal), 1),
              color: DEPT_COLORS[r.dept],
            }))}
          />
        </ChartCard>

        <ChartCard
          title="TOP 10 거래선"
          description={`${period} · 순판매 기준`}
          table={topTable(topCustomers, "거래선")}
          csvName="TOP10_거래선"
        >
          <BarList
            ranked
            ariaLabel="순판매 상위 10개 거래선"
            items={topCustomers.map((r) => ({
              key: r.key,
              label: r.name,
              value: r.value,
              valueText: `${formatNumber(r.value)}개`,
              extra: yoyExtra(r),
            }))}
          />
        </ChartCard>

        <ChartCard
          title="TOP 10 품목"
          description={`${period} · 순판매 기준 (품번)`}
          table={topTable(topProducts, "품목")}
          csvName="TOP10_품목"
          className="lg:col-span-2"
        >
          <BarList
            ranked
            ariaLabel="순판매 상위 10개 품목"
            items={topProducts.map((r) => ({
              key: r.key,
              label: r.name?.trim() || r.key,
              sub: r.key,
              value: r.value,
              valueText: `${formatNumber(r.value)}개`,
              extra: yoyExtra(r),
            }))}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="연도별 실적 요약 (PRD 2.5 기준)"
        description="필터 미적용 · 생산은 전표 21·22·32 전체 합계, 불량률은 C급 ÷ A급 — PRD 2.5 표와 같은 기준"
        table={prdTable}
        csvName="연도별_실적_요약_PRD기준"
        tableToggle={false}
        note="위 KPI 카드는 데이터 규칙(전표 21 기본, 불량률 = C급 ÷ (A급 + C급))을 따르므로 이 표와 수치가 다릅니다. 필터에서 전표구분 3개를 모두 선택하면 생산량이 이 표의 '생산 A급'과 같아집니다."
      >
        <DataTable table={prdTable} />
      </ChartCard>
    </>
  );
}
