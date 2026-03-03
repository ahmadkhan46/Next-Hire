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
      <div className="flex items-center gap-2">
        <Link
          href={`/orgs/${orgId}/candidates/compare`}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border bg-card/60 px-4 py-2 text-sm hover:bg-accent/60 transition"
        >
          Compare Candidates <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/orgs/${orgId}/uploads`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border bg-card/60 px-4 py-2 text-sm hover:bg-accent/60 transition"
        >
          Import Activity <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/orgs/${orgId}`}
          className="inline-flex items-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm hover:bg-accent/60 transition"
        >
          Back <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <RefreshAllMatches orgId={orgId} />
      <AddCandidateMultiStep orgId={orgId} />
      <BulkImport orgId={orgId} />
      <BulkResumeUpload orgId={orgId} />
      <ExportCandidates orgId={orgId} />
      <Link
        href={`/orgs/${orgId}/candidates/compare`}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border bg-card/60 px-4 py-2 text-sm hover:bg-accent/60 transition"
      >
        Compare Candidates <ArrowUpRight className="h-4 w-4" />
      </Link>
      <Link
        href={`/orgs/${orgId}/uploads`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border bg-card/60 px-4 py-2 text-sm hover:bg-accent/60 transition"
      >
        Import Activity <ArrowUpRight className="h-4 w-4" />
      </Link>
      <Link
        href={`/orgs/${orgId}`}
        className="inline-flex items-center gap-2 rounded-2xl border bg-card/60 px-4 py-2 text-sm hover:bg-accent/60 transition"
      >
        Back <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
