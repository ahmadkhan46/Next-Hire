import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { orgId: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 404 });
  }

  return NextResponse.json({ orgId: membership.orgId });
}
