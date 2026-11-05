// 숫자·단위 표기와 차트 색 토큰

/** 억/만 축약 (예: 3.07억, 1,234만, 9,876) */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1_0000_0000) return (n / 1_0000_0000).toFixed(2) + "억";
  if (abs >= 1_0000) return Math.round(n / 1_0000).toLocaleString("ko-KR") + "만";
  return Math.round(n).toLocaleString("ko-KR");
}

/** 천 단위 콤마 정수 */
export function formatFullNumber(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("ko-KR");
}

export function formatPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return n.toFixed(digits) + "%";
}

/** 비율(%) = part / whole × 100, 분모 0이면 null */
export function ratioPct(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

export const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// ── 브랜드·차트 색 ────────────────────────────────────────────
export const BRAND = {
  navy: "#1f3a68",
  navyDark: "#16294a",
  navyMid: "#3b5a8f",
  navySoft: "#e8eef7",
};

/** 부서별 고정 색 (모든 차트 공통, CVD 검증 완료: 전 쌍 ΔE ≥ 15) */
export const DEPT_COLORS: Record<string, string> = {
  "1211": "#2e5fa3",
  "1212": "#c0672b",
  "1219": "#12a0a8",
};

export const DEPT_NAMES: Record<string, string> = {
  "1211": "1211 PET 1팀",
  "1212": "1212 PE 팀",
  "1219": "1219 PET 2팀",
};

/** 측정값별 고정 색 */
export const SERIES_COLORS = {
  production: "#1f3a68",
  sales: "#3f96d6",
  normal: "#2e5fa3",
  returned: "#c0672b",
  net: "#12a0a8",
  neutral: "#8792a2",
};

/** 연도 겹침용 단일 색상 램프 (2021 → 2025, 옅음 → 진함) */
export const YEAR_COLORS: Record<number, string> = {
  2021: "#97afd6",
  2022: "#7493c6",
  2023: "#5576b0",
  2024: "#3b5a8f",
  2025: "#1f3a68",
};

/** 상태색: 의미에만 사용 (증가=그린, 경고=앰버, 불량·위험=레드) */
export const STATUS_COLORS = {
  good: "#15803d",
  warning: "#b45309",
  danger: "#b42318",
};

// 자유 분석(피벗) 차트용 범주 색 — 기존 기능 유지
export const CHART_COLORS = [
  "#2e5fa3", "#c0672b", "#12a0a8", "#8a5cc2", "#5a7d2a",
  "#b8457a", "#6b7280", "#3f96d6", "#9a6b1f", "#1f3a68",
  "#0f766e", "#7c3aed", "#a8501f", "#475569", "#4338ca",
];
