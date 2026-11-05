import "dotenv/config";
import fs from "fs";
import path from "path";
import iconv from "iconv-lite";
import postgres from "postgres";

const DATA_DIR = path.resolve(__dirname, "../../docs/data");
const BATCH_SIZE = 500;

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

// =============================================
// 생산실적 파싱
// =============================================
interface ProductionRow {
  production_date: string;
  department_code: string;
  department_name: string;
  work_shift: string | null;
  machine_no: string | null;
  work_order_no: string | null;
  product_code: string | null;
  product_type: string | null;
  product_name: string | null;
  customer_name: string | null;
  pack_unit: string | null;
  slip_type: string | null;
  slip_type_name: string | null;
  input_process: string | null;
  input_machine_no: string | null;
  pack_unit_qty: number | null;
  qty_grade_a: number;
  qty_grade_c: number;
}

function extractDeptCode(deptName: string): string {
  const match = deptName.match(/^(\d{4})/);
  return match ? match[1] : deptName;
}

function extractSlipTypeCode(slipType: string | null): string | null {
  if (!slipType) return null;
  const match = slipType.match(/^(\d{2})/);
  return match ? match[1] : null;
}

function clean(val: string | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "NaN" || trimmed === "nan") return null;
  return trimmed;
}

function toInt(val: string | undefined): number {
  if (!val) return 0;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "NaN" || trimmed === "nan") return 0;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? 0 : n;
}

function toIntOrNull(val: string | undefined): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "NaN" || trimmed === "nan") return null;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? null : n;
}

function readTsv(filePath: string): string[][] {
  const buf = fs.readFileSync(filePath);
  const text = iconv.decode(buf, "cp949");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => line.split("\t"));
}

function parseProductionFile(
  filePath: string,
  deptCode: string
): ProductionRow[] {
  const rows = readTsv(filePath);
  if (rows.length < 2) return [];

  // 첫 행은 헤더, 나머지가 데이터
  const dataRows = rows.slice(1);
  const results: ProductionRow[] = [];

  for (const cols of dataRows) {
    const dateVal = clean(cols[0]);
    // 합계행 또는 날짜가 없는 행 제외
    if (!dateVal || !dateVal.match(/^\d{4}-\d{2}-\d{2}/)) continue;

    results.push({
      production_date: dateVal,
      department_code: deptCode,
      department_name: clean(cols[1]) || "",
      work_shift: clean(cols[2]),
      machine_no: clean(cols[3]),
      work_order_no: clean(cols[4]),
      product_code: clean(cols[5]),
      product_type: clean(cols[6]),
      product_name: clean(cols[7]),
      customer_name: clean(cols[8]),
      pack_unit: clean(cols[9]),
      slip_type_name: clean(cols[10]),
      slip_type: extractSlipTypeCode(clean(cols[10])),
      input_process: clean(cols[11]),
      input_machine_no: clean(cols[12]),
      pack_unit_qty: toIntOrNull(cols[13]),
      qty_grade_a: toInt(cols[14]),
      qty_grade_c: toInt(cols[15]),
    });
  }

  return results;
}

// =============================================
// 판매실적 파싱
// =============================================
interface SalesRow {
  shipment_date: string;
  slip_no: string | null;
  shipment_type: string | null;
  sales_type: string | null;
  product_code: string | null;
  product_type: string | null;
  product_name: string | null;
  customer_name: string | null;
  volume: number | null;
  pack_unit: string | null;
  pack_unit_qty: number | null;
  pack_qty: number | null;
  shipment_qty: number;
  vehicle_no: string | null;
  driver_name: string | null;
  ship_slip_no: string | null;
}

function parseSalesFile(filePath: string): SalesRow[] {
  const rows = readTsv(filePath);
  if (rows.length < 2) return [];

  const dataRows = rows.slice(1);
  const results: SalesRow[] = [];

  for (const cols of dataRows) {
    const dateVal = clean(cols[0]);
    if (!dateVal || !dateVal.match(/^\d{4}-\d{2}-\d{2}/)) continue;

    const shipType = clean(cols[2]);
    // shipment_type enum은 '정상'/'반품'만 허용
    const validShipType =
      shipType === "정상" || shipType === "반품" ? shipType : null;

    results.push({
      shipment_date: dateVal,
      slip_no: clean(cols[1]),
      shipment_type: validShipType,
      sales_type: clean(cols[3]),
      product_code: clean(cols[4]),
      product_type: clean(cols[5]),
      product_name: clean(cols[6]),
      customer_name: clean(cols[7]),
      volume: toIntOrNull(cols[8]),
      pack_unit: clean(cols[9]),
      pack_unit_qty: toIntOrNull(cols[10]),
      pack_qty: toIntOrNull(cols[11]),
      shipment_qty: toInt(cols[12]),
      vehicle_no: clean(cols[13]),
      driver_name: clean(cols[14]),
      ship_slip_no: clean(cols[15]),
    });
  }

  return results;
}

// =============================================
// DB 적재
// =============================================
async function insertProductionBatch(rows: ProductionRow[]) {
  if (rows.length === 0) return;
  await sql`
    INSERT INTO production_records ${sql(
      rows,
      "production_date",
      "department_code",
      "department_name",
      "work_shift",
      "machine_no",
      "work_order_no",
      "product_code",
      "product_type",
      "product_name",
      "customer_name",
      "pack_unit",
      "slip_type",
      "slip_type_name",
      "input_process",
      "input_machine_no",
      "pack_unit_qty",
      "qty_grade_a",
      "qty_grade_c"
    )}
  `;
}

async function insertSalesBatch(rows: SalesRow[]) {
  if (rows.length === 0) return;
  await sql`
    INSERT INTO sales_records ${sql(
      rows,
      "shipment_date",
      "slip_no",
      "shipment_type",
      "sales_type",
      "product_code",
      "product_type",
      "product_name",
      "customer_name",
      "volume",
      "pack_unit",
      "pack_unit_qty",
      "pack_qty",
      "shipment_qty",
      "vehicle_no",
      "driver_name",
      "ship_slip_no"
    )}
  `;
}

async function insertInBatches<T>(
  rows: T[],
  batchFn: (batch: T[]) => Promise<void>
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await batchFn(batch);
  }
}

// =============================================
// 메인
// =============================================
async function main() {
  console.log("=== ETL 시작 ===\n");

  // 기존 데이터 삭제
  console.log("기존 데이터 삭제...");
  await sql`TRUNCATE production_records RESTART IDENTITY`;
  await sql`TRUNCATE sales_records RESTART IDENTITY`;
  await sql`TRUNCATE departments RESTART IDENTITY`;

  // 부서 마스터 적재
  console.log("부서 마스터 적재...");
  await sql`
    INSERT INTO departments (code, name, material, is_active) VALUES
      ('1211', 'PET 1팀', 'PET', 1),
      ('1212', 'PE 팀', 'PE', 1),
      ('1219', 'PET 2팀', 'PET', 1)
  `;

  const years = [2021, 2022, 2023, 2024, 2025];
  const deptSuffixes = [
    { suffix: "1211", code: "1211" },
    { suffix: "1212", code: "1212" },
    { suffix: "1219", code: "1219" },
  ];

  // 생산실적 적재
  let totalProd = 0;
  console.log("\n[생산실적 적재]");
  for (const year of years) {
    for (const { suffix, code } of deptSuffixes) {
      const fileName = `${year}년 생산실적(${suffix}).xls`;
      const filePath = path.join(DATA_DIR, fileName);

      if (!fs.existsSync(filePath)) {
        console.log(`  SKIP: ${fileName} (파일 없음)`);
        continue;
      }

      const rows = parseProductionFile(filePath, code);
      await insertInBatches(rows, insertProductionBatch);
      totalProd += rows.length;
      console.log(`  ${fileName}: ${rows.length}행`);
    }
  }
  console.log(`  >>> 생산실적 합계: ${totalProd.toLocaleString()}행\n`);

  // 판매실적 적재
  let totalSales = 0;
  console.log("[판매실적 적재]");
  for (const year of years) {
    const fileName = `${year}년 판매실적.xls`;
    const filePath = path.join(DATA_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP: ${fileName} (파일 없음)`);
      continue;
    }

    const rows = parseSalesFile(filePath);
    await insertInBatches(rows, insertSalesBatch);
    totalSales += rows.length;
    console.log(`  ${fileName}: ${rows.length}행`);
  }
  console.log(`  >>> 판매실적 합계: ${totalSales.toLocaleString()}행\n`);

  // 검증
  console.log("[적재 검증]");
  const [prodCount] = await sql`SELECT count(*)::int as cnt FROM production_records`;
  const [salesCount] = await sql`SELECT count(*)::int as cnt FROM sales_records`;
  const [deptCount] = await sql`SELECT count(*)::int as cnt FROM departments`;
  console.log(`  production_records: ${prodCount.cnt.toLocaleString()}행`);
  console.log(`  sales_records: ${salesCount.cnt.toLocaleString()}행`);
  console.log(`  departments: ${deptCount.cnt}행`);

  // 부서별 생산량 요약
  console.log("\n[부서별 생산량 검증]");
  const deptSummary = await sql`
    SELECT department_code, count(*)::int as rows, sum(qty_grade_a)::bigint as total_a
    FROM production_records
    GROUP BY department_code
    ORDER BY department_code
  `;
  for (const r of deptSummary) {
    console.log(
      `  ${r.department_code}: ${Number(r.rows).toLocaleString()}행, A급=${Number(r.total_a).toLocaleString()}`
    );
  }

  // 연도별 판매량 요약
  console.log("\n[연도별 판매량 검증]");
  const yearSummary = await sql`
    SELECT extract(year from shipment_date::date)::int as yr,
           count(*)::int as rows,
           sum(shipment_qty)::bigint as total_qty
    FROM sales_records
    GROUP BY yr
    ORDER BY yr
  `;
  for (const r of yearSummary) {
    console.log(
      `  ${r.yr}: ${Number(r.rows).toLocaleString()}행, 순출고=${Number(r.total_qty).toLocaleString()}`
    );
  }

  await sql.end();
  console.log("\n=== ETL 완료 ===");
}

main().catch(async (err) => {
  console.error("ETL 오류:", err);
  await sql.end();
  process.exit(1);
});
