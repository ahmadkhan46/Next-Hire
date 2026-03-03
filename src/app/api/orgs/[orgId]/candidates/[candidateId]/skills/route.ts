import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createProtectedRoute } from '@/lib/api-middleware';
import { logCandidateActivity } from '@/lib/candidate-activity';
import { z } from 'zod';

const skillCreateSchema = z.object({
  name: z.string().min(1).max(100),
});

const skillDeleteSchema = z.object({
  name: z.string().min(1).max(100),
});

export const POST = createProtectedRoute(
  'candidates:write',
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const { name } = skillCreateSchema.parse(payload);

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const trimmed = name.trim();
    const skill = await prisma.skill.upsert({
      where: { orgId_name: { orgId, name: trimmed } },
      create: { orgId, name: trimmed },
      update: {},
    });

    await prisma.candidateSkill.upsert({
      where: { candidateId_skillId: { candidateId, skillId: skill.id } },
      create: { candidateId, skillId: skill.id },
      update: {},
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'SKILL_ADDED',
      title: 'Skill added',
      description: `${trimmed} was added to candidate skills.`,
      actorId: userId,
    });

    return NextResponse.json({ success: true });
  }
);

export const GET = createProtectedRoute(
  'candidates:read',
  async (req, { params }) => {
    const { orgId, candidateId } = await params;

    const skills = await prisma.candidateSkill.findMany({
      where: { candidateId, candidate: { orgId } },
      select: { skill: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ skills: skills.map((s) => s.skill.name) });
  }
);

export const DELETE = createProtectedRoute(
  'candidates:write',
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const { name } = skillDeleteSchema.parse(payload);

    const skill = await prisma.skill.findFirst({
      where: { orgId, name: name.trim() },
      select: { id: true },
    });

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    await prisma.candidateSkill.deleteMany({
      where: { candidateId, skillId: skill.id },
    });

    await logCandidateActivity({
      orgId,
      candidateId,
      type: 'SKILL_REMOVED',
      title: 'Skill removed',
      description: `${name.trim()} was removed from candidate skills.`,
      actorId: userId,
    });

    return NextResponse.json({ ok: true });
  }
);
