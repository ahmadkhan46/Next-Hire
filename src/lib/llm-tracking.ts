import { prisma } from './prisma';
import { logLLMUsage } from './logger';
import { sanitizeForLog } from './security';

export interface LLMUsageRecord {
  orgId: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  success: boolean;
  duration: number;
  metadata?: Record<string, any>;
}

// Track LLM usage in database
export async function trackLLMUsage(record: LLMUsageRecord) {
  // Log to Winston
  logLLMUsage(record);

  // Store in database for analytics
  try {
    await prisma.$executeRaw`
      INSERT INTO llm_usage_logs (
        org_id, model, operation, input_tokens, output_tokens, 
        total_tokens, cost, success, duration, metadata, created_at
      ) VALUES (
        ${record.orgId}, ${record.model}, ${record.operation}, 
        ${record.inputTokens}, ${record.outputTokens}, ${record.totalTokens},
        ${record.cost}, ${record.success}, ${record.duration}, 
        ${JSON.stringify(record.metadata || {})}::jsonb, NOW()
      )
      ON CONFLICT DO NOTHING
    `;
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to track LLM usage:', sanitizeForLog(String(error)));
  }
}

// Get LLM usage stats for an org
export async function getOrgLLMStats(orgId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const stats = await prisma.$queryRaw<Array<{
      total_cost: number;
      total_tokens: number;
      total_requests: number;
      success_rate: number;
      avg_duration: number;
    }>>`
      SELECT 
        COALESCE(SUM(cost), 0)::float as total_cost,
        COALESCE(SUM(total_tokens), 0)::bigint as total_tokens,
        COUNT(*)::int as total_requests,
        COALESCE(AVG(CASE WHEN success THEN 1 ELSE 0 END), 0)::float as success_rate,
        COALESCE(AVG(duration), 0)::float as avg_duration
      FROM llm_usage_logs
      WHERE org_id = ${orgId}
        AND created_at >= ${startDate}
    `;

    return stats[0] || {
      total_cost: 0,
      total_tokens: 0,
      total_requests: 0,
      success_rate: 0,
      avg_duration: 0,
    };
  } catch (error) {
    console.error('Failed to get LLM stats:', sanitizeForLog(String(error)));
    return {
      total_cost: 0,
      total_tokens: 0,
      total_requests: 0,
      success_rate: 0,
      avg_duration: 0,
    };
  }
}

// Get LLM usage by model
export async function getOrgLLMStatsByModel(orgId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const stats = await prisma.$queryRaw<Array<{
      model: string;
      total_cost: number;
      total_requests: number;
    }>>`
      SELECT 
        model,
        COALESCE(SUM(cost), 0)::float as total_cost,
        COUNT(*)::int as total_requests
      FROM llm_usage_logs
      WHERE org_id = ${orgId}
        AND created_at >= ${startDate}
      GROUP BY model
      ORDER BY total_cost DESC
    `;

    return stats;
  } catch (error) {
    console.error('Failed to get LLM stats by model:', sanitizeForLog(String(error)));
    return [];
  }
}
