"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { AddCandidateMultiStep } from "@/components/add-candidate-multi-step";
import { RefreshAllMatches } from "@/components/refresh-all-matches";
import { ExportCandidates } from "@/components/export-candidates";
import { BulkImport } from "./bulk-import";
import { BulkResumeUpload } from "./bulk-resume-upload";

export function CandidatesActions({ orgId }: { orgId: string }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
        <Link
          href={`/orgs/${orgId}/candidates/compare`}
          className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
        >
          Compare Candidates <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/orgs/${orgId}/uploads`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
        >
          Import Activity <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/orgs/${orgId}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
        >
          Back <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
      <RefreshAllMatches orgId={orgId} />
      <AddCandidateMultiStep orgId={orgId} />
      <BulkImport orgId={orgId} />
      <BulkResumeUpload orgId={orgId} />
      <ExportCandidates orgId={orgId} />
      <Link
        href={`/orgs/${orgId}/candidates/compare`}
        className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
      >
        Compare Candidates <ArrowUpRight className="h-4 w-4" />
      </Link>
      <Link
        href={`/orgs/${orgId}/uploads`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
      >
        Import Activity <ArrowUpRight className="h-4 w-4" />
      </Link>
      <Link
        href={`/orgs/${orgId}`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm transition hover:bg-accent/60 sm:w-auto"
      >
        Back <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
