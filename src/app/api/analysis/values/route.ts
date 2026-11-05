import { getSession } from "@/lib/session";
import { NextRequest } from "next/server";
import { apiFail, apiOk } from "@/lib/api-response";
import { getDimensionValues } from "@/lib/analysis-queries";

export async function GET(request: NextRequest) {
  if (!(await getSession())) return apiFail("로그인이 필요합니다.", 401);
  const { searchParams } = new URL(request.url);
  const dataset = searchParams.get("dataset");
  const dimension = searchParams.get("dimension");

  if ((dataset !== "production" && dataset !== "sales") || !dimension) {
    return apiFail("dataset(production|sales), dimension은 필수입니다.", 400);
  }

  try {
    const values = await getDimensionValues(dataset, dimension);
    return apiOk(values, { dataset, dimension, total: values.length });
  } catch (error) {
    console.error("Analysis values API error:", error);
    const invalid = error instanceof Error && error.message.startsWith("Invalid");
    return apiFail(invalid ? (error as Error).message : "차원 값 조회 중 오류가 발생했습니다.", invalid ? 400 : 500);
  }
}
