import { NextResponse } from 'next/server';
import { createProtectedRoute } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logCandidateActivity } from '@/lib/candidate-activity';
import { z } from 'zod';

const educationSchema = z.object({
  school: z.string().min(1).max(200),
  degree: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  startYear: z.number().int().min(1950).max(2100).optional(),
  endYear: z.number().int().min(1950).max(2100).optional(),
});

const educationUpdateSchema = educationSchema.extend({
  id: z.string().min(1),
});

const educationDeleteSchema = z.object({
  id: z.string().min(1),
});

export const POST = createProtectedRoute(
  'candidates:write',
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = educationSchema.parse(payload);

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const education = await prisma.candidateEducation.create({
      data: {
        candidateId,
        ...data,
      },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'EDUCATION_ADDED',
      title: 'Education added',
      description: `${data.degree ?? 'Education'} at ${data.school} was added.`,
      actorId: userId,
    });

    return NextResponse.json(education);
  }
);

export const GET = createProtectedRoute(
  'candidates:read',
  async (req, { params }) => {
    const { orgId, candidateId } = await params;

    const educations = await prisma.candidateEducation.findMany({
      where: { candidateId, candidate: { orgId } },
      orderBy: [{ endYear: 'desc' }, { startYear: 'desc' }],
    });

    return NextResponse.json(educations);
  }
);

export const PATCH = createProtectedRoute(
  'candidates:write',
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = educationUpdateSchema.parse(payload);

    const existing = await prisma.candidateEducation.findFirst({
      where: { id: data.id, candidateId, candidate: { orgId } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Education not found' }, { status: 404 });
    }

    const updated = await prisma.candidateEducation.update({
      where: { id: data.id },
      data: {
        school: data.school,
        degree: data.degree,
        location: data.location,
        startYear: data.startYear,
        endYear: data.endYear,
      },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'EDUCATION_UPDATED',
      title: 'Education updated',
      description: `${data.degree ?? 'Education'} at ${data.school} was updated.`,
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
    const data = educationDeleteSchema.parse(payload);

    const existing = await prisma.candidateEducation.findFirst({
      where: { id: data.id, candidateId, candidate: { orgId } },
      select: { id: true, school: true, degree: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Education not found' }, { status: 404 });
    }

    await prisma.candidateEducation.delete({ where: { id: data.id } });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'EDUCATION_REMOVED',
      title: 'Education removed',
      description: `${existing.degree ?? 'Education'} at ${existing.school} was removed.`,
      actorId: userId,
    });

    return NextResponse.json({ ok: true });
  }
);
