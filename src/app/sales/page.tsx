import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { PageSkeleton } from "@/components/kit/skeletons";
import { ChartCard } from "@/components/kit/chart-card";
import { BarList } from "@/components/charts/bar-list";
import { ComboChart } from "@/components/charts/combo-chart";
import { Heatmap, type HeatmapRow } from "@/components/charts/heatmap";
import { parseFilters, periodLabel, prevYearFilters, type RawSearchParams } from "@/lib/filters";
import { MONTH_LABELS, SERIES_COLORS, STATUS_COLORS, formatNumber, formatPct, ratioPct } from "@/lib/format";
import {
  getCustomerMonth,
  getCustomerPareto,
  getReturnTopCustomers,
  getReturnTopProducts,
  getSalesMonthly,
  getVolumeShare,
  type ReturnRow,
} from "@/lib/sales-queries";
import type { TableData } from "@/lib/table-data";

export const metadata: Metadata = { title: "판매" };

type PageProps = { searchParams: Promise<RawSearchParams> };

export default function SalesPage({ searchParams }: PageProps) {
  return (
    <PageShell
      title="판매"
      description="거래선·용량·월 단위로 출고와 반품 흐름을 살펴봅니다."
      solves="영업팀의 거래선별 발주 패턴 파악"
    >
      <Suspense fallback={<PageSkeleton cards={4} />}>
        <SalesContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

function returnTable(rows: ReturnRow[], nameLabel: string): TableData {
  return {
    columns: [
      { key: "name", label: nameLabel },
      { key: "returned", label: "반품(개)", format: "int" },
      { key: "normal", label: "정상출고(개)", format: "int" },
      { key: "rate", label: "반품률(%)", format: "pct" },
    ],
    rows: rows.map((r) => ({
      name: r.name?.trim() || r.key,
      returned: r.returned,
      normal: r.normal,
      rate: ratioPct(r.returned, r.normal),
    })),
  };
}

function returnItems(rows: ReturnRow[]) {
  return rows.map((r) => {
    const rate = ratioPct(r.returned, r.normal);
    return {
      key: r.key,
      label: r.name?.trim() || r.key,
      value: r.returned,
      valueText: `${formatNumber(r.returned)}개`,
      extra: rate === null ? "정상출고 없음" : `반품률 ${formatPct(rate, 1)}`,
    };
  });
}

async function SalesContent({ searchParams }: PageProps) {
  const f = parseFilters(await searchParams);
  const prevF = prevYearFilters(f);
  const [monthly, prevMonthly, pareto, volume, customerMonth, returnProducts, returnCustomers] = await Promise.all([
    getSalesMonthly(f),
    prevF ? getSalesMonthly(prevF) : Promise.resolve([]),
    getCustomerPareto(f),
    getVolumeShare(f),
    getCustomerMonth(f),
    getReturnTopProducts(f),
    getReturnTopCustomers(f),
  ]);
  const period = periodLabel(f);

  // 1) 월별 정상/반품/순판매 (+전년 동월)
  const prevByMonth = new Map(prevMonthly.map((r) => [r.ym.slice(5), r]));
  const monthlyData = monthly.map((r) => {
    const prev = prevF ? prevByMonth.get(r.ym.slice(5)) : undefined;
    return {
      ym: r.ym,
      normal: r.normal,
      returned: r.returned,
      net: r.net,
      prevNormal: prev?.normal ?? null,
      prevReturned: prev?.returned ?? null,
      prevNet: prev?.net ?? null,
    };
  });
  const monthlyTable: TableData = {
    columns: [
      { key: "ym", label: "연월" },
      { key: "normal", label: "정상출고(개)", format: "int" },
      { key: "returned", label: "반품(개)", format: "int" },
      { key: "net", label: "순판매(개)", format: "int" },
      { key: "rate", label: "반품률(%)", format: "pct" },
      { key: "prevNet", label: "전년 동월 순판매(개)", format: "int" },
    ],
    rows: monthlyData.map((r) => ({ ...r, rate: ratioPct(Math.abs(r.returned), r.normal) })),
  };

  // 2) 거래선 파레토: 비중과 누적 비중을 같은 % 축에 표시
  const paretoData = pareto.rows.reduce<{ name: string; share: number; cumulative: number; value: number }[]>(
    (acc, r) => {
      const share = ratioPct(r.value, pareto.total) ?? 0;
      const prev = acc.length ? acc[acc.length - 1].cumulative : 0;
      acc.push({ name: r.name, share, cumulative: prev + share, value: r.value });
      return acc;
    },
    []
  );
  const paretoTable: TableData = {
    columns: [
      { key: "rank", label: "순위", format: "int" },
      { key: "name", label: "거래선" },
      { key: "value", label: "순판매(개)", format: "int" },
      { key: "share", label: "비중(%)", format: "pct" },
      { key: "cumulative", label: "누적 비중(%)", format: "pct" },
    ],
    rows: paretoData.map((r, i) => ({ rank: i + 1, ...r })),
  };
  const at80 = paretoData.findIndex((r) => r.cumulative >= 80);
  const paretoNote =
    paretoData.length === 0
      ? undefined
      : at80 >= 0
        ? `상위 ${at80 + 1}개 거래선이 순판매의 80%를 차지합니다 (전체 ${pareto.customerCount.toLocaleString("ko-KR")}개 거래선).`
        : `상위 ${paretoData.length}개 거래선이 순판매의 ${paretoData[paretoData.length - 1].cumulative.toFixed(1)}%를 차지합니다 (전체 ${pareto.customerCount.toLocaleString("ko-KR")}개 거래선).`;

  // 3) 용량 구간
  const volumeTotal = volume.reduce((s, r) => s + r.net, 0);
  const volumeTable: TableData = {
    columns: [
      { key: "bucket", label: "용량 구간" },
      { key: "net", label: "순판매(개)", format: "int" },
      { key: "share", label: "비중(%)", format: "pct" },
      { key: "records", label: "출고 건수", format: "int" },
    ],
    rows: volume.map((r) => ({ bucket: r.bucket, net: r.net, share: ratioPct(r.net, volumeTotal), records: r.records })),
  };

  // 4) 거래선 × 월 히트맵
  const customerMap = new Map<string, HeatmapRow & { total: number }>();
  for (const r of customerMonth) {
    let row = customerMap.get(r.name);
    if (!row) {
      row = { key: r.name, label: r.name, values: { net: {} }, total: 0 };
      customerMap.set(r.name, row);
    }
    row.values.net[String(r.month)] = r.net;
    row.total += r.net;
  }
  const customerRows = [...customerMap.values()]
    .map((r) => ({ ...r, totals: { net: r.total } }))
    .sort((a, b) => b.total - a.total);
  const customerTable: TableData = {
    columns: [
      { key: "name", label: "거래선" },
      { key: "month", label: "월", format: "int" },
      { key: "net", label: "순판매(개)", format: "int" },
    ],
    rows: customerMonth.map((r) => ({ ...r })),
  };

  return (
    <>
      <ChartCard
        title="월별 정상 · 반품 · 순판매"
        description={`${period} · 반품은 음수로 기준선 아래에 표시`}
        table={monthlyTable}
        csvName="월별_정상_반품_순판매"
        note="순판매 = 정상 + 반품(음수), 반품률 = |반품| ÷ 정상. 판매실적에는 캡·라벨 등 부자재가 포함됩니다."
      >
        <ComboChart
          data={monthlyData}
          xKey="ym"
          xKind="ym"
          kind="qty"
          unit="개"
          height={320}
          series={[
            { key: "normal", label: "정상출고", type: "bar", color: SERIES_COLORS.normal, prevKey: "prevNormal" },
            { key: "returned", label: "반품", type: "bar", color: SERIES_COLORS.returned, prevKey: "prevReturned" },
            { key: "net", label: "순판매", type: "line", color: SERIES_COLORS.net, emphasis: true, prevKey: "prevNet" },
          ]}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="거래선 파레토"
          description={`${period} · 순판매 상위 20개 거래선의 비중과 누적 비중`}
          table={paretoTable}
          csvName="거래선_파레토"
          note={paretoNote}
        >
          <ComboChart
            data={paretoData}
            xKey="name"
            kind="pct"
            unit="%"
            height={320}
            refLines={[{ y: 80, label: "누적 80%" }]}
            series={[
              { key: "share", label: "거래선 비중", type: "bar", color: SERIES_COLORS.production },
              { key: "cumulative", label: "누적 비중", type: "line", color: SERIES_COLORS.sales, emphasis: true },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="용량(ml) 구간별 비중"
          description={`${period} · 순판매 기준`}
          table={volumeTable}
          csvName="용량구간별_순판매"
          note="용량이 0이거나 비어 있는 품목(캡·라벨 등 부자재)은 '용량 없음'으로 분리했습니다."
        >
          <BarList
            ariaLabel="용량 구간별 순판매와 비중"
            items={volume.map((r) => ({
              key: r.bucket,
              label: r.bucket,
              value: r.net,
              valueText: `${formatNumber(r.net)}개`,
              extra: formatPct(ratioPct(r.net, volumeTotal), 1),
              color: r.ord === 6 ? SERIES_COLORS.neutral : undefined,
            }))}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="거래선 × 월 히트맵"
        description={`${period} · 순판매 상위 15개 거래선${f.year === null ? " · 월은 5개년 합산" : ""}`}
        table={customerTable}
        csvName="거래선별_월별_순판매"
        tableToggle={false}
        note="거래선별 발주가 몰리는 달을 확인할 수 있습니다. 정확한 값은 셀에 적혀 있습니다."
      >
        <Heatmap
          rowHeader="거래선"
          columns={MONTH_LABELS.map((label, i) => ({ key: String(i + 1), label }))}
          rows={customerRows}
          metrics={[{ key: "net", label: "순판매", kind: "qty", unit: "개", ramp: "navy" }]}
          totalLabel="기간 전체"
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="반품 상위 품목"
          description={`${period} · 반품 수량 기준 상위 10개 (품번)`}
          table={returnTable(returnProducts, "품목")}
          csvName="반품_상위_품목"
          emptyText="선택한 조건에 반품 실적이 없습니다."
        >
          <BarList ranked ariaLabel="반품 수량 상위 품목" color={STATUS_COLORS.danger} items={returnItems(returnProducts)} />
        </ChartCard>
        <ChartCard
          title="반품 상위 거래선"
          description={`${period} · 반품 수량 기준 상위 10개`}
          table={returnTable(returnCustomers, "거래선")}
          csvName="반품_상위_거래선"
          emptyText="선택한 조건에 반품 실적이 없습니다."
        >
          <BarList ranked ariaLabel="반품 수량 상위 거래선" color={STATUS_COLORS.danger} items={returnItems(returnCustomers)} />
        </ChartCard>
      </div>
    </>
  );
}
