import {
  pgTable,
  serial,
  date,
  text,
  integer,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

// 부서 코드 enum
export const departmentCodeEnum = pgEnum("department_code", [
  "1211",
  "1212",
  "1219",
]);

// 출고구분 enum
export const shipmentTypeEnum = pgEnum("shipment_type", [
  "정상",
  "반품",
]);

// 전표구분 enum
export const slipTypeEnum = pgEnum("slip_type", [
  "21",
  "22",
  "32",
]);

// =============================================
// 생산실적 테이블
// =============================================
export const productionRecords = pgTable(
  "production_records",
  {
    id: serial("id").primaryKey(),
    productionDate: date("production_date").notNull(),       // 생산일자
    departmentCode: departmentCodeEnum("department_code").notNull(), // 부서코드 (1211/1212/1219)
    departmentName: text("department_name").notNull(),        // 생산부서명
    workShift: text("work_shift"),                           // 작업조 (A조, B조, C조)
    machineNo: text("machine_no"),                           // 생산호기
    workOrderNo: text("work_order_no"),                      // 작업지시번호
    productCode: text("product_code"),                       // 생산품번 (TM00434 등)
    productType: text("product_type"),                       // 생산품종 (TSA00450P1 등)
    productName: text("product_name"),                       // 품명/규격
    customerName: text("customer_name"),                     // 거래선명
    packUnit: text("pack_unit"),                             // 포장단위 (박스/파렛트/필름/없음)
    slipType: slipTypeEnum("slip_type"),                     // 전표구분 (21/22/32)
    slipTypeName: text("slip_type_name"),                    // 전표구분명
    inputProcess: text("input_process"),                     // 투입공정
    inputMachineNo: text("input_machine_no"),                // 투입호기
    packUnitQty: integer("pack_unit_qty"),                   // 포장단위수량
    qtyGradeA: integer("qty_grade_a").notNull().default(0),  // 수량(A급) - 양품
    qtyGradeC: integer("qty_grade_c").notNull().default(0),  // 수량(C급) - 불량
  },
  (table) => [
    index("idx_prod_date").on(table.productionDate),
    index("idx_prod_dept").on(table.departmentCode),
    index("idx_prod_date_dept").on(table.productionDate, table.departmentCode),
    index("idx_prod_product_type").on(table.productType),
    index("idx_prod_customer").on(table.customerName),
  ]
);

// =============================================
// 판매실적 테이블
// =============================================
export const salesRecords = pgTable(
  "sales_records",
  {
    id: serial("id").primaryKey(),
    shipmentDate: date("shipment_date").notNull(),           // 출고일자
    slipNo: text("slip_no"),                                 // 전표번호
    shipmentType: shipmentTypeEnum("shipment_type"),         // 출고구분 (정상/반품)
    salesType: text("sales_type"),                           // 판매형태 (내수 등)
    productCode: text("product_code"),                       // 품번
    productType: text("product_type"),                       // 품종
    productName: text("product_name"),                       // 품명/규격
    customerName: text("customer_name"),                     // 거래선
    volume: integer("volume"),                               // 용량
    packUnit: text("pack_unit"),                             // 포장단위
    packUnitQty: integer("pack_unit_qty"),                   // 포장단위수량
    packQty: integer("pack_qty"),                            // 포장수량
    shipmentQty: integer("shipment_qty").notNull().default(0), // 출고수량 (반품은 음수)
    vehicleNo: text("vehicle_no"),                           // 차량번호
    driverName: text("driver_name"),                         // 운송기사
    shipSlipNo: text("ship_slip_no"),                        // 출지번호
  },
  (table) => [
    index("idx_sales_date").on(table.shipmentDate),
    index("idx_sales_type").on(table.shipmentType),
    index("idx_sales_date_type").on(table.shipmentDate, table.shipmentType),
    index("idx_sales_product_type").on(table.productType),
    index("idx_sales_customer").on(table.customerName),
  ]
);

// =============================================
// 부서 마스터 (참조용)
// =============================================
export const departments = pgTable("departments", {
  code: text("code").primaryKey(),           // 1211, 1212, 1219
  name: text("name").notNull(),              // PET 1팀, PE 팀, PET 2팀
  material: text("material").notNull(),      // PET, PE
  isActive: integer("is_active").default(1), // 활성 여부
});
