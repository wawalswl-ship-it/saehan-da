import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PageSkeleton } from "@/components/kit/skeletons";
import { ChartCard } from "@/components/kit/chart-card";
import { KpiCard } from "@/components/kit/kpi-card";
import { PagedTable } from "@/components/kit/paged-table";
import { BarList } from "@/components/charts/bar-list";
import { ComboChart } from "@/components/charts/combo-chart";
import { filtersToQuery, parseFilters, periodLabel, type RawSearchParams } from "@/lib/filters";
import { SERIES_COLORS, WEEKDAY_LABELS, formatFullNumber, formatNumber, formatPct, ratioPct } from "@/lib/format";
import { getPackUnitShare, getShipmentSeries, getVehicleStats, getWeekdayStats } from "@/lib/logistics-queries";
import type { TableColumn, TableData } from "@/lib/table-data";

export const metadata: Metadata = { title: "물류" };

type PageProps = { searchParams: Promise<RawSearchParams> };

const VEHICLE_COLUMNS: TableColumn[] = [
  { key: "vehicle", label: "차량번호" },
  { key: "trips", label: "운행 횟수(회)", format: "int" },
  { key: "days", label: "운행 일수(일)", format: "int" },
  { key: "qty", label: "출고수량(개)", format: "int" },
  { key: "avgQty", label: "회당 평균 출고수량(개)", format: "int" },
];

export default function LogisticsPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="물류"
      description="출고 건수·수량의 일자·요일 패턴과 차량별 운행 현황을 확인합니다."
      solves="생산지원팀·영업팀의 차량 배차와 적재 계획"
    >
      <Suspense fallback={<PageSkeleton kpis cards={4} />}>
        <LogisticsContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function LogisticsContent({ searchParams }: PageProps) {
  const f = parseFilters(await searchParams);
  const [series, weekdays, topVehicles, packUnits] = await Promise.all([
    getShipmentSeries(f),
    getWeekdayStats(f),
    getVehicleStats(f, 16, 0),
    getPackUnitShare(f),
  ]);
  const period = periodLabel(f);
  const grainLabel = series.grain === "day" ? "일자별" : "월별";

  const totalSlips = weekdays.reduce((s, r) => s + r.slips, 0);
  const totalQty = weekdays.reduce((s, r) => s + r.qty, 0);
  const totalDays = weekdays.reduce((s, r) => s + r.days, 0);

  const seriesTable: TableData = {
    columns: [
      { key: "period", label: series.grain === "day" ? "출고일자" : "연월" },
      { key: "slips", label: "출고 건수(건)", format: "int" },
      { key: "qty", label: "출고수량(개)", format: "int" },
    ],
    rows: series.rows.map((r) => ({ ...r })),
  };

  // 요일별: 출고일 1일당 평균
  const weekdayStats = weekdays.map((r) => ({
    key: String(r.dow),
    label: `${WEEKDAY_LABELS[r.dow]}요일`,
    days: r.days,
    slips: r.slips,
    qty: r.qty,
    avgSlips: r.days > 0 ? r.slips / r.days : 0,
    avgQty: r.days > 0 ? r.qty / r.days : 0,
  }));
  const weekdayTable: TableData = {
    columns: [
      { key: "label", label: "요일" },
      { key: "days", label: "출고일수(일)", format: "int" },
      { key: "slips", label: "출고 건수(건)", format: "int" },
      { key: "avgSlips", label: "일평균 건수(건)", format: "dec2" },
      { key: "qty", label: "출고수량(개)", format: "int" },
      { key: "avgQty", label: "일평균 수량(개)", format: "int" },
    ],
    rows: weekdayStats,
  };

  // 차량: 미기재는 차트에서 분리해 주석으로 안내
  const unknown = topVehicles.rows.find((r) => r.vehicle === "미기재");
  const namedVehicles = topVehicles.rows.filter((r) => r.vehicle !== "미기재").slice(0, 15);
  const vehicleChartTable: TableData = { columns: VEHICLE_COLUMNS, rows: namedVehicles.map((r) => ({ ...r })) };

  const packTotal = packUnits.reduce((s, r) => s + r.qty, 0);
  const packTable: TableData = {
    columns: [
      { key: "packUnit", label: "포장단위" },
      { key: "qty", label: "출고수량(개)", format: "int" },
      { key: "share", label: "비중(%)", format: "pct" },
      { key: "slips", label: "출고 건수(건)", format: "int" },
      { key: "packQty", label: "포장수량", format: "int" },
    ],
    rows: packUnits.map((r) => ({ ...r, share: ratioPct(r.qty, packTotal) })),
  };

  return (
    <>
      <section aria-label={`${period} 출고 지표`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="출고 건수" value={formatFullNumber(totalSlips)} unit="건" deltaFallback={period} basis="정상 출고 전표 수" />
        <KpiCard
          label="출고수량"
          value={formatNumber(totalQty)}
          unit="개"
          exact={`${formatFullNumber(totalQty)}개`}
          deltaFallback={period}
          basis="정상 출고(반품 제외)"
        />
        <KpiCard
          label="일평균 출고 건수"
          value={totalDays > 0 ? (totalSlips / totalDays).toFixed(1) : "-"}
          unit="건"
          deltaFallback={`출고일수 ${formatFullNumber(totalDays)}일`}
          basis="출고가 있었던 날 기준"
        />
        <KpiCard
          label="차량번호 미기재"
          value={unknown ? formatPct(ratioPct(unknown.qty, totalQty), 1) : "0.0%"}
          deltaFallback={unknown ? `${formatNumber(unknown.qty)}개` : "미기재 없음"}
          basis="출고수량 기준 비중"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={`${grainLabel} 출고 건수`}
          description={`${period} · 정상 출고 전표 수`}
          table={seriesTable}
          csvName={`${grainLabel}_출고_건수_수량`}
          note={series.grain === "month" ? "전체 기간을 선택하면 월 단위로 집계합니다. 연도를 선택하면 일자별로 볼 수 있습니다." : undefined}
        >
          <ComboChart
            data={series.rows}
            xKey="period"
            xKind={series.grain === "day" ? "date" : "ym"}
            kind="count"
            unit="건"
            height={260}
            series={[{ key: "slips", label: "출고 건수", type: "line", color: SERIES_COLORS.production }]}
          />
        </ChartCard>
        <ChartCard
          title={`${grainLabel} 출고수량`}
          description={`${period} · 정상 출고수량(개)`}
          table={seriesTable}
          csvName={`${grainLabel}_출고_건수_수량`}
        >
          <ComboChart
            data={series.rows}
            xKey="period"
            xKind={series.grain === "day" ? "date" : "ym"}
            kind="qty"
            unit="개"
            height={260}
            series={[{ key: "qty", label: "출고수량", type: "line", color: SERIES_COLORS.sales }]}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="요일별 출고"
          description={`${period} · 출고가 있었던 날 1일당 평균`}
          table={weekdayTable}
          csvName="요일별_출고"
          note="건수와 수량은 단위가 달라 나란히 표시합니다. 주말은 출고일수 자체가 적습니다."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">일평균 출고 건수(건)</h3>
              <BarList
                ariaLabel="요일별 일평균 출고 건수"
                items={weekdayStats.map((r) => ({
                  key: r.key,
                  label: r.label,
                  value: r.avgSlips,
                  valueText: `${r.avgSlips.toFixed(1)}건`,
                  extra: `${r.days}일`,
                }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">일평균 출고수량(개)</h3>
              <BarList
                ariaLabel="요일별 일평균 출고수량"
                color={SERIES_COLORS.sales}
                items={weekdayStats.map((r) => ({
                  key: r.key,
                  label: r.label,
                  value: r.avgQty,
                  valueText: `${formatNumber(r.avgQty)}개`,
                }))}
              />
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="포장단위별 출고 비중"
          description={`${period} · 정상 출고수량 기준`}
          table={packTable}
          csvName="포장단위별_출고_비중"
          note="'83*155', '62*160' 등은 캡·라벨류의 포장 규격입니다."
        >
          <BarList
            ariaLabel="포장단위별 출고수량과 비중"
            items={packUnits.map((r) => ({
              key: r.packUnit,
              label: r.packUnit,
              value: r.qty,
              valueText: `${formatNumber(r.qty)}개`,
              extra: formatPct(ratioPct(r.qty, packTotal), 1),
            }))}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="차량별 운행 횟수 TOP 15"
          description={`${period} · 차량번호가 기재된 출고만`}
          table={vehicleChartTable}
          csvName="차량별_운행_TOP15"
          note={
            unknown
              ? `차량번호가 비어 있는 출고는 '미기재'로 분류했습니다: ${formatFullNumber(unknown.trips)}회, ${formatNumber(unknown.qty)}개 (전체 출고수량의 ${formatPct(ratioPct(unknown.qty, totalQty), 1)}).`
              : "차량번호가 비어 있는 출고는 '미기재'로 분류합니다."
          }
        >
          <BarList
            ranked
            ariaLabel="운행 횟수 상위 차량"
            items={namedVehicles.map((r) => ({
              key: r.vehicle,
              label: `차량 ${r.vehicle}`,
              value: r.trips,
              valueText: `${formatFullNumber(r.trips)}회`,
              extra: `회당 ${formatFullNumber(r.avgQty)}개`,
            }))}
          />
        </ChartCard>

        <section className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold">차량번호별 운행 현황</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {period} · 전체 {formatFullNumber(topVehicles.total)}대 · 운행 횟수 = 출지번호(출하 전표) 수
            </p>
          </header>
          <PagedTable
            endpoint={`/api/logistics/vehicles?${filtersToQuery(f)}`}
            columns={VEHICLE_COLUMNS}
            rowKey="vehicle"
            pageSize={10}
            csvName="차량번호별_운행_현황"
            caption="차량번호별 운행 횟수와 평균 출고수량"
          />
          <p className="mt-3 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
            ERP에 차량 적재 용량과 운송기사 정보가 없어 적재율은 계산하지 못합니다. 회당 평균 출고수량을 대신 제공합니다.
          </p>
        </section>
      </div>
    </>
  );
}
