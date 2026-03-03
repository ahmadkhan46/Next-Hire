import { NextResponse } from 'next/server';
import { createRoute } from '@/lib/api-middleware';
import { autoMatchCandidateToJobs, autoMatchJobToCandidates, recalculateAllMatches } from '@/lib/auto-matching';
import { z } from 'zod';

const bodySchema = z.object({
  candidateId: z.string().cuid().optional(),
  jobId: z.string().cuid().optional(),
  recalculateAll: z.boolean().optional(),
});

export const POST = createRoute<{ orgId: string }>(
  {
    requireAuth: true,
    requireOrg: true,
    permission: 'matches:write',
    rateLimit: { type: 'api' },
    validation: { body: bodySchema },
  },
  async (req, { orgId, body }) => {
    const { candidateId, jobId, recalculateAll } = body ?? {};
    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }

    try {
      if (recalculateAll) {
        // Recalculate all matches for organization
        await recalculateAllMatches(orgId);
        return NextResponse.json({
          success: true,
          message: 'All matches recalculated',
        });
      }

      if (candidateId) {
        // Match candidate to all jobs
        await autoMatchCandidateToJobs(candidateId, orgId);
        return NextResponse.json({
          success: true,
          message: 'Candidate matched to all jobs',
        });
      }

      if (jobId) {
        // Match job to all candidates
        await autoMatchJobToCandidates(jobId, orgId);
        return NextResponse.json({
          success: true,
          message: 'Job matched to all candidates',
        });
      }

      return NextResponse.json(
        { error: 'Provide candidateId, jobId, or recalculateAll' },
        { status: 400 }
      );
    } catch (error: any) {
      console.error('Auto-match failed:', error);
      return NextResponse.json(
        { error: error.message || 'Auto-match failed' },
        { status: 500 }
      );
    }
  }
);
