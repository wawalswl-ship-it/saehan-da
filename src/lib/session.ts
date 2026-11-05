import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionToken, type Session } from "@/lib/auth";

/** 현재 요청의 세션 (없거나 만료·위조면 null) */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSessionToken(token);
}

/**
 * 데이터 조회 직전에 호출하는 세션 확인.
 * proxy.ts 의 사전 차단과 별개로, 데이터에 가까운 곳에서 한 번 더 확인한다.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
