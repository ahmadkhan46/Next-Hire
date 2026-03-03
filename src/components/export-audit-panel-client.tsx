"use client";

import dynamic from "next/dynamic";

const ExportAuditPanel = dynamic(
  () => import("@/components/export-audit-panel").then(m => ({ default: m.ExportAuditPanel })),
  { ssr: false }
);

export function ExportAuditPanelClient({ orgId, jobId }: { orgId: string; jobId?: string }) {
  return <ExportAuditPanel orgId={orgId} jobId={jobId} />;
}
