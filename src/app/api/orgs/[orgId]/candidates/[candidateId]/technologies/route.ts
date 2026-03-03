import { NextResponse } from 'next/server';
import { createProtectedRoute } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const technologySchema = z.object({
  category: z.string().min(1).max(100),
  items: z.array(z.string().max(100)).min(1).max(50),
});

const technologyUpdateSchema = technologySchema.extend({
  id: z.string().min(1),
});

const technologyDeleteSchema = z.object({
  id: z.string().min(1),
});

export const POST = createProtectedRoute(
  'candidates:write',
  async (req, { params, body }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = technologySchema.parse(payload);

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const technology = await prisma.candidateTechnology.create({
      data: {
        candidateId,
        ...data,
      },
    });

    return NextResponse.json(technology);
  }
);

export const GET = createProtectedRoute(
  'candidates:read',
  async (req, { params }) => {
    const { orgId, candidateId } = await params;

    const technologies = await prisma.candidateTechnology.findMany({
      where: { candidateId, candidate: { orgId } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(technologies);
  }
);

export const PATCH = createProtectedRoute(
  'candidates:write',
  async (req, { params, body }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = technologyUpdateSchema.parse(payload);

    const existing = await prisma.candidateTechnology.findFirst({
      where: { id: data.id, candidateId, candidate: { orgId } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Technology not found' }, { status: 404 });
    }

    const updated = await prisma.candidateTechnology.update({
      where: { id: data.id },
      data: {
        category: data.category,
        items: data.items,
      },
    });

    return NextResponse.json(updated);
  }
);

export const DELETE = createProtectedRoute(
  'candidates:write',
  async (req, { params, body }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = technologyDeleteSchema.parse(payload);

    const existing = await prisma.candidateTechnology.findFirst({
      where: { id: data.id, candidateId, candidate: { orgId } },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Technology not found' }, { status: 404 });
    }

    await prisma.candidateTechnology.delete({ where: { id: data.id } });
    return NextResponse.json({ ok: true });
  }
);
