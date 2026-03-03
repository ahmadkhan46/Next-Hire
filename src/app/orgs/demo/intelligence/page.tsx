export default function DemoIntelligencePage() {
  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto w-full max-w-[1100px] space-y-6">
        <div className="premium-block prestige-card rounded-[28px] p-8">
          <h1 className="text-2xl font-semibold text-slate-900">Intelligence</h1>
          <p className="text-slate-600 mt-2">
            Insights are disabled in guest mode. Sign in to run AI matching and analytics.
          </p>
        </div>

        <div className="premium-block prestige-card rounded-[24px] p-8">
          <div className="text-sm text-slate-500">
            This area is read-only for demo access.
          </div>
        </div>
      </div>
    </div>
  );
}
