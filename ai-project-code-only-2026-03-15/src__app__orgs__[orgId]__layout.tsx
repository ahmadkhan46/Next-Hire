import * as React from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const authResult = await auth();
  const userId = authResult.userId;
  if (!userId) {
    redirect("/sign-in");
  }

  let email: string | null = null;
  let derivedName: string | null = null;
  const claims = authResult.sessionClaims as Record<string, unknown> | null | undefined;
  const possibleEmail =
    (claims?.email as string | undefined) ||
    (claims?.primary_email as string | undefined) ||
    (claims?.primaryEmail as string | undefined);
  if (typeof possibleEmail === "string") {
    email = possibleEmail;
  } else {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      email =
        user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
      derivedName =
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
        user.username ||
        (email ? email.split("@")[0] : null);
    } catch {
      email = null;
    }
  }

  if (!derivedName && email) {
    const local = email.split("@")[0]?.trim() ?? "";
    derivedName = local ? local : null;
  }

  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { id: userId },
        email ? { email: email.toLowerCase() } : undefined,
      ].filter(Boolean) as any,
    },
    select: { id: true, name: true, email: true },
  });

  if (!dbUser) {
    redirect("/orgs/demo");
  }

  const normalizedEmail = email?.toLowerCase() ?? null;
  const shouldBackfillName = !dbUser.name && !!derivedName;
  const shouldBackfillEmail = !!normalizedEmail && dbUser.email !== normalizedEmail;
  if (shouldBackfillName || shouldBackfillEmail) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        ...(shouldBackfillName ? { name: derivedName } : {}),
        ...(shouldBackfillEmail ? { email: normalizedEmail! } : {}),
      },
    });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: dbUser.id, orgId } },
    select: { id: true },
  });

  if (!membership) {
    redirect("/orgs/demo");
  }

  return <AppShell orgId={orgId}>{children}</AppShell>;
}
