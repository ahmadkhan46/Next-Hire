export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// SECURITY: Only allow in development
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const email = String(body.email || "").toLowerCase().trim();
  const orgName = String(body.orgName || "").trim();
  const name = body.name ? String(body.name).trim() : null;

  if (!email || !orgName) {
    return NextResponse.json({ error: "email and orgName are required" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      update: { name: name ?? undefined },
      create: { email, name: name ?? undefined },
    });

    const org = await tx.organization.create({
      data: { name: orgName },
    });

    await tx.membership.create({
      data: { userId: user.id, orgId: org.id, role: "OWNER" },
    });

    return { user, org };
  });

  return NextResponse.json({
    ok: true,
    userId: result.user.id,
    orgId: result.org.id,
  });
}