import { apiFail, apiOk, filtersFromRequest } from "@/lib/api-response";
import { getPlanningItem } from "@/lib/planning-queries";

// GET /api/planning/item?productCode=TM00434 + 공통 필터(전표구분)
export async function GET(request: Request) {
  const { filters, searchParams } = filtersFromRequest(request);
  const productCode = searchParams.get("productCode")?.trim();
  if (!productCode) return apiFail("productCode 는 필수입니다.", 400);
  try {
    const detail = await getPlanningItem(filters, productCode);
    return apiOk(detail, { productCode, estimate: true });
  } catch (error) {
    console.error("Planning item API error:", error);
    return apiFail("품목 예측 조회 중 오류가 발생했습니다.");
  }
}
