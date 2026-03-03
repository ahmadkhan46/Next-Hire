export default function IntelligenceLoading() {
  return (
    <div className="space-y-8">
      <div className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
        <div className="h-4 w-28 rounded-full bg-muted/60" />
        <div className="mt-4 h-8 w-56 rounded-xl bg-muted/60" />
        <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-muted/40" />
      </div>

      <div className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm space-y-4">
        <div className="h-16 rounded-2xl bg-muted/40" />
        <div className="h-16 rounded-2xl bg-muted/40" />
        <div className="h-16 rounded-2xl bg-muted/40" />
      </div>
    </div>
  );
}
