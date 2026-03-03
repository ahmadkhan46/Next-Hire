import { NextResponse } from 'next/server';
import { getOrgLLMStats, getOrgLLMStatsByModel } from '@/lib/llm-tracking';
import { createProtectedRoute } from '@/lib/api-middleware';

export const GET = createProtectedRoute<{ orgId: string }>(
  'analytics:read',
  async (req, { orgId, query }) => {
    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }
    const { days } = query || { days: 30 };

    try {
      const [stats, byModel] = await Promise.all([
        getOrgLLMStats(orgId, days),
        getOrgLLMStatsByModel(orgId, days),
      ]);

      return NextResponse.json({
        period: `${days} days`,
        stats,
        byModel,
      });
    } catch (error) {
      console.error('Failed to get LLM analytics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }
  }
);
