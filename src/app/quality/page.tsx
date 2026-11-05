import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PageSkeleton } from "@/components/kit/skeletons";
import { ChartCard } from "@/components/kit/chart-card";
import { KpiCard } from "@/components/kit/kpi-card";
import { ComboChart } from "@/components/charts/combo-chart";
import { DefectDrilldown } from "@/components/quality/defect-drilldown";
import {
  DEPT_CODES,
  filtersToQuery,
  parseFilters,
  periodLabel,
  slipLabel,
  type Filters,
  type RawSearchParams,
} from "@/lib/filters";
import { DEPT_COLORS, DEPT_NAMES, SERIES_COLORS, formatPct, ratioPct } from "@/lib/format";
import { getDefectMonthly } from "@/lib/quality-queries";
import { requireSession } from "@/lib/session";
import type { TableData } from "@/lib/table-data";

export const metadata: Metadata = { title: "품질" };

type PageProps = { searchParams: Promise<RawSearchParams> };

export default function QualityPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="품질"
      description="불량률 추이를 관리한계와 함께 보고, 불량이 많은 품목·호기·작업조를 찾습니다."
      solves="품질기술팀의 불량 원인 분석"
    >
      <Suspense fallback={<PageSkeleton kpis cards={2} />}>
        <QualityContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

function inPeriod(ym: string, f: Filters): boolean {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  if (f.year !== null && year !== f.year) return false;
  if (f.month) return month === f.month;
  if (f.quarter) return Math.ceil(month / 3) === f.quarter;
  return true;
}

async function QualityContent({ searchParams }: PageProps) {
  await requireSession();
  const f = parseFilters(await searchParams);
  const rows = await getDefectMonthly(f);
  const period = periodLabel(f);

  // 월별 전체·부서별 불량률
  const byMonth = new Map<string, { a: number; c: number; dept: Record<string, { a: number; c: number }> }>();
  for (const r of rows) {
    const m = byMonth.get(r.ym) ?? { a: 0, c: 0, dept: {} };
    m.a += r.qtyA;
    m.c += r.qtyC;
    m.dept[r.dept] = { a: r.qtyA, c: r.qtyC };
    byMonth.set(r.ym, m);
  }
  const all = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, m]) => {
      const point: Record<string, string | number | null> = { ym, all: ratioPct(m.c, m.a + m.c), qtyA: m.a, qtyC: m.c };
      for (const d of DEPT_CODES) {
        const v = m.dept[d];
        point[`d${d}`] = v ? ratioPct(v.c, v.a + v.c) : null;
      }
      return point;
    });

  // 관리한계: 전체 기간(2021–2025) 월별 불량률의 평균 ± 3σ
  const baseline = all.map((p) => p.all).filter((v): v is number => typeof v === "number");
  const mean = baseline.length ? baseline.reduce((s, v) => s + v, 0) / baseline.length : 0;
  const sd =
    baseline.length > 1
      ? Math.sqrt(baseline.reduce((s, v) => s + (v - mean) ** 2, 0) / (baseline.length - 1))
      : 0;
  const ucl = mean + 3 * sd;
  const lcl = Math.max(0, mean - 3 * sd);

  const shown = all.filter((p) => inPeriod(String(p.ym), f));
  const outOfControl = shown.filter((p) => typeof p.all === "number" && (p.all > ucl || p.all < lcl));
  const periodA = shown.reduce((s, p) => s + Number(p.qtyA), 0);
  const periodC = shown.reduce((s, p) => s + Number(p.qtyC), 0);
  const periodRate = ratioPct(periodC, periodA + periodC);

  const table: TableData = {
    columns: [
      { key: "ym", label: "연월" },
      { key: "all", label: "전체 불량률(%)", format: "pct" },
      ...DEPT_CODES.map((d) => ({ key: `d${d}`, label: `${DEPT_NAMES[d]}(%)`, format: "pct" as const })),
      { key: "qtyA", label: "A급(개)", format: "int" },
      { key: "qtyC", label: "C급(개)", format: "int" },
      { key: "status", label: "관리한계" },
    ],
    rows: shown.map((p) => ({
      ...p,
      status: typeof p.all !== "number" ? "-" : p.all > ucl ? "상한 초과" : p.all < lcl ? "하한 미만" : "관리 내",
    })),
  };

  const visibleDepts = f.depts.length ? DEPT_CODES.filter((d) => f.depts.includes(d)) : [...DEPT_CODES];

  return (
    <>
      <section aria-label={`${period} 품질 지표`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="기간 불량률"
          value={formatPct(periodRate)}
          deltaFallback={period}
          basis={`C급 ÷ (A급 + C급) · ${slipLabel(f)}`}
        />
        <KpiCard label="중심선(평균)" value={formatPct(mean)} deltaFallback="2021–2025 월별 평균" basis="관리도 CL" />
        <KpiCard label="관리상한(UCL)" value={formatPct(ucl)} deltaFallback="평균 + 3σ" basis={`σ = ${sd.toFixed(3)}%p`} />
        <KpiCard
          label="관리한계 이탈"
          value={String(outOfControl.length)}
          unit="개월"
          deltaFallback={outOfControl.length === 0 ? "이탈 없음" : outOfControl.map((p) => p.ym).join(", ")}
          basis={`${period} 중`}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="월별 불량률 관리도"
          description={`${period} · 전체 불량률과 관리한계(평균 ± 3σ)`}
          badges={[slipLabel(f), "관리한계 = 평균 ± 3σ"]}
          table={table}
          csvName="월별_불량률_관리한계"
          note={
            <>
              관리한계는 연/분기/월 필터와 무관하게 2021–2025년 전체 월별 불량률로 계산합니다 (CL {formatPct(mean)}, UCL{" "}
              {formatPct(ucl)}, LCL {formatPct(lcl)}).{" "}
              {outOfControl.length > 0
                ? `관리한계를 벗어난 달: ${outOfControl.map((p) => `${p.ym}(${formatPct(p.all as number)})`).join(", ")}.`
                : "표시 기간에 관리한계를 벗어난 달은 없습니다."}
            </>
          }
        >
          <ComboChart
            data={shown}
            xKey="ym"
            xKind="ym"
            kind="pct"
            unit="%"
            height={300}
            refLines={[
              { y: ucl, label: `UCL ${formatPct(ucl)}`, tone: "danger" },
              { y: mean, label: `CL ${formatPct(mean)}` },
              ...(lcl > 0 ? [{ y: lcl, label: `LCL ${formatPct(lcl)}`, tone: "danger" as const }] : []),
            ]}
            series={[{ key: "all", label: "전체 불량률", type: "line", color: SERIES_COLORS.production, emphasis: true }]}
          />
        </ChartCard>

        <ChartCard
          title="부서별 월별 불량률"
          description={`${period} · 부서별 C급 ÷ (A급 + C급)`}
          badges={[slipLabel(f)]}
          table={table}
          csvName="부서별_월별_불량률"
          note="1212 PE 팀은 생산량이 적어 불량률 변동 폭이 크고, 2024년 10~12월은 실적이 없어 선이 끊깁니다. 부서 간 척도 차이가 커서 관리도와 분리해 표시합니다."
        >
          <ComboChart
            data={shown}
            xKey="ym"
            xKind="ym"
            kind="pct"
            unit="%"
            height={300}
            series={visibleDepts.map((d) => ({
              key: `d${d}`,
              label: DEPT_NAMES[d],
              type: "line" as const,
              color: DEPT_COLORS[d],
            }))}
          />
        </ChartCard>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <header className="mb-3">
          <h2 className="text-[15px] font-semibold">불량률 상위 드릴다운</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {period} · {slipLabel(f)} · 불량률 내림차순. 소량 생산 품목이 상위를 차지하지 않도록 최소 생산량 기준을 둡니다.
          </p>
        </header>
        <DefectDrilldown filterQuery={filtersToQuery(f)} />
      </section>
    </>
  );
}
