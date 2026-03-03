"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function JobDeleteButton({
  orgId,
  jobId,
}: {
  orgId: string;
  jobId: string;
}) {
  const router = useRouter();

  async function onDelete() {
    const confirmed = window.confirm(
      "Delete this job? This also removes related skills and match records."
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/orgs/${orgId}/jobs/${jobId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete job");

      toast.success("Job deleted");
      router.push(`/orgs/${orgId}/jobs`);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="rounded-2xl text-destructive hover:bg-destructive/10"
      onClick={onDelete}
    >
      Delete job
    </Button>
  );
}
