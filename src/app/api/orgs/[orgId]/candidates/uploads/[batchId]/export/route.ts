import { NextResponse } from 'next/server';
import { createRoute } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const GET = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: 'candidates:read',
  },
  async (req, { orgId, params }) => {
    const { batchId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';

    const batch = await prisma.resumeUploadBatch.findFirst({
      where: { id: batchId, orgId: orgId! },
      include: {
        items: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const items = format === 'errors' 
      ? batch.items.filter(item => item.status === 'FAILED')
      : batch.items;

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items to export' }, { status: 404 });
    }

    // CSV Headers
    const headers = ['File Name', 'Status', 'Candidate ID', 'Note', 'Error', 'Created At'];

    // CSV Rows
    const rows = items.map((item) => [
      item.fileName,
      item.status,
      item.candidateId || '',
      item.note || '',
      item.error || '',
      item.createdAt.toISOString(),
    ]);

    // Build CSV
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="batch-${batchId}-${format}.csv"`,
      },
    });
  }
);
