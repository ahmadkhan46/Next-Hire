import { NextResponse } from 'next/server';
import { createProtectedRoute } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logCandidateActivity } from '@/lib/candidate-activity';
import { z } from 'zod';

const projectSchema = z.object({
  title: z.string().min(1).max(200),
  dates: z.string().max(100).optional(),
  techStack: z.string().max(500).optional(),
  link: z.string().url().max(500).optional().or(z.literal('')),
  bullets: z.array(z.string().max(500)).max(10).optional(),
});

const projectUpdateSchema = projectSchema.extend({
  id: z.string().min(1),
});

const projectDeleteSchema = z.object({
  id: z.string().min(1),
});

export const POST = createProtectedRoute(
  'candidates:write',
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = projectSchema.parse(payload);

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const project = await prisma.candidateProject.create({
      data: {
        candidateId,
        title: data.title,
        dates: data.dates,
        techStack: data.techStack,
        link: data.link || null,
        bullets: data.bullets || [],
      },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'PROJECT_ADDED',
      title: 'Project added',
      description: `${data.title} was added.`,
      actorId: userId,
    });

    return NextResponse.json(project);
  }
);

export const GET = createProtectedRoute(
  'candidates:read',
  async (req, { params }) => {
    const { orgId, candidateId } = await params;

    const projects = await prisma.candidateProject.findMany({
      where: { candidateId, candidate: { orgId } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(projects);
  }
);

export const PATCH = createProtectedRoute(
  'candidates:write',
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = projectUpdateSchema.parse(payload);

    const existing = await prisma.candidateProject.findFirst({
      where: { id: data.id, candidateId, candidate: { orgId } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updated = await prisma.candidateProject.update({
      where: { id: data.id },
      data: {
        title: data.title,
        dates: data.dates,
        techStack: data.techStack,
        link: data.link || null,
        bullets: data.bullets || [],
      },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'PROJECT_UPDATED',
      title: 'Project updated',
      description: `${data.title} was updated.`,
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
    const data = projectDeleteSchema.parse(payload);

    const existing = await prisma.candidateProject.findFirst({
      where: { id: data.id, candidateId, candidate: { orgId } },
      select: { id: true, title: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await prisma.candidateProject.delete({ where: { id: data.id } });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'PROJECT_REMOVED',
      title: 'Project removed',
      description: `${existing.title} was removed.`,
      actorId: userId,
    });

    return NextResponse.json({ ok: true });
  }
);
