import { apiFail, apiOk } from "@/lib/api-response";
import { getFilterOptions, type FilterOptionKind } from "@/lib/filter-option-queries";

const KINDS: FilterOptionKind[] = ["customer", "productType", "packUnit"];

// GET /api/filters/options?kind=customer|productType|packUnit
export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind") as FilterOptionKind | null;
  if (!kind || !KINDS.includes(kind)) return apiFail("kind 는 customer, productType, packUnit 중 하나여야 합니다.", 400);
  try {
    const options = await getFilterOptions(kind);
    return apiOk(options, { kind, total: options.length });
  } catch (error) {
    console.error("Filter options API error:", error);
    return apiFail("필터 선택지 조회 중 오류가 발생했습니다.");
  }
}
