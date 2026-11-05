import { getSession } from "@/lib/session";
import { NextRequest } from "next/server";
import { apiFail, apiOk } from "@/lib/api-response";
import {
  getCommonProductTypes,
  getProductTimeSeries,
  getScatterData,
  getProductScatterData,
  getLagCorrelation,
} from "@/lib/correlation-queries";

// 생산 vs 판매 비교는 매칭 품목(생산·판매 양쪽에 있는 품종) 기준
const META = { basis: "matched-product-types" };

export async function GET(request: NextRequest) {
  if (!(await getSession())) return apiFail("로그인이 필요합니다.", 401);
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const productType = searchParams.get("productType");

  try {
    switch (type) {
      case "common-products":
        return apiOk(await getCommonProductTypes(), META);

      case "product-timeseries":
        if (!productType) return apiFail("productType 필수", 400);
        return apiOk(await getProductTimeSeries(productType), { ...META, productType });

      case "scatter-monthly":
        return apiOk(await getScatterData(), META);

      case "scatter-products":
        return apiOk(await getProductScatterData(), META);

      case "lag-correlation":
        return apiOk(await getLagCorrelation(), META);

      default: {
        // 전체 요약 데이터 반환
        const [commonProducts, scatterMonthly, productScatter, lagCorr] = await Promise.all([
          getCommonProductTypes(),
          getScatterData(),
          getProductScatterData(),
          getLagCorrelation(),
        ]);
        return apiOk({ commonProducts, scatterMonthly, productScatter, lagCorrelation: lagCorr }, META);
      }
    }
  } catch (error) {
    console.error("Correlation API error:", error);
    return apiFail("상관분석 조회 중 오류가 발생했습니다.");
  }
}
