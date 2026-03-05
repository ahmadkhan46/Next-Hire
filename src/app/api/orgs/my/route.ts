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

    // Fallback for deployments where Clerk user IDs changed but email stayed the same.
    if (!membership) {
      const claims = authResult.sessionClaims as Record<string, unknown> | null | undefined;
      let email =
        (claims?.email as string | undefined) ||
        (claims?.primary_email as string | undefined) ||
        (claims?.primaryEmail as string | undefined) ||
        null;

      if (!email) {
        try {
          const client = await clerkClient();
          const user = await client.users.getUser(userId);
          email =
            user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
              ?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
        } catch {
          email = null;
        }
      }

      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
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
      return NextResponse.json({ error: "No organization" }, { status: 404 });
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
