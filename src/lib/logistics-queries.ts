import { cacheLife } from "next/cache";
import type { Filters } from "@/lib/filters";
import { Q, run, salesConds, where } from "@/lib/sql";

// 물류 지표는 실제 출고(정상)만 대상으로 한다. 반품은 제외.
const NORMAL_ONLY = "shipment_type = '정상'";

export interface ShipmentSeriesRow {
  period: string; // YYYY-MM-DD (연도 선택 시) 또는 YYYY-MM (전체 기간)
  slips: number;
  qty: number;
}

/** 일자별 출고 건수(전표 수)·수량. 전체 기간 선택 시 점이 많아 월 단위로 집계 */
export async function getShipmentSeries(f: Filters): Promise<{ grain: "day" | "month"; rows: ShipmentSeriesRow[] }> {
  "use cache";
  cacheLife("hours");

  const grain = f.year === null ? "month" : "day";
  const fmt = grain === "day" ? "YYYY-MM-DD" : "YYYY-MM";
  const q = new Q();
  const rows = await run<ShipmentSeriesRow>(
    `SELECT to_char(shipment_date, '${fmt}') AS period,
            count(DISTINCT slip_no)::int AS slips,
            sum(shipment_qty)::float8 AS qty
     FROM sales_records ${where([...salesConds(q, f), NORMAL_ONLY])}
     GROUP BY 1 ORDER BY 1`,
    q
  );
  return { grain, rows };
}

export interface WeekdayRow {
  dow: number; // 0=일 … 6=토
  days: number;
  slips: number;
  qty: number;
}

/** 요일별 출고일수·건수·수량 */
export async function getWeekdayStats(f: Filters): Promise<WeekdayRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<WeekdayRow>(
    `SELECT extract(dow FROM shipment_date)::int AS dow,
            count(DISTINCT shipment_date)::int AS days,
            count(DISTINCT slip_no)::int AS slips,
            sum(shipment_qty)::float8 AS qty
     FROM sales_records ${where([...salesConds(q, f), NORMAL_ONLY])}
     GROUP BY 1 ORDER BY 1`,
    q
  );
}

export interface VehicleRow {
  vehicle: string;
  trips: number; // 출지번호 기준 운행 횟수
  days: number;
  qty: number;
  avgQty: number;
}

/** 차량번호별 운행 횟수·평균 출고수량 (빈 차량번호는 '미기재') — 페이지네이션 */
export async function getVehicleStats(
  f: Filters,
  limit: number,
  offset: number
): Promise<{ rows: VehicleRow[]; total: number }> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  const w = where([...salesConds(q, f), NORMAL_ONLY]);
  const rows = await run<VehicleRow & { total: number }>(
    `SELECT vehicle, trips, days, qty,
            (qty / nullif(trips, 0))::float8 AS "avgQty",
            count(*) OVER ()::int AS total
     FROM (
       SELECT coalesce(nullif(trim(vehicle_no), ''), '미기재') AS vehicle,
              count(DISTINCT coalesce(ship_slip_no, slip_no))::int AS trips,
              count(DISTINCT shipment_date)::int AS days,
              sum(shipment_qty)::float8 AS qty
       FROM sales_records ${w}
       GROUP BY 1
     ) t
     ORDER BY trips DESC, vehicle
     LIMIT ${q.p(limit)}::int OFFSET ${q.p(offset)}::int`,
    q
  );
  return {
    rows: rows.map((r) => ({ vehicle: r.vehicle, trips: r.trips, days: r.days, qty: r.qty, avgQty: r.avgQty })),
    total: rows[0]?.total ?? 0,
  };
}

export interface PackUnitRow {
  packUnit: string;
  slips: number;
  qty: number;
  packQty: number;
}

/** 포장단위별 출고 수량·건수 */
export async function getPackUnitShare(f: Filters): Promise<PackUnitRow[]> {
  "use cache";
  cacheLife("hours");

  const q = new Q();
  return run<PackUnitRow>(
    `SELECT coalesce(pack_unit, '미기재') AS "packUnit",
            count(DISTINCT slip_no)::int AS slips,
            sum(shipment_qty)::float8 AS qty,
            coalesce(sum(pack_qty), 0)::float8 AS "packQty"
     FROM sales_records ${where([...salesConds(q, f), NORMAL_ONLY])}
     GROUP BY 1 ORDER BY qty DESC`,
    q
  );
}
