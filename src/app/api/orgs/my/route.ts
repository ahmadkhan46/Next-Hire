import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
