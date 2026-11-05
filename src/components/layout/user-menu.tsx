import { LogOut, UserRound } from "lucide-react";
import { logout } from "@/app/login/actions";
import { getSession } from "@/lib/session";

/** 헤더 우측: 로그인한 아이디와 로그아웃 버튼 (세션이 없으면 표시하지 않음) */
export async function UserMenu() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <span className="hidden items-center gap-1.5 text-sm text-white/85 sm:inline-flex">
        <UserRound className="size-4" aria-hidden />
        <span className="max-w-32 truncate">{session.userId}</span>
      </span>
      <form action={logout}>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 px-2.5 text-sm text-white hover:bg-white/10"
        >
          <LogOut className="size-4" aria-hidden />
          로그아웃
        </button>
      </form>
    </div>
  );
}
