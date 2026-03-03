import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { evaluateWorkflowRules } from '@/lib/workflow-engine';
import { handleAPIError } from '@/lib/errors';
import { verifyResourceAccess } from '@/lib/api-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;

    // SECURITY: Verify user has access to this job's org
    await verifyResourceAccess(userId, undefined, jobId);

    const { dryRun = false } = await request.json().catch(() => ({}));
    
    // Get job details
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { 
        id: true, 
        orgId: true, 
        title: true,
        skills: {
          select: {
            skill: { select: { name: true } },
            weight: true
          }
        }
      },
    });
    
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get all unreviewed matches
    const matches = await prisma.matchResult.findMany({
      where: { 
        jobId,
        status: 'NONE'
      },
      select: {
        candidateId: true,
        score: true,
        matched: true,
        missing: true,
        candidate: {
          select: { fullName: true, email: true }
        }
      },
    });

    const results = [];
    const criticalSkills = job.skills
      .filter(s => (s.weight || 0) >= 4)
      .map(s => s.skill.name);

    for (const match of matches) {
      const missingList = Array.isArray(match.missing) 
        ? match.missing.filter((s: any) => typeof s === 'string')
        : [];
      
      const candidateData = {
        ...match,
        missingCritical: missingList.filter(skill => criticalSkills.includes(skill))
      };

      const workflow = evaluateWorkflowRules(candidateData, job);
      
      if (workflow) {
        results.push({
          candidateId: match.candidateId,
          candidateName: match.candidate.fullName,
          currentStatus: 'NONE',
          suggestedStatus: workflow.suggestedStatus,
          reason: workflow.reason,
          appliedRule: workflow.appliedRule,
          score: Math.round((match.score || 0) * 100),
        });

        // Apply changes if not dry run
        if (!dryRun) {
          await prisma.$transaction(async (tx) => {
            await tx.matchResult.update({
              where: { jobId_candidateId: { jobId, candidateId: match.candidateId } },
              data: {
                status: workflow.suggestedStatus,
                statusUpdatedAt: new Date(),
              },
            });

            await tx.matchDecisionLog.create({
              data: {
                orgId: job.orgId,
                jobId,
                candidateId: match.candidateId,
                fromStatus: 'NONE',
                toStatus: workflow.suggestedStatus,
                note: `Automated: ${workflow.reason} (${workflow.appliedRule})`,
              },
            });
          });
        }
      }
    }

    return NextResponse.json({
      jobId,
      jobTitle: job.title,
      totalMatches: matches.length,
      rulesApplied: results.length,
      dryRun,
      results,
    });

  } catch (error) {
    const handled = handleAPIError(error);
    return NextResponse.json({ error: handled.error, code: handled.code }, { status: handled.statusCode });
  }
}
