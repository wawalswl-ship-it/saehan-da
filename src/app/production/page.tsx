import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PageSkeleton } from "@/components/kit/skeletons";
import { ChartCard } from "@/components/kit/chart-card";
import { BarList } from "@/components/charts/bar-list";
import { ComboChart } from "@/components/charts/combo-chart";
import { Heatmap, type HeatmapRow } from "@/components/charts/heatmap";
import { DEPT_CODES, parseFilters, periodLabel, slipLabel, type RawSearchParams } from "@/lib/filters";
import {
  BRAND,
  DEPT_COLORS,
  DEPT_NAMES,
  MONTH_LABELS,
  STATUS_COLORS,
  formatNumber,
  formatPct,
  ratioPct,
} from "@/lib/format";
import { getDeptMonthly, getMachineMonth, getShiftStats, getSlipComposition } from "@/lib/production-queries";
import type { TableData } from "@/lib/table-data";

export const metadata: Metadata = { title: "생산" };

type PageProps = { searchParams: Promise<RawSearchParams> };

export default function ProductionPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="생산"
      description="부서·호기·작업조 단위로 생산량과 불량률을 비교합니다."
      solves="지원팀의 작업조 인원 배치, 생산팀의 설비별 실적 파악"
    >
      <Suspense fallback={<PageSkeleton cards={4} />}>
        <ProductionContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function ProductionContent({ searchParams }: PageProps) {
  const f = parseFilters(await searchParams);
  const [deptMonthly, machineMonth, shifts, slips] = await Promise.all([
    getDeptMonthly(f),
    getMachineMonth(f),
    getShiftStats(f),
    getSlipComposition(f),
  ]);
  const period = periodLabel(f);

  // 1) 부서별 월별 누적 막대
  const months = [...new Set(deptMonthly.map((r) => r.ym))].sort();
  const stacked = months.map((ym) => {
    const row: Record<string, string | number> = { ym };
    for (const d of DEPT_CODES) row[d] = deptMonthly.find((r) => r.ym === ym && r.dept === d)?.qtyA ?? 0;
    return row;
  });
  const stackedTable: TableData = {
    columns: [
      { key: "ym", label: "연월" },
      ...DEPT_CODES.map((d) => ({ key: d, label: `${DEPT_NAMES[d]}(개)`, format: "int" as const })),
      { key: "total", label: "합계(개)", format: "int" },
    ],
    rows: stacked.map((r) => ({ ...r, total: DEPT_CODES.reduce((s, d) => s + Number(r[d]), 0) })),
  };
  const peGap =
    months.includes("2024-10") && months.includes("2024-12") && (f.depts.length === 0 || f.depts.includes("1212"))
      ? [{ x1: "2024-10", x2: "2024-12", label: "1212 실적 없음" }]
      : [];

  // 2) 호기 × 월 히트맵
  const machineMap = new Map<string, HeatmapRow & { total: number; totalC: number }>();
  for (const r of machineMonth) {
    const key = `${r.dept}-${r.machine}`;
    let row = machineMap.get(key);
    if (!row) {
      row = {
        key,
        label: `${r.dept} · ${r.machine}호기`,
        color: DEPT_COLORS[r.dept],
        values: { qty: {}, defect: {} },
        totals: {},
        total: 0,
        totalC: 0,
      };
      machineMap.set(key, row);
    }
    row.values.qty[String(r.month)] = r.qtyA;
    row.values.defect[String(r.month)] = ratioPct(r.qtyC, r.qtyA + r.qtyC);
    row.total += r.qtyA;
    row.totalC += r.qtyC;
  }
  const machineRows = [...machineMap.values()]
    .map((r) => ({ ...r, totals: { qty: r.total, defect: ratioPct(r.totalC, r.total + r.totalC) } }))
    .sort((a, b) => a.key.slice(0, 4).localeCompare(b.key.slice(0, 4)) || b.total - a.total);
  const machineTable: TableData = {
    columns: [
      { key: "dept", label: "부서" },
      { key: "machine", label: "호기" },
      { key: "month", label: "월", format: "int" },
      { key: "qtyA", label: "생산량(A급, 개)", format: "int" },
      { key: "qtyC", label: "불량(C급, 개)", format: "int" },
      { key: "rate", label: "불량률(%)", format: "pct" },
    ],
    rows: machineMonth.map((r) => ({
      dept: DEPT_NAMES[r.dept] ?? r.dept,
      machine: r.machine,
      month: r.month,
      qtyA: r.qtyA,
      qtyC: r.qtyC,
      rate: ratioPct(r.qtyC, r.qtyA + r.qtyC),
    })),
  };

  // 3) 작업조 비교
  const shiftNames = [...new Set(shifts.map((r) => r.shift))].sort();
  const shiftTotals = shiftNames.map((name) => {
    const rows = shifts.filter((r) => r.shift === name);
    const qtyA = rows.reduce((s, r) => s + r.qtyA, 0);
    const qtyC = rows.reduce((s, r) => s + r.qtyC, 0);
    const records = rows.reduce((s, r) => s + r.records, 0);
    return { name, qtyA, qtyC, records, rate: ratioPct(qtyC, qtyA + qtyC) ?? 0 };
  });
  const shiftTable: TableData = {
    columns: [
      { key: "shift", label: "작업조" },
      { key: "dept", label: "부서" },
      { key: "qtyA", label: "생산량(A급, 개)", format: "int" },
      { key: "qtyC", label: "불량(C급, 개)", format: "int" },
      { key: "rate", label: "불량률(%)", format: "pct" },
      { key: "records", label: "실적 건수", format: "int" },
    ],
    rows: shifts.map((r) => ({
      shift: r.shift,
      dept: DEPT_NAMES[r.dept] ?? r.dept,
      qtyA: r.qtyA,
      qtyC: r.qtyC,
      rate: ratioPct(r.qtyC, r.qtyA + r.qtyC),
      records: r.records,
    })),
  };

  // 4) 전표구분 구성
  const slipTotal = slips.reduce((s, r) => s + r.qtyA, 0);
  const slipTable: TableData = {
    columns: [
      { key: "slip", label: "전표구분" },
      { key: "qtyA", label: "A급(개)", format: "int" },
      { key: "share", label: "A급 비중(%)", format: "pct" },
      { key: "qtyC", label: "C급(개)", format: "int" },
      { key: "records", label: "실적 건수", format: "int" },
    ],
    rows: slips.map((r) => ({
      slip: r.slip,
      qtyA: r.qtyA,
      share: ratioPct(r.qtyA, slipTotal),
      qtyC: r.qtyC,
      records: r.records,
    })),
  };

  return (
    <>
      <ChartCard
        title="부서별 월별 생산량"
        description={`${period} · 생산량(A급) 누적 막대`}
        badges={[slipLabel(f)]}
        table={stackedTable}
        csvName="부서별_월별_생산량"
        note="1212 PE 팀은 2024년 10~12월 실적이 없으며, 2025년에는 소량만 생산했습니다(PRD: 축소 추세)."
      >
        <ComboChart
          data={stacked}
          xKey="ym"
          xKind="ym"
          kind="qty"
          unit="개"
          height={320}
          refAreas={peGap}
          series={DEPT_CODES.map((d) => ({
            key: d,
            label: DEPT_NAMES[d],
            type: "bar" as const,
            color: DEPT_COLORS[d],
            stackId: "dept",
          }))}
        />
      </ChartCard>

      <ChartCard
        title="호기 × 월 히트맵"
        description={`${period} · 생산량과 불량률을 전환해 볼 수 있습니다${f.year === null ? " · 월은 5개년 합산" : ""}`}
        badges={[slipLabel(f)]}
        table={machineTable}
        csvName="호기별_월별_생산_불량"
        tableToggle={false}
        note="색은 값의 크기를 보조로 나타내며, 정확한 값은 셀에 적혀 있습니다. 행 머리의 색 점은 부서 색입니다."
      >
        <Heatmap
          rowHeader="부서 · 호기"
          columns={MONTH_LABELS.map((label, i) => ({ key: String(i + 1), label }))}
          rows={machineRows}
          metrics={[
            { key: "qty", label: "생산량", kind: "qty", unit: "개", ramp: "navy" },
            { key: "defect", label: "불량률", kind: "pct", unit: "%", ramp: "red" },
          ]}
          totalLabel="기간 전체"
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="작업조별 생산량 · 불량률"
          description={`${period} · 작업조(A/B/C) 비교`}
          badges={[slipLabel(f)]}
          table={shiftTable}
          csvName="작업조별_생산_불량"
          note="생산량과 불량률은 단위가 달라 한 축에 겹치지 않고 나란히 표시합니다. 표 보기에서 부서별 내역을 확인할 수 있습니다."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">생산량(A급, 개)</h3>
              <BarList
                ariaLabel="작업조별 생산량"
                color={BRAND.navy}
                items={shiftTotals.map((s) => ({
                  key: s.name,
                  label: s.name,
                  value: s.qtyA,
                  valueText: `${formatNumber(s.qtyA)}개`,
                  extra: `${s.records.toLocaleString("ko-KR")}건`,
                }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">불량률(%)</h3>
              <BarList
                ariaLabel="작업조별 불량률"
                color={STATUS_COLORS.danger}
                items={shiftTotals.map((s) => ({
                  key: s.name,
                  label: s.name,
                  value: s.rate,
                  valueText: formatPct(s.rate),
                  extra: `C급 ${formatNumber(s.qtyC)}개`,
                }))}
              />
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="전표구분 구성"
          description={`${period} · A급 수량 기준 (전표구분 필터와 무관하게 전체 표시)`}
          table={slipTable}
          csvName="전표구분_구성"
          note="21 본가공입고가 실제 신규 생산이며, 22 재가공입고·32 재가공투입은 재가공 공정의 입고·투입 기록입니다. 세 전표를 합치면 같은 물량이 중복 집계될 수 있어 기본 집계는 21만 사용합니다."
        >
          <BarList
            ariaLabel="전표구분별 A급 수량과 비중"
            items={slips.map((r) => ({
              key: r.slip,
              label: r.slip,
              value: r.qtyA,
              valueText: `${formatNumber(r.qtyA)}개`,
              extra: formatPct(ratioPct(r.qtyA, slipTotal), 1),
            }))}
          />
        </ChartCard>
      </div>
    </>
  );
}
