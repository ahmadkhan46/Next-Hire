export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      <div className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
        <div className="h-4 w-24 rounded-full bg-muted/60" />
        <div className="mt-4 h-8 w-48 rounded-xl bg-muted/60" />
        <div className="mt-3 h-4 w-40 rounded-full bg-muted/40" />
      </div>

      <div className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm space-y-4">
        <div className="h-4 w-24 rounded-full bg-muted/60" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="h-20 rounded-2xl bg-muted/40" />
          <div className="h-20 rounded-2xl bg-muted/40" />
          <div className="h-20 rounded-2xl bg-muted/40" />
          <div className="h-20 rounded-2xl bg-muted/40" />
        </div>
      </div>
    </div>
  );
}
