export default function DemoSettingsPage() {
  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto w-full max-w-[1100px] space-y-6">
        <div className="premium-block prestige-card rounded-[28px] p-8">
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">
            Settings are locked in guest mode. Sign in to edit organization preferences.
          </p>
        </div>

        <div className="premium-block prestige-card rounded-[24px] p-8">
          <div className="text-sm text-slate-500">
            Read-only access for demo users.
          </div>
        </div>
      </div>
    </div>
  );
}
