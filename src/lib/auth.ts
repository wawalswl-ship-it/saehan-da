import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// 로그인 계정과 세션 서명 키는 환경변수로만 주입한다 (코드·문서에 기록 금지)
//   AUTH_USERS  = "아이디:비밀번호" 를 쉼표로 구분 (예: "kim:pw1,lee:pw2")
//   AUTH_SECRET = 세션 쿠키 서명용 임의 문자열 (16자 이상)
// 공용 DB에는 쓰지 않으므로 사용자 테이블 없이 환경변수 계정만 사용한다.

export const SESSION_COOKIE = "saehan_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일(초)

export interface Session {
  userId: string;
  expiresAt: number;
}

function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

function getAccounts(): Map<string, string> {
  const accounts = new Map<string, string>();
  for (const pair of (process.env.AUTH_USERS ?? "").split(",")) {
    const at = pair.indexOf(":");
    if (at <= 0) continue;
    const id = pair.slice(0, at).trim();
    const password = pair.slice(at + 1).trim();
    if (id && password) accounts.set(id, password);
  }
  return accounts;
}

/** 계정과 서명 키가 모두 설정돼 있어야 로그인할 수 있다 (미설정 시 항상 차단) */
export function isAuthConfigured(): boolean {
  return getSecret() !== null && getAccounts().size > 0;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** 아이디·비밀번호 검증 (해시 후 상수 시간 비교로 시간 차이를 줄인다) */
export function verifyCredentials(id: string, password: string): boolean {
  if (!isAuthConfigured()) return false;
  const expected = getAccounts().get(id);
  // 없는 아이디도 같은 비용으로 비교한다
  const matches = timingSafeEqual(digest(password), digest(expected ?? `missing:${id}`));
  return expected !== undefined && matches;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** 서명된 세션 토큰: base64url(JSON).HMAC */
export function createSessionToken(userId: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload = Buffer.from(
    JSON.stringify({ u: userId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string | undefined | null): Session | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; exp?: unknown };
    if (typeof data.u !== "string" || typeof data.exp !== "number") return null;
    if (data.exp * 1000 <= Date.now()) return null;
    // 계정이 삭제되면 남아 있는 세션도 무효
    if (!getAccounts().has(data.u)) return null;
    return { userId: data.u, expiresAt: data.exp };
  } catch {
    return null;
  }
}

/** 로그인 후 돌아갈 경로: 사이트 내부 경로만 허용 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/login") || next.startsWith("/api/")) return "/";
  return next;
}
