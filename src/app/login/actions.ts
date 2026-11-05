"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isAuthConfigured,
  safeNextPath,
  verifyCredentials,
} from "@/lib/auth";

export interface LoginState {
  error: string | null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const id = String(formData.get("id") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!isAuthConfigured()) {
    return { error: "로그인 계정이 설정되지 않았습니다. 관리자에게 문의하세요. (환경변수 AUTH_USERS, AUTH_SECRET)" };
  }
  if (!id || !password) return { error: "아이디와 비밀번호를 입력하세요." };

  if (!verifyCredentials(id, password)) {
    // 무차별 대입을 늦추기 위한 지연
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  const token = createSessionToken(id);
  if (!token) return { error: "세션을 만들 수 없습니다. 관리자에게 문의하세요." };

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next);
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
