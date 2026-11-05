import { getSession } from "@/lib/session";
import { apiFail, apiOk, filtersFromRequest, pageParams } from "@/lib/api-response";
import { getDefectRanking, type DefectGroupBy } from "@/lib/quality-queries";

const GROUPS: DefectGroupBy[] = ["product", "machine", "shift"];

// GET /api/quality/ranking?groupBy=product|machine|shift&minQty=&page=&pageSize= + 공통 필터
export async function GET(request: Request) {
  if (!(await getSession())) return apiFail("로그인이 필요합니다.", 401);
  const { filters, searchParams } = filtersFromRequest(request);
  const groupBy = (searchParams.get("groupBy") ?? "product") as DefectGroupBy;
  if (!GROUPS.includes(groupBy)) return apiFail("groupBy 는 product, machine, shift 중 하나여야 합니다.", 400);
  const minQty = Math.max(0, Number.parseInt(searchParams.get("minQty") ?? "0", 10) || 0);
  const { page, pageSize, offset } = pageParams(searchParams, 10, 1000);
  try {
    const { rows, total } = await getDefectRanking(filters, groupBy, minQty, pageSize, offset);
    return apiOk(rows, { groupBy, minQty, page, pageSize, total });
  } catch (error) {
    console.error("Quality ranking API error:", error);
    return apiFail("불량률 순위 조회 중 오류가 발생했습니다.");
  }
}
