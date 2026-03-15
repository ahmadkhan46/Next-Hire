import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  resumeParseTimeoutSeconds: z.number().int().min(10).max(120).optional(),
});

export const PATCH = createProtectedRoute(
  "candidates:write",
  async (req: NextRequest, { params }) => {
    const { orgId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { resumeParseTimeoutSeconds } = parsed.data;
    const data: Record<string, unknown> = {};
    if (resumeParseTimeoutSeconds !== undefined) {
      data.resumeParseTimeoutSeconds = resumeParseTimeoutSeconds;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const org = await prisma.organization.update({
      where: { id: orgId },
      data,
      select: { id: true, resumeParseTimeoutSeconds: true },
    });

    return NextResponse.json({ ok: true, org });
  }
);
