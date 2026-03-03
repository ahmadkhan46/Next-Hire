import { NextResponse } from 'next/server';
import { createProtectedRoute } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logCandidateActivity } from '@/lib/candidate-activity';
import { z } from 'zod';

const experienceSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  location: z.string().max(200).optional(),
  startMonth: z.string().datetime(),
  endMonth: z.string().datetime().optional().nullable(),
  isCurrent: z.boolean().default(false),
  bullets: z.array(z.string().max(500)).max(10).optional(),
});

const experienceUpdateSchema = experienceSchema.extend({
  id: z.string().min(1),
});

const experienceDeleteSchema = z.object({
  id: z.string().min(1),
});

export const POST = createProtectedRoute(
  'candidates:write',
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = experienceSchema.parse(payload);

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const experience = await prisma.candidateExperience.create({
      data: {
        candidateId,
        company: data.company,
        role: data.role,
        location: data.location,
        startMonth: new Date(data.startMonth),
        endMonth: data.endMonth ? new Date(data.endMonth) : null,
        isCurrent: data.isCurrent,
        bullets: data.bullets || [],
      },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'EXPERIENCE_ADDED',
      title: 'Experience added',
      description: `${data.role} at ${data.company} was added.`,
      actorId: userId,
    });

    return NextResponse.json(experience);
  }
);

export const GET = createProtectedRoute(
  'candidates:read',
  async (req, { params }) => {
    const { orgId, candidateId } = await params;

    const experiences = await prisma.candidateExperience.findMany({
      where: { candidateId, candidate: { orgId } },
      orderBy: { startMonth: 'desc' },
    });

    return NextResponse.json(experiences);
  }
);

export const PATCH = createProtectedRoute(
  'candidates:write',
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = experienceUpdateSchema.parse(payload);

    const existing = await prisma.candidateExperience.findFirst({
      where: { id: data.id, candidateId, candidate: { orgId } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    const updated = await prisma.candidateExperience.update({
      where: { id: data.id },
      data: {
        company: data.company,
        role: data.role,
        location: data.location,
        startMonth: new Date(data.startMonth),
        endMonth: data.endMonth ? new Date(data.endMonth) : null,
        isCurrent: data.isCurrent,
        bullets: data.bullets || [],
      },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'EXPERIENCE_UPDATED',
      title: 'Experience updated',
      description: `${data.role} at ${data.company} was updated.`,
      actorId: userId,
    });

    return NextResponse.json(updated);
  }
);

export const DELETE = createProtectedRoute(
  'candidates:write',
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = experienceDeleteSchema.parse(payload);

    const existing = await prisma.candidateExperience.findFirst({
      where: { id: data.id, candidateId, candidate: { orgId } },
      select: { id: true, role: true, company: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    await prisma.candidateExperience.delete({ where: { id: data.id } });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'EXPERIENCE_REMOVED',
      title: 'Experience removed',
      description: `${existing.role} at ${existing.company} was removed.`,
      actorId: userId,
    });

    return NextResponse.json({ ok: true });
  }
);
