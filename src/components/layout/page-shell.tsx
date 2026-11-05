import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  description: string;
  /** 이 페이지가 해결하는 현업 문제 (사내 AI 설문 결과) */
  solves?: string;
  banner?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, description, solves, banner, children }: PageShellProps) {
  return (
    <main id="main" className="flex-1">
      {banner}
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <header className="mb-4">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {solves && (
            <p className="mt-2 inline-block rounded-md bg-brand-navy-soft px-2.5 py-1 text-xs text-brand-navy-dark">
              <span className="font-semibold">해결하려는 현업 문제</span> · {solves}
            </p>
          )}
        </header>
        <div className="space-y-4">{children}</div>
      </div>
    </main>
  );
}
