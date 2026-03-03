import { NextResponse } from 'next/server';
import { createProtectedRoute } from '@/lib/api-middleware';
import { searchCandidatesBySemantics, findSimilarCandidates } from '@/lib/semantic-search';

export const GET = createProtectedRoute<{ orgId: string }>(
  'candidates:read',
  async (req, { orgId, query }) => {
    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }
    const { query: searchQuery, candidateId, limit = 10, minSimilarity = 0.7 } = query || {};

    try {
      let results;

      if (candidateId) {
        // Find similar candidates
        results = await findSimilarCandidates(candidateId, orgId, limit);
      } else if (searchQuery) {
        // Semantic search by query
        results = await searchCandidatesBySemantics(searchQuery, orgId, limit, minSimilarity);
      } else {
        return NextResponse.json(
          { error: 'Either query or candidateId is required' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        results,
        count: results.length,
      });
    } catch (error: any) {
      console.error('Semantic search failed:', error);
      return NextResponse.json(
        { error: error.message || 'Search failed' },
        { status: 500 }
      );
    }
  }
);
