import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          jobs: true,
          candidates: true,
          skills: true,
          memberships: true,
        },
      },
    },
  });

  if (!org) redirect("/orgs/demo");

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Organization Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            View organization details and usage. Editing controls will be added next.
          </p>
        </div>
      </div>

      <div className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Organization</div>
            <div className="mt-1 text-lg font-semibold">{org.name}</div>
            <div className="text-xs text-muted-foreground">
              Created {org.createdAt.toLocaleDateString()}
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full">
            Active
          </Badge>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="premium-subblock rounded-2xl border bg-background/40 p-4">
            <div className="text-xs text-muted-foreground">Candidates</div>
            <div className="mt-2 text-xl font-semibold">{org._count.candidates}</div>
          </div>
          <div className="premium-subblock rounded-2xl border bg-background/40 p-4">
            <div className="text-xs text-muted-foreground">Jobs</div>
            <div className="mt-2 text-xl font-semibold">{org._count.jobs}</div>
          </div>
          <div className="premium-subblock rounded-2xl border bg-background/40 p-4">
            <div className="text-xs text-muted-foreground">Skills</div>
            <div className="mt-2 text-xl font-semibold">{org._count.skills}</div>
          </div>
          <div className="premium-subblock rounded-2xl border bg-background/40 p-4">
            <div className="text-xs text-muted-foreground">Members</div>
            <div className="mt-2 text-xl font-semibold">{org._count.memberships}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
