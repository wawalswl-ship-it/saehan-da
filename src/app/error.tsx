"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex-1">
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-lg font-bold">데이터를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          데이터베이스 연결 또는 조회 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요. 계속되면 환경변수
          DATABASE_URL 설정을 확인해야 합니다.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-10 items-center rounded-md bg-brand-navy px-4 text-sm font-medium text-white hover:bg-brand-navy-dark"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
