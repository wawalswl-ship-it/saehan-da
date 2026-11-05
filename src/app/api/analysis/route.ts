import { getSession } from "@/lib/session";
import { NextRequest } from "next/server";
import { apiFail, apiOk } from "@/lib/api-response";
import {
  runAnalysis,
  PRODUCTION_DIMENSIONS,
  PRODUCTION_MEASURES,
  SALES_DIMENSIONS,
  SALES_MEASURES,
} from "@/lib/analysis-queries";

export async function POST(request: NextRequest) {
  if (!(await getSession())) return apiFail("로그인이 필요합니다.", 401);
  try {
    const body = await request.json();
    const { dataset, rows, columns, measures, filters, globalQuery } = body;

    if ((dataset !== "production" && dataset !== "sales") || !rows?.length || !measures?.length) {
      return apiFail("dataset(production|sales), rows, measures는 필수입니다.", 400);
    }

    const result = await runAnalysis({
      dataset,
      rows,
      columns: columns ?? [],
      measures,
      filters,
      globalQuery: typeof globalQuery === "string" ? globalQuery : null,
    });

    return apiOk(
      { rows: result.rows, totalRows: result.totalRows },
      { dataset, total: result.totalRows, globalFilterApplied: typeof globalQuery === "string" }
    );
  } catch (error) {
    console.error("Analysis API error:", error);
    const message = error instanceof Error && error.message.startsWith("Invalid") ? error.message : "분석 중 오류가 발생했습니다.";
    return apiFail(message, message.startsWith("Invalid") ? 400 : 500);
  }
}

export async function GET() {
  if (!(await getSession())) return apiFail("로그인이 필요합니다.", 401);
  const describe = (obj: Record<string, { label: string }>) =>
    Object.entries(obj).map(([key, v]) => ({ key, label: v.label }));
  return apiOk({
    production: {
      dimensions: describe(PRODUCTION_DIMENSIONS),
      measures: describe(PRODUCTION_MEASURES),
    },
    sales: {
      dimensions: describe(SALES_DIMENSIONS),
      measures: describe(SALES_MEASURES),
    },
  });
}
