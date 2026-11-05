import { db } from "@/db";
import { productionRecords, salesRecords } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";

// 연도별 생산 요약
export async function getYearlyProduction() {
  return db
    .select({
      year: sql<number>`extract(year from ${productionRecords.productionDate})::int`,
      totalA: sql<number>`sum(${productionRecords.qtyGradeA})::bigint`,
      totalC: sql<number>`sum(${productionRecords.qtyGradeC})::bigint`,
      rowCount: sql<number>`count(*)::int`,
    })
    .from(productionRecords)
    .groupBy(sql`extract(year from ${productionRecords.productionDate})`)
    .orderBy(sql`extract(year from ${productionRecords.productionDate})`);
}

// 연도별 판매 요약
export async function getYearlySales() {
  return db
    .select({
      year: sql<number>`extract(year from ${salesRecords.shipmentDate})::int`,
      totalQty: sql<number>`sum(${salesRecords.shipmentQty})::bigint`,
      normalQty: sql<number>`sum(case when ${salesRecords.shipmentType} = '정상' then ${salesRecords.shipmentQty} else 0 end)::bigint`,
      returnQty: sql<number>`sum(case when ${salesRecords.shipmentType} = '반품' then ${salesRecords.shipmentQty} else 0 end)::bigint`,
      rowCount: sql<number>`count(*)::int`,
    })
    .from(salesRecords)
    .groupBy(sql`extract(year from ${salesRecords.shipmentDate})`)
    .orderBy(sql`extract(year from ${salesRecords.shipmentDate})`);
}

// 부서별·연도별 생산 요약
export async function getProductionByDept() {
  return db
    .select({
      year: sql<number>`extract(year from ${productionRecords.productionDate})::int`,
      departmentCode: productionRecords.departmentCode,
      departmentName: productionRecords.departmentName,
      totalA: sql<number>`sum(${productionRecords.qtyGradeA})::bigint`,
      totalC: sql<number>`sum(${productionRecords.qtyGradeC})::bigint`,
    })
    .from(productionRecords)
    .groupBy(
      sql`extract(year from ${productionRecords.productionDate})`,
      productionRecords.departmentCode,
      productionRecords.departmentName
    )
    .orderBy(
      sql`extract(year from ${productionRecords.productionDate})`,
      productionRecords.departmentCode
    );
}

// 월별 생산·판매 추이 (특정 연도)
export async function getMonthlyTrend(year: number) {
  const prodMonthly = db
    .select({
      month: sql<number>`extract(month from ${productionRecords.productionDate})::int`,
      totalA: sql<number>`sum(${productionRecords.qtyGradeA})::bigint`,
    })
    .from(productionRecords)
    .where(sql`extract(year from ${productionRecords.productionDate}) = ${year}`)
    .groupBy(sql`extract(month from ${productionRecords.productionDate})`)
    .orderBy(sql`extract(month from ${productionRecords.productionDate})`);

  const salesMonthly = db
    .select({
      month: sql<number>`extract(month from ${salesRecords.shipmentDate})::int`,
      totalQty: sql<number>`sum(${salesRecords.shipmentQty})::bigint`,
    })
    .from(salesRecords)
    .where(sql`extract(year from ${salesRecords.shipmentDate}) = ${year}`)
    .groupBy(sql`extract(month from ${salesRecords.shipmentDate})`)
    .orderBy(sql`extract(month from ${salesRecords.shipmentDate})`);

  const [prod, sales] = await Promise.all([prodMonthly, salesMonthly]);

  // 1~12월 통합
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const p = prod.find((r) => r.month === m);
    const s = sales.find((r) => r.month === m);
    return {
      month: m,
      production: Number(p?.totalA ?? 0),
      sales: Number(s?.totalQty ?? 0),
    };
  });
}

// 품종별 TOP N 생산
export async function getTopProductTypes(limit = 15) {
  return db
    .select({
      productType: productionRecords.productType,
      productName: sql<string>`max(${productionRecords.productName})`,
      totalA: sql<number>`sum(${productionRecords.qtyGradeA})::bigint`,
    })
    .from(productionRecords)
    .groupBy(productionRecords.productType)
    .orderBy(desc(sql`sum(${productionRecords.qtyGradeA})`))
    .limit(limit);
}

// 거래선별 TOP N 판매
export async function getTopCustomers(limit = 15) {
  return db
    .select({
      customerName: salesRecords.customerName,
      totalQty: sql<number>`sum(${salesRecords.shipmentQty})::bigint`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(salesRecords)
    .where(eq(salesRecords.shipmentType, "정상"))
    .groupBy(salesRecords.customerName)
    .orderBy(desc(sql`sum(${salesRecords.shipmentQty})`))
    .limit(limit);
}

// 월별 계절 지수 (5년 평균 대비)
export async function getSeasonalIndex() {
  const monthly = await db
    .select({
      month: sql<number>`extract(month from ${salesRecords.shipmentDate})::int`,
      year: sql<number>`extract(year from ${salesRecords.shipmentDate})::int`,
      totalQty: sql<number>`sum(${salesRecords.shipmentQty})::bigint`,
    })
    .from(salesRecords)
    .groupBy(
      sql`extract(year from ${salesRecords.shipmentDate})`,
      sql`extract(month from ${salesRecords.shipmentDate})`
    )
    .orderBy(
      sql`extract(year from ${salesRecords.shipmentDate})`,
      sql`extract(month from ${salesRecords.shipmentDate})`
    );

  // 연도별 월평균 구하고 계절지수 계산
  const yearTotals = new Map<number, number>();
  for (const r of monthly) {
    yearTotals.set(r.year, (yearTotals.get(r.year) ?? 0) + Number(r.totalQty));
  }

  const monthSums = new Array(12).fill(0);
  const monthCounts = new Array(12).fill(0);

  for (const r of monthly) {
    const yearTotal = yearTotals.get(r.year) ?? 1;
    const yearMonthlyAvg = yearTotal / 12;
    const index = Number(r.totalQty) / yearMonthlyAvg;
    monthSums[r.month - 1] += index;
    monthCounts[r.month - 1]++;
  }

  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    index: monthCounts[i] > 0
      ? Math.round((monthSums[i] / monthCounts[i]) * 100) / 100
      : 1,
  }));
}

// 연도별·월별 판매 히트맵 데이터
export async function getMonthlyHeatmap() {
  return db
    .select({
      year: sql<number>`extract(year from ${salesRecords.shipmentDate})::int`,
      month: sql<number>`extract(month from ${salesRecords.shipmentDate})::int`,
      totalQty: sql<number>`sum(${salesRecords.shipmentQty})::bigint`,
    })
    .from(salesRecords)
    .groupBy(
      sql`extract(year from ${salesRecords.shipmentDate})`,
      sql`extract(month from ${salesRecords.shipmentDate})`
    )
    .orderBy(
      sql`extract(year from ${salesRecords.shipmentDate})`,
      sql`extract(month from ${salesRecords.shipmentDate})`
    );
}
