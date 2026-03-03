import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { JobPageAuditAction } from "@prisma/client";

export type JobAuditEventView = {
  id: string;
  createdAt: string;
  action: JobPageAuditAction;
  summary: string | null;
  actorId: string | null;
  actorName: string | null;
  metadata: unknown;
};

function nameFromEmail(email: string | null) {
  if (!email) return null;
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export async function resolveActorNames(actorIds: string[]) {
  const uniqueIds = Array.from(new Set(actorIds.filter(Boolean)));
  const labels = new Map<string, string>();
  if (uniqueIds.length === 0) return labels;

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, email: true },
  });
  for (const user of users) {
    labels.set(user.id, user.name?.trim() || nameFromEmail(user.email) || user.id);
  }

  const unresolved = uniqueIds.filter((id) => {
    const current = labels.get(id);
    return !current || current === id || current.startsWith("user_");
  });
  if (unresolved.length === 0) return labels;

  try {
    const client = await clerkClient();
    await Promise.all(
      unresolved.map(async (id) => {
        try {
          const clerkUser = await client.users.getUser(id);
          const email =
            clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
              ?.emailAddress ?? clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
          const fullName = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim();
          const label = fullName || clerkUser.username || nameFromEmail(email) || id;
          labels.set(id, label);
        } catch {
          // ignore Clerk lookup failures
        }
      })
    );
  } catch {
    // ignore Clerk client failures
  }

  return labels;
}

export async function fetchJobAuditEvents(input: {
  orgId: string;
  jobId: string;
  take?: number;
  cursor?: string | null;
  action?: JobPageAuditAction | null;
  fromDate?: string | null;
  toDate?: string | null;
}) {
  const take = Math.min(Math.max(input.take ?? 25, 1), 100);
  const where: {
    orgId: string;
    jobId: string;
    action?: JobPageAuditAction;
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    orgId: input.orgId,
    jobId: input.jobId,
  };

  if (input.action) where.action = input.action;
  if (input.fromDate || input.toDate) {
    where.createdAt = {};
    if (input.fromDate) where.createdAt.gte = new Date(`${input.fromDate}T00:00:00.000Z`);
    if (input.toDate) where.createdAt.lte = new Date(`${input.toDate}T23:59:59.999Z`);
  }

  const rows = await prisma.jobPageAuditEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      action: true,
      summary: true,
      actorId: true,
      metadata: true,
    },
  });

  const hasMore = rows.length > take;
  const page = rows.slice(0, take);
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  const actorIds = page
    .map((row) => row.actorId)
    .filter((value): value is string => Boolean(value));
  const actorNames = await resolveActorNames(actorIds);

  const events: JobAuditEventView[] = page.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    action: row.action,
    summary: row.summary,
    actorId: row.actorId,
    actorName: row.actorId ? actorNames.get(row.actorId) ?? row.actorId : null,
    metadata: row.metadata,
  }));

  return {
    events,
    hasMore,
    nextCursor,
  };
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildJobAuditCsv(rows: JobAuditEventView[]) {
  const headers = [
    "id",
    "createdAt",
    "action",
    "summary",
    "actorId",
    "actorName",
    "metadata",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.id),
        escapeCsv(row.createdAt),
        escapeCsv(row.action),
        escapeCsv(row.summary),
        escapeCsv(row.actorId),
        escapeCsv(row.actorName),
        escapeCsv(row.metadata),
      ].join(",")
    );
  }
  return lines.join("\n");
}
