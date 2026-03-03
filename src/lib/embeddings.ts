import OpenAI from 'openai';
import { LLMError } from './errors';
import { trackLLMUsage } from './llm-tracking';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = 'text-embedding-3-small'; // Cheaper, faster
// const EMBEDDING_MODEL = 'text-embedding-3-large'; // Better quality

export async function generateEmbedding(
  text: string,
  orgId?: string
): Promise<{ embedding: number[]; tokens: number; cost: number }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new LLMError('OPENAI_API_KEY not configured', 'openai', EMBEDDING_MODEL);
  }

  const startTime = Date.now();

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // Max 8K tokens
    });

    const embedding = response.data[0].embedding;
    const tokens = response.usage.total_tokens;
    
    // Pricing: text-embedding-3-small = $0.02 per 1M tokens
    const cost = (tokens / 1_000_000) * 0.02;

    // Track usage
    if (orgId) {
      await trackLLMUsage({
        orgId,
        model: EMBEDDING_MODEL,
        operation: 'embedding',
        inputTokens: tokens,
        outputTokens: 0,
        totalTokens: tokens,
        cost,
        success: true,
        duration: Date.now() - startTime,
      });
    }

    return { embedding, tokens, cost };
  } catch (error: any) {
    throw new LLMError(
      error.message || 'Embedding generation failed',
      'openai',
      EMBEDDING_MODEL
    );
  }
}

// Generate embedding for resume
export async function generateResumeEmbedding(resumeText: string, orgId?: string) {
  // Combine key sections for better semantic search
  const searchableText = resumeText.slice(0, 8000);
  return generateEmbedding(searchableText, orgId);
}

// Generate embedding for job description
export async function generateJobEmbedding(
  title: string,
  description: string,
  skills: string[],
  orgId?: string
) {
  const searchableText = `${title}\n${description}\nRequired skills: ${skills.join(', ')}`;
  return generateEmbedding(searchableText, orgId);
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
