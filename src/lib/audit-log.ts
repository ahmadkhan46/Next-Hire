import { prisma } from './prisma';
import { logger } from './logger';

export type AuditAction =
  | 'candidate.create'
  | 'candidate.update'
  | 'candidate.delete'
  | 'candidate.view'
  | 'job.create'
  | 'job.update'
  | 'job.delete'
  | 'match.create'
  | 'match.status_change'
  | 'user.login'
  | 'user.logout'
  | 'settings.update'
  | 'export.data'
  | 'import.bulk';

export type ResourceType = 'candidate' | 'job' | 'match' | 'user' | 'settings' | 'export';

export interface AuditLogEntry {
  orgId: string;
  userId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// Create audit log
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "AuditLog" (
        org_id, user_id, action, resource_type, resource_id,
        changes, metadata, ip_address, user_agent, created_at
      ) VALUES (
        ${entry.orgId},
        ${entry.userId || null},
        ${entry.action},
        ${entry.resourceType},
        ${entry.resourceId || null},
        ${JSON.stringify(entry.changes || {})}::jsonb,
        ${JSON.stringify(entry.metadata || {})}::jsonb,
        ${entry.ipAddress || null},
        ${entry.userAgent || null},
        NOW()
      )
    `;

    logger.info('Audit log created', {
      orgId: entry.orgId,
      action: entry.action,
      resourceType: entry.resourceType,
    });
  } catch (error) {
    logger.error('Failed to create audit log', { error, entry });
  }
}

// Get audit logs for organization
export async function getAuditLogs(
  orgId: string,
  options?: {
    userId?: string;
    resourceType?: ResourceType;
    resourceId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const logs = await prisma.$queryRaw<Array<{
    id: string;
    org_id: string;
    user_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    changes: any;
    metadata: any;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }>>`
    SELECT *
    FROM "AuditLog"
    WHERE org_id = ${orgId}
      ${options?.userId ? prisma.$queryRawUnsafe(`AND user_id = '${options.userId}'`) : prisma.$queryRawUnsafe('')}
      ${options?.resourceType ? prisma.$queryRawUnsafe(`AND resource_type = '${options.resourceType}'`) : prisma.$queryRawUnsafe('')}
      ${options?.resourceId ? prisma.$queryRawUnsafe(`AND resource_id = '${options.resourceId}'`) : prisma.$queryRawUnsafe('')}
      ${options?.action ? prisma.$queryRawUnsafe(`AND action = '${options.action}'`) : prisma.$queryRawUnsafe('')}
      ${options?.startDate ? prisma.$queryRawUnsafe(`AND created_at >= '${options.startDate.toISOString()}'`) : prisma.$queryRawUnsafe('')}
      ${options?.endDate ? prisma.$queryRawUnsafe(`AND created_at <= '${options.endDate.toISOString()}'`) : prisma.$queryRawUnsafe('')}
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return logs;
}

// Get audit log statistics
export async function getAuditStats(orgId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await prisma.$queryRaw<Array<{
    action: string;
    count: number;
  }>>`
    SELECT 
      action,
      COUNT(*)::int as count
    FROM "AuditLog"
    WHERE org_id = ${orgId}
      AND created_at >= ${startDate}
    GROUP BY action
    ORDER BY count DESC
  `;

  return stats;
}

// Helper to track changes
export function trackChanges(before: any, after: any): Record<string, any> {
  const changes: Record<string, any> = {};

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of allKeys) {
    if (before[key] !== after[key]) {
      changes[key] = {
        from: before[key],
        to: after[key],
      };
    }
  }

  return changes;
}
