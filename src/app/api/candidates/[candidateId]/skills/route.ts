export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { handleAPIError } from "@/lib/errors";
import { verifyResourceAccess } from "@/lib/api-middleware";

type Context = { params: Promise<{ candidateId: string }> };

export async function GET(_req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { candidateId } = await context.params;

    // SECURITY: Verify user has access to this candidate's org
    await verifyResourceAccess(userId, candidateId);

    const rows = await prisma.candidateSkill.findMany({
      where: { candidateId },
      include: { skill: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      candidateId,
      skills: rows.map((r) => ({
        id: r.skill.id,
        name: r.skill.name,
        source: r.source,
        level: r.level,
        linkedAt: r.createdAt,
      })),
    });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}
