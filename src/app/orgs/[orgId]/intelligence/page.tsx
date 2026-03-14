import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { Sparkles } from "lucide-react";

export default async function IntelligencePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });

  if (!org) redirect("/orgs/demo");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Intelligence
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Hiring Intelligence
          </h1>
          <p className="mt-2 text-muted-foreground">
            Live analytics, pipeline signals, and skills insights for {org.name}.
          </p>
        </div>
      </div>

      <div className="premium-block rounded-3xl border bg-card/50 p-6 shadow-sm">
        <AnalyticsDashboard orgId={orgId} />
      </div>
    </div>
  );
}
