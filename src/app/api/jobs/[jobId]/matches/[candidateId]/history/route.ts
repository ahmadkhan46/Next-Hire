export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { verifyResourceAccess } from "@/lib/api-middleware";

type Context = { params: Promise<{ jobId: string; candidateId: string }> };

export async function GET(_req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId, candidateId } = await context.params;
    await verifyResourceAccess(userId, undefined, jobId);

    const match = await prisma.matchResult.findUnique({
      where: { jobId_candidateId: { jobId, candidateId } },
      select: { orgId: true },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const history = await prisma.matchDecisionLog.findMany({
      where: { jobId, candidateId, orgId: match.orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        decidedBy: true,
      },
    });

    return NextResponse.json({ ok: true, jobId, candidateId, history });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
