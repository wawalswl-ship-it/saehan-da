import { apiFail, apiOk, filtersFromRequest, pageParams } from "@/lib/api-response";
import { getVehicleStats } from "@/lib/logistics-queries";

// GET /api/logistics/vehicles?page=&pageSize= + 공통 필터
export async function GET(request: Request) {
  const { filters, searchParams } = filtersFromRequest(request);
  const { page, pageSize, offset } = pageParams(searchParams, 10, 1000);
  try {
    const { rows, total } = await getVehicleStats(filters, pageSize, offset);
    return apiOk(rows, { page, pageSize, total });
  } catch (error) {
    console.error("Logistics vehicles API error:", error);
    return apiFail("차량별 운행 현황 조회 중 오류가 발생했습니다.");
  }
}
