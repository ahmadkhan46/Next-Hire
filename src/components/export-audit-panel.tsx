"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  FileText,
  BarChart3,
  Users,
  Shield,
  Calendar,
  Sparkles,
  ChevronRight,
} from "lucide-react";

interface ExportOptions {
  type: "decisions" | "candidates" | "analytics";
  format: "json" | "csv";
  jobId?: string;
  startDate?: string;
  endDate?: string;
}

interface AuditSummary {
  totalDecisions: number;
  automatedDecisions: number;
  manualDecisions: number;
  automationRate: number;
  averageDecisionTimeHours: number | null;
  decisionsByStatus: Record<string, number>;
}

const EXPORT_TYPES: Array<{
  value: ExportOptions["type"];
  label: string;
  icon: typeof FileText;
  desc: string;
}> = [
  {
    value: "decisions",
    label: "Decisions",
    icon: FileText,
    desc: "Status transitions and decision logs",
  },
  {
    value: "candidates",
    label: "Candidates",
    icon: Users,
    desc: "Profiles, skills, and background data",
  },
  {
    value: "analytics",
    label: "Analytics",
    icon: BarChart3,
    desc: "Match metrics and trend snapshots",
  },
];

const FORMATS: Array<ExportOptions["format"]> = ["csv", "json"];

export function ExportAuditPanel({
  orgId,
  jobId,
}: {
  orgId: string;
  jobId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    type: "decisions",
    format: "csv",
    jobId,
  });

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: exportOptions.type,
        format: exportOptions.format,
      });

      if (exportOptions.jobId) params.append("jobId", exportOptions.jobId);
      if (exportOptions.startDate) params.append("startDate", exportOptions.startDate);
      if (exportOptions.endDate) params.append("endDate", exportOptions.endDate);

      const response = await fetch(`/api/orgs/${orgId}/export?${params}`);
      if (!response.ok) {
        throw new Error("Export request failed");
      }

      if (exportOptions.format === "csv") {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exportOptions.type}-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exportOptions.type}-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }

      toast.success("Export complete");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadAuditSummary = async () => {
    try {
      const params = new URLSearchParams();
      if (jobId) params.append("jobId", jobId);
      const response = await fetch(`/api/orgs/${orgId}/audit?${params}`);
      if (!response.ok) throw new Error("Failed to load audit summary");
      const data = await response.json();
      setAuditSummary(data.summary);
    } catch (error) {
      console.error("Failed to load audit summary:", error);
      toast.error("Failed to load audit summary");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && !auditSummary) {
      void loadAuditSummary();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 rounded-2xl border-slate-300/80 bg-white/80 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
        >
          <Download className="h-4 w-4" />
          Export & Audit
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[95vw] sm:max-w-6xl xl:max-w-7xl rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50/80 p-0 shadow-[0_34px_90px_-44px_rgba(15,23,42,0.45)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 border-b px-6 py-5">
            <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl">Export & Audit Center</div>
              <div className="text-sm font-normal text-muted-foreground">
                Export structured data and verify decision traceability.
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Export decisions, candidates, and analytics data and review audit summary.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 px-6 pb-6 lg:grid-cols-[1.45fr_1fr]">
          <Card className="premium-block rounded-2xl border border-slate-200 bg-white/80 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Data Export</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Export Type</Label>
                <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
                  {EXPORT_TYPES.map(({ value, label, icon: Icon, desc }) => (
                    <button
                      key={value}
                      onClick={() => setExportOptions((prev) => ({ ...prev, type: value }))}
                      className={`rounded-xl border p-3 text-left text-sm transition ${
                        exportOptions.type === value
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="text-base font-semibold">{label}</span>
                      </div>
                      <div
                        className={`mt-1 text-sm ${
                          exportOptions.type === value
                            ? "text-slate-200"
                            : "text-muted-foreground"
                        }`}
                      >
                        {desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Format</Label>
                <div className="mt-2 flex gap-2">
                  {FORMATS.map((format) => (
                    <button
                      key={format}
                      onClick={() => setExportOptions((prev) => ({ ...prev, format }))}
                      className={`rounded-lg border px-4 py-2 text-sm transition ${
                        exportOptions.format === format
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start-date" className="text-sm font-medium">
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={exportOptions.startDate || ""}
                    onChange={(e) =>
                      setExportOptions((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-sm font-medium">
                    End Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={exportOptions.endDate || ""}
                    onChange={(e) =>
                      setExportOptions((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <Button onClick={handleExport} disabled={loading} className="h-11 w-full gap-2 rounded-xl text-base">
                <Download className="h-4 w-4" />
                {loading ? "Exporting..." : `Export ${exportOptions.type}`}
              </Button>
            </div>
          </Card>

          <Card className="premium-block rounded-2xl border border-slate-200 bg-white/80 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Audit Summary</h3>
              <Badge variant="secondary" className="rounded-full text-[10px]">
                Live
              </Badge>
            </div>

            {auditSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm text-muted-foreground">Total Decisions</div>
                    <div className="text-2xl font-semibold">{auditSummary.totalDecisions}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm text-muted-foreground">Automation Rate</div>
                    <div className="text-2xl font-semibold">{auditSummary.automationRate}%</div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium">Decision Breakdown</div>
                  <div className="space-y-2">
                    {Object.entries(auditSummary.decisionsByStatus ?? {}).map(([status, count]) => (
                      <div
                        key={status}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <Badge variant="outline" className="capitalize">
                          {status}
                        </Badge>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {auditSummary.averageDecisionTimeHours ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm text-muted-foreground">Avg Decision Time</div>
                    <div className="text-lg font-semibold">
                      {auditSummary.averageDecisionTimeHours}h
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <div className="text-sm text-blue-700">Automated</div>
                    <div className="text-lg font-semibold text-blue-900">
                      {auditSummary.automatedDecisions}
                    </div>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                    <div className="text-sm text-green-700">Manual</div>
                    <div className="text-lg font-semibold text-green-900">
                      {auditSummary.manualDecisions}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground">
                Loading audit summary...
              </div>
            )}
          </Card>
        </div>

        <Separator className="mx-6" />

        <div className="px-6 pb-6 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Compliance Notes</span>
          </div>
          <ul className="ml-2 space-y-1">
            <li className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 h-3.5 w-3.5" />
              All decision changes are logged with timestamps and reasons
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 h-3.5 w-3.5" />
              Exported data includes full audit trails for compliance review
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 h-3.5 w-3.5" />
              Automated decisions are clearly marked and traceable
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="mt-0.5 h-3.5 w-3.5" />
              Data exports support GDPR and equal opportunity reporting
            </li>
          </ul>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px]">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Audit pack ready for governance, legal, and compliance reviews
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
