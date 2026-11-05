import { getSession } from "@/lib/session";
import { apiFail, apiOk, filtersFromRequest } from "@/lib/api-response";
import { getProductDefectHistory } from "@/lib/quality-queries";

// GET /api/quality/history?productCode=TM00434 + 공통 필터(부서·전표구분)
export async function GET(request: Request) {
  if (!(await getSession())) return apiFail("로그인이 필요합니다.", 401);
  const { filters, searchParams } = filtersFromRequest(request);
  const productCode = searchParams.get("productCode")?.trim();
  if (!productCode) return apiFail("productCode 는 필수입니다.", 400);
  try {
    const { name, rows } = await getProductDefectHistory(filters, productCode);
    return apiOk(rows, { productCode, productName: name, total: rows.length });
  } catch (error) {
    console.error("Quality history API error:", error);
    return apiFail("불량 이력 조회 중 오류가 발생했습니다.");
  }
}
