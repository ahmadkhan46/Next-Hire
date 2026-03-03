export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { handleAPIError } from "@/lib/errors";
import { verifyResourceAccess } from "@/lib/api-middleware";

type Context = { params: Promise<{ candidateId: string }> };

export async function POST(req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { candidateId } = await context.params;

    // SECURITY: Verify user has access to this candidate's org
    await verifyResourceAccess(userId, candidateId);

    const body = await req.json();

    const fileName = body.fileName ? String(body.fileName).trim() : null;
    const mimeType = body.mimeType ? String(body.mimeType).trim() : null;
    const sizeBytes =
      body.sizeBytes !== undefined && body.sizeBytes !== null
        ? Number(body.sizeBytes)
        : null;

    const rawText = body.rawText ? String(body.rawText) : null;
    const parsedJson = body.parsedJson ?? null;

    if (!rawText && !parsedJson) {
      return NextResponse.json(
        { error: "Provide at least rawText or parsedJson" },
        { status: 400 }
      );
    }

    const resume = await prisma.resume.create({
      data: {
        candidateId,
        fileName: fileName ?? undefined,
        mimeType: mimeType ?? undefined,
        sizeBytes: Number.isFinite(sizeBytes as number) ? (sizeBytes as number) : undefined,
        rawText: rawText ?? undefined,
        parsedJson: parsedJson ?? undefined,
        parseStatus: parsedJson ? "SAVED" : "QUEUED",
        parsedAt: parsedJson ? new Date() : undefined,
      },
    });

    return NextResponse.json({ ok: true, resume });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}

export async function GET(_req: Request, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { candidateId } = await context.params;

    // SECURITY: Verify user has access to this candidate's org
    await verifyResourceAccess(userId, candidateId);

    const resumes = await prisma.resume.findMany({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ ok: true, resumes });
  } catch (err: any) {
    const handled = handleAPIError(err);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}
