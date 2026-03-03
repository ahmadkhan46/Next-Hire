const demoCandidates = [
  { name: "Amina Yusuf", role: "Product Designer", status: "Shortlisted" },
  { name: "Leo Martinez", role: "Frontend Engineer", status: "Review" },
  { name: "Sofia Ivanova", role: "Data Scientist", status: "Interview" },
];

export default function DemoCandidatesPage() {
  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto w-full max-w-[1100px] space-y-6">
        <div className="premium-block prestige-card rounded-[28px] p-8">
          <h1 className="text-2xl font-semibold text-slate-900">Candidates</h1>
          <p className="text-slate-600 mt-2">
            Demo data only. Sign in to view live candidates.
          </p>
        </div>

        <div className="premium-block prestige-card rounded-[24px] p-6 space-y-3">
          {demoCandidates.map((candidate) => (
            <div
              key={candidate.name}
              className="premium-subblock flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {candidate.name}
                </div>
                <div className="text-xs text-slate-500">{candidate.role}</div>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold prestige-pill">
                {candidate.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
