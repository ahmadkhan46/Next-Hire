import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isClerkServerEnabled } from "@/lib/clerk-config";

export async function GET() {
  if (!isClerkServerEnabled()) {
    return NextResponse.json(
      { error: "Server auth not configured", hint: "Set matching NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in Vercel." },
      { status: 503 }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set DATABASE_URL in Vercel environment variables." },
      { status: 503 }
    );
  }

  try {
    const authResult = await auth();
    const userId = authResult.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let membership = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { orgId: true },
    });

    // Resolve email (needed for fallback lookup and auto-bootstrap)
    let resolvedEmail: string | null = null;
    if (!membership) {
      const claims = authResult.sessionClaims as Record<string, unknown> | null | undefined;
      resolvedEmail =
        (claims?.email as string | undefined) ||
        (claims?.primary_email as string | undefined) ||
        (claims?.primaryEmail as string | undefined) ||
        null;

      if (!resolvedEmail) {
        try {
          const client = await clerkClient();
          const user = await client.users.getUser(userId);
          resolvedEmail =
            user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
              ?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
        } catch {
          resolvedEmail = null;
        }
      }

      // Fallback: look up by email (Clerk user ID may have changed)
      if (resolvedEmail) {
        const dbUser = await prisma.user.findUnique({
          where: { email: resolvedEmail.toLowerCase() },
          select: { id: true },
        });

        if (dbUser) {
          membership = await prisma.membership.findFirst({
            where: { userId: dbUser.id },
            orderBy: { createdAt: "asc" },
            select: { orgId: true },
          });
        }
      }
    }

    if (!membership) {
      // Auto-bootstrap: first sign-in — create user + org + membership
      if (!resolvedEmail) {
        return NextResponse.json({ error: "No organization" }, { status: 404 });
      }

      const email = resolvedEmail;
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { email: email.toLowerCase() },
          update: { id: userId },
          create: { id: userId, email: email.toLowerCase(), name: email.split("@")[0] },
          select: { id: true },
        });

        let org = await tx.organization.findFirst({
          where: { memberships: { some: { userId: user.id } } },
          select: { id: true },
        });

        if (!org) {
          org = await tx.organization.create({
            data: { name: `${email.split("@")[0]}'s Workspace` },
            select: { id: true },
          });
          await tx.membership.create({
            data: { userId: user.id, orgId: org.id, role: "OWNER" },
          });
        }

        return { orgId: org.id };
      });

      return NextResponse.json({ orgId: result.orgId });
    }

    return NextResponse.json({ orgId: membership.orgId });
  } catch (error) {
    console.error("GET /api/orgs/my failed", error);

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: "Database connection failed", hint: "Check DATABASE_URL and DB network allowlist for Vercel." },
        { status: 503 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: "Database query failed", code: error.code, hint: "Run production migrations: npx prisma migrate deploy." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
