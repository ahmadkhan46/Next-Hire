import { prisma } from './prisma';
import { generateEmbedding, cosineSimilarity } from './embeddings';

export interface SemanticSearchResult {
  id: string;
  similarity: number;
  data: any;
}

// Search candidates by semantic similarity
export async function searchCandidatesBySemantics(
  query: string,
  orgId: string,
  limit: number = 10,
  minSimilarity: number = 0.7
): Promise<SemanticSearchResult[]> {
  // Generate embedding for query
  const { embedding: queryEmbedding } = await generateEmbedding(query, orgId);

  // Get all candidates with embeddings
  const candidates = await prisma.$queryRaw<Array<{
    id: string;
    fullName: string;
    email: string;
    currentTitle: string;
    embedding: number[];
  }>>`
    SELECT 
      c.id,
      c."fullName",
      c.email,
      c."currentTitle",
      r.embedding::json as embedding
    FROM "Candidate" c
    INNER JOIN "Resume" r ON r."candidateId" = c.id
    WHERE c."orgId" = ${orgId}
      AND r.embedding IS NOT NULL
    LIMIT 100
  `;

  // Calculate similarities
  const results = candidates
    .map(candidate => ({
      id: candidate.id,
      similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
      data: {
        fullName: candidate.fullName,
        email: candidate.email,
        currentTitle: candidate.currentTitle,
      },
    }))
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

// Find similar candidates
export async function findSimilarCandidates(
  candidateId: string,
  orgId: string,
  limit: number = 5
): Promise<SemanticSearchResult[]> {
  // Get candidate's resume embedding
  const resume = await prisma.resume.findFirst({
    where: { candidateId },
    select: { embedding: true },
  });

  if (!resume?.embedding) {
    return [];
  }

  const targetEmbedding = resume.embedding as any as number[];

  // Get all other candidates with embeddings
  const candidates = await prisma.$queryRaw<Array<{
    id: string;
    fullName: string;
    email: string;
    currentTitle: string;
    embedding: number[];
  }>>`
    SELECT 
      c.id,
      c."fullName",
      c.email,
      c."currentTitle",
      r.embedding::json as embedding
    FROM "Candidate" c
    INNER JOIN "Resume" r ON r."candidateId" = c.id
    WHERE c."orgId" = ${orgId}
      AND c.id != ${candidateId}
      AND r.embedding IS NOT NULL
    LIMIT 50
  `;

  // Calculate similarities
  const results = candidates
    .map(candidate => ({
      id: candidate.id,
      similarity: cosineSimilarity(targetEmbedding, candidate.embedding),
      data: {
        fullName: candidate.fullName,
        email: candidate.email,
        currentTitle: candidate.currentTitle,
      },
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

// Search jobs by semantic similarity
export async function searchJobsBySemantics(
  query: string,
  orgId: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  const { embedding: queryEmbedding } = await generateEmbedding(query, orgId);

  const jobs = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    location: string;
    embedding: number[];
  }>>`
    SELECT 
      id,
      title,
      location,
      embedding::json as embedding
    FROM "Job"
    WHERE "orgId" = ${orgId}
      AND embedding IS NOT NULL
    LIMIT 50
  `;

  const results = jobs
    .map(job => ({
      id: job.id,
      similarity: cosineSimilarity(queryEmbedding, job.embedding),
      data: {
        title: job.title,
        location: job.location,
      },
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

// Semantic job matching
export async function semanticJobMatch(
  jobId: string,
  orgId: string,
  limit: number = 20
): Promise<SemanticSearchResult[]> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { embedding: true },
  });

  if (!job?.embedding) {
    return [];
  }

  const jobEmbedding = job.embedding as any as number[];

  const candidates = await prisma.$queryRaw<Array<{
    id: string;
    fullName: string;
    email: string;
    currentTitle: string;
    embedding: number[];
  }>>`
    SELECT 
      c.id,
      c."fullName",
      c.email,
      c."currentTitle",
      r.embedding::json as embedding
    FROM "Candidate" c
    INNER JOIN "Resume" r ON r."candidateId" = c.id
    WHERE c."orgId" = ${orgId}
      AND r.embedding IS NOT NULL
    LIMIT 100
  `;

  const results = candidates
    .map(candidate => ({
      id: candidate.id,
      similarity: cosineSimilarity(jobEmbedding, candidate.embedding),
      data: {
        fullName: candidate.fullName,
        email: candidate.email,
        currentTitle: candidate.currentTitle,
      },
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}
