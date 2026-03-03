"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";

type JobShape = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  status: string | null;
};

export function EditJob({ orgId, job }: { orgId: string; job: JobShape }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState(job.title ?? "");
  const [description, setDescription] = useState(job.description ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [status, setStatus] = useState(job.status ?? "OPEN");

  async function onSubmit() {
    const t = title.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: description.trim() || null,
          location: location.trim() || null,
          status: status.trim() || "OPEN",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update job");

      toast.success("Job updated");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm(
      "Delete this job? This also removes related skills and match records."
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/jobs/${job.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete job");

      toast.success("Job deleted");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-2xl">
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] rounded-3xl">
        <DialogHeader>
          <DialogTitle>Edit job</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="text-sm text-muted-foreground">Title</div>
            <Input
              className="mt-2 rounded-2xl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Frontend Engineer"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">
              Description (optional)
            </div>
            <Textarea
              className="mt-2 min-h-[120px] rounded-2xl"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Next.js + TS + Tailwind..."
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Location (optional)</div>
            <Input
              className="mt-2 rounded-2xl"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ireland / Remote"
            />
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <select
              className="mt-2 h-10 w-full rounded-2xl border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
            <div className="text-sm font-medium text-destructive">Danger zone</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Deleting a job permanently removes job skills and matchboard history for this role.
            </div>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl text-destructive hover:bg-destructive/10"
                onClick={onDelete}
                disabled={loading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete job
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Link href={`/orgs/${orgId}/jobs/${job.id}/skills`}>
              <Button variant="outline" className="rounded-2xl" type="button">
                Manage Skills
              </Button>
            </Link>
            <Button variant="ghost" className="rounded-2xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-2xl" onClick={onSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
