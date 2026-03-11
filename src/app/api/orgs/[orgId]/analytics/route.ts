import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrgAnalytics } from '@/lib/analytics';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { orgId } = await params;
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const analytics = await getOrgAnalytics(orgId, jobId);
    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Analytics failed' }, { status: 500 });
  }
}
