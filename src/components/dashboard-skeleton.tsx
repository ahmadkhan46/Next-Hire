export function DashboardSkeleton() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="prestige-bg" />
      <div className="prestige-grid" />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 py-12 space-y-12">
        {/* Hero Card Skeleton */}
        <div className="premium-block prestige-card rounded-[32px] p-10 md:p-12 animate-pulse">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-6 flex-1">
              <div className="h-8 w-48 bg-slate-200 rounded-full" />
              <div className="h-16 w-full max-w-md bg-slate-200 rounded-2xl" />
              <div className="h-24 w-full max-w-2xl bg-slate-200 rounded-2xl" />
              <div className="flex gap-4">
                <div className="h-12 w-40 bg-slate-200 rounded-2xl" />
                <div className="h-12 w-32 bg-slate-200 rounded-2xl" />
              </div>
            </div>
            <div className="h-32 w-48 bg-slate-200 rounded-3xl" />
          </div>
        </div>

        {/* Analytics Card Skeleton */}
        <div className="premium-block prestige-card rounded-[28px] p-8 md:p-10 animate-pulse">
          <div className="h-10 w-64 bg-slate-200 rounded-2xl mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-200 rounded-2xl" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="premium-block prestige-card rounded-3xl p-7 animate-pulse">
              <div className="h-32 bg-slate-200 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
