"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert, LogIn } from "lucide-react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

const inputClass =
  "mt-1 h-11 w-full rounded-md border border-input bg-white px-3 text-[15px] text-foreground placeholder:text-muted-foreground";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={searchParams.get("next") ?? "/"} />
      <div>
        <label htmlFor="login-id" className="text-sm font-medium">
          아이디
        </label>
        <input id="login-id" name="id" type="text" autoComplete="username" required autoFocus className={inputClass} />
      </div>
      <div>
        <label htmlFor="login-password" className="text-sm font-medium">
          비밀번호
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-status-danger"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-navy text-[15px] font-semibold text-white hover:bg-brand-navy-dark disabled:opacity-60"
      >
        <LogIn className="size-4" aria-hidden />
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
