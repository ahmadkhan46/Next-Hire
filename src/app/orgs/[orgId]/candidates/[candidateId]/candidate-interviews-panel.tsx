"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type Interview = {
  id: string;
  title: string;
  round: string | null;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  meetingType: string;
  meetingLink: string | null;
  location: string | null;
  interviewer: string | null;
  notes: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  createdAt: string;
};

const statusStyles: Record<Interview["status"], string> = {
  SCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
  NO_SHOW: "border-amber-200 bg-amber-50 text-amber-700",
};

export function CandidateInterviewsPanel({
  orgId,
  candidateId,
  initialInterviews,
}: {
  orgId: string;
  candidateId: string;
  initialInterviews: Interview[];
}) {
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(
    () => [...interviews].sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)),
    [interviews]
  );

  useEffect(() => {
    setInterviews(initialInterviews);
  }, [initialInterviews]);

  const scheduledCount = sorted.filter((item) => item.status === "SCHEDULED").length;
  const completedCount = sorted.filter((item) => item.status === "COMPLETED").length;
  const cancelledCount = sorted.filter((item) => item.status === "CANCELLED").length;

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}/interviews?limit=8`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load interviews");
      setInterviews(
        (json.interviews ?? []).map((item: Interview) => ({
          ...item,
          scheduledAt: new Date(item.scheduledAt).toISOString(),
          createdAt: new Date(item.createdAt).toISOString(),
        }))
      );
    } catch {
      toast.error("Unable to load interviews");
    } finally {
      setLoading(false);
    }
  }

  async function markStatus(interviewId: string, status: Interview["status"]) {
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/candidates/${candidateId}/interviews/${interviewId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update interview");
      setInterviews((prev) =>
        prev.map((item) =>
          item.id === interviewId
            ? {
                ...item,
                status,
              }
            : item
        )
      );
      toast.success("Interview updated");
    } catch {
      toast.error("Unable to update interview");
    }
  }

  return (
    <Card className="premium-block rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Interview workflow</div>
          <div className="text-lg font-semibold">Interviews</div>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-700">
          Scheduled: <span className="font-semibold">{scheduledCount}</span>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-700">
          Completed: <span className="font-semibold">{completedCount}</span>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
          Cancelled: <span className="font-semibold">{cancelledCount}</span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-sm text-muted-foreground">No interviews scheduled yet.</div>
      ) : (
        <div className="space-y-3">
          {(showAll ? sorted : sorted.slice(0, 4)).map((item) => (
            <div
              key={item.id}
              className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(item.scheduledAt).toLocaleString()} ({item.timezone})
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.round ? `${item.round} - ` : ""}
                    {item.meetingType}
                    {item.interviewer ? ` - ${item.interviewer}` : ""}
                  </div>
                </div>
                <Badge variant="outline" className={`rounded-full ${statusStyles[item.status]}`}>
                  {item.status}
                </Badge>
              </div>

              {item.meetingLink ? (
                <a
                  href={item.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-blue-700 underline"
                >
                  Open meeting link
                </a>
              ) : null}

              {item.status === "SCHEDULED" ? (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => markStatus(item.id, "COMPLETED")}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Mark completed
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => markStatus(item.id, "CANCELLED")}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {sorted.length > 4 ? (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll ? "Show fewer interviews" : `Show ${sorted.length - 4} more interviews`}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
