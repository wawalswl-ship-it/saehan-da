export function KpiRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <div className="skeleton h-3 w-16" />
          <div className="skeleton mt-3 h-7 w-24" />
          <div className="skeleton mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4" aria-hidden>
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-2 h-3 w-56" />
      <div className="skeleton mt-4 w-full" style={{ height }} />
    </div>
  );
}

/** 페이지 로딩 스켈레톤 */
export function PageSkeleton({ kpis = false, cards = 4 }: { kpis?: boolean; cards?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="데이터를 불러오는 중">
      {kpis && <KpiRowSkeleton />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">데이터를 불러오는 중입니다…</span>
    </div>
  );
}
