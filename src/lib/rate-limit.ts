import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RateLimitError } from './errors';

// Fallback in-memory store for development
class MemoryStore {
  private store = new Map<string, { count: number; reset: number }>();

  async get(key: string) {
    const item = this.store.get(key);
    if (!item || item.reset < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.count;
  }

  async set(key: string, count: number, ttl: number) {
    this.store.set(key, { count, reset: Date.now() + ttl * 1000 });
  }

  async incr(key: string) {
    const item = this.store.get(key);
    if (!item) return 1;
    item.count++;
    return item.count;
  }
}

const memoryStore = new MemoryStore();

// Initialize Redis (use Upstash in production, memory in dev)
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Rate limit tiers
export const rateLimiters = {
  // API routes - per IP
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
        analytics: true,
      })
    : null,

  // LLM operations - per org
  llm: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, '1 h'), // 50 LLM calls per hour
        analytics: true,
      })
    : null,

  // Bulk imports - per org
  bulkImport: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 bulk imports per hour
        analytics: true,
      })
    : null,

  // Auth endpoints - per IP
  auth: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '15 m'), // 10 attempts per 15 min
        analytics: true,
      })
    : null,
};

// In-memory fallback for development
async function checkMemoryRateLimit(
  key: string,
  limit: number,
  window: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const count = (await memoryStore.get(key)) || 0;
  
  if (count >= limit) {
    return {
      success: false,
      remaining: 0,
      reset: Date.now() + window * 1000,
    };
  }

  await memoryStore.incr(key);
  await memoryStore.set(key, count + 1, window);

  return {
    success: true,
    remaining: limit - count - 1,
    reset: Date.now() + window * 1000,
  };
}

export async function checkRateLimit(
  type: keyof typeof rateLimiters,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = rateLimiters[type];

  // Use memory fallback in development
  if (!limiter) {
    const limits = {
      api: { limit: 100, window: 60 },
      llm: { limit: 50, window: 3600 },
      bulkImport: { limit: 5, window: 3600 },
      auth: { limit: 10, window: 900 },
    };

    const config = limits[type];
    const result = await checkMemoryRateLimit(
      `${type}:${identifier}`,
      config.limit,
      config.window
    );

    return {
      success: result.success,
      limit: config.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  // Use Upstash in production
  const result = await limiter.limit(identifier);

  if (!result.success) {
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${Math.ceil((result.reset - Date.now()) / 1000)}s`
    );
  }

  return result;
}

// Middleware helper
export async function enforceRateLimit(
  type: keyof typeof rateLimiters,
  identifier: string
) {
  const result = await checkRateLimit(type, identifier);
  
  if (!result.success) {
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${Math.ceil((result.reset - Date.now()) / 1000)}s`
    );
  }

  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}
