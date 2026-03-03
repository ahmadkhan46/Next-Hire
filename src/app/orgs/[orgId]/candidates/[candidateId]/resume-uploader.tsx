"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ResumeMeta = {
  id: string;
  fileName: string | null;
  parseStatus: string;
  parseError: string | null;
  parsedAt: string | null;
  parseModel: string | null;
  promptVersion: string | null;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatStatus(status: string) {
  switch (status) {
    case "SAVED":
      return { label: "Parsed", variant: "secondary" as const };
    case "EXTRACTING":
      return { label: "Extracting", variant: "outline" as const };
    case "NEEDS_REVIEW":
      return { label: "Needs review", variant: "destructive" as const };
    case "FAILED":
      return { label: "Failed", variant: "destructive" as const };
    default:
      return { label: status ?? "Queued", variant: "outline" as const };
  }
}

function formatParsedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}

export function ResumeUploader({
  orgId,
  candidateId,
  latestResume,
}: {
  orgId: string;
  candidateId: string;
  latestResume: ResumeMeta | null;
}) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [resume, setResume] = React.useState<ResumeMeta | null>(latestResume);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      toast.error("File exceeds 5MB limit");
      e.target.value = "";
      return;
    }
    if (!ALLOWED.includes(selected.type)) {
      toast.error("Only PDF or DOCX is supported");
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const parseResume = async (resumeId: string, force = false) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/candidates/${candidateId}/resumes/${resumeId}/parse${force ? "?force=true" : ""}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Parse failed");
      toast.success("Resume parsed");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Parse failed");
    } finally {
      setBusy(false);
    }
  };

  const uploadAndParse = async () => {
    if (!file) {
      toast.error("Select a resume first");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const upload = await fetch(
        `/api/orgs/${orgId}/candidates/${candidateId}/resumes/upload`,
        { method: "POST", body: form }
      );
      const uploadData = await upload.json().catch(() => ({}));
      if (!upload.ok) throw new Error(uploadData?.error ?? "Upload failed");
      const newResume = uploadData.resume as ResumeMeta;
      setResume(newResume);
      setFile(null);
      toast.success("Uploaded. Parsing now...");
      await parseResume(newResume.id, false);
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const status = resume ? formatStatus(resume.parseStatus) : null;

  return (
    <div className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Resume</div>
          <div className="mt-1 text-lg font-semibold">Upload & Parse</div>
          <p className="mt-2 text-sm text-muted-foreground">
            PDF or DOCX up to 5MB. Parsing will update the candidate profile.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {resume ? (
            <div className="flex flex-col items-end gap-1 text-right">
              <Badge variant={status?.variant ?? "outline"} className="rounded-full">
                {status?.label ?? "Queued"}
              </Badge>
              <div className="text-xs text-muted-foreground">
                {resume.fileName ?? "Latest resume"}
              </div>
              {resume.parsedAt ? (
                <div className="text-xs text-muted-foreground">
                  Parsed {formatParsedAt(resume.parsedAt)} UTC
                </div>
              ) : null}
            </div>
          ) : (
            <Badge variant="outline" className="rounded-full">
              No resume yet
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onFileChange}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-2xl"
            onClick={uploadAndParse}
            disabled={busy || !file}
          >
            {busy ? "Working..." : "Upload & Parse"}
          </Button>
          {resume ? (
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => parseResume(resume.id, true)}
              disabled={busy}
            >
              Re-parse
            </Button>
          ) : null}
        </div>
      </div>

      {resume?.parseError ? (
        <div className="mt-4 text-xs text-red-500">
          {resume.parseError}
        </div>
      ) : null}
    </div>
  );
}
