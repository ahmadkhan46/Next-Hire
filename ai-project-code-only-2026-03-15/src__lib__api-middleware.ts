import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { enforceRateLimit } from './rate-limit';
import { enforcePermission, enforceOrgAccess, type Permission } from './rbac';
import { handleAPIError } from './errors';
import { logAPIRequest } from './logger';
import { sanitizeHtml } from './security';
import { prisma } from './prisma';

interface RouteConfig {
  rateLimit?: {
    type: 'api' | 'llm' | 'bulkImport' | 'auth';
    identifier?: (req: NextRequest, userId?: string, orgId?: string) => string;
  };
  permission?: Permission;
  validation?: {
    body?: z.ZodSchema;
    query?: z.ZodSchema;
  };
  requireAuth?: boolean;
  requireOrg?: boolean;
}

type RouteHandler<T = any> = (
  req: NextRequest,
  context: {
    params: T;
    userId?: string;
    orgId?: string;
    body?: any;
    query?: any;
  }
) => Promise<NextResponse>;

export function createRoute<T = any>(
  config: RouteConfig,
  handler: RouteHandler<T>
) {
  return async (req: NextRequest, { params }: { params: Promise<T> }) => {
    const startTime = Date.now();
    const resolvedParams = await params;
    let userId: string | undefined;
    let orgId: string | undefined;
    let statusCode = 200;
    const correlationId = req.headers.get("x-correlation-id")?.trim() || undefined;

    try {
      // 1. Authentication
      let userEmail: string | undefined;
      if (config.requireAuth !== false) {
        const authResult = await auth();
        userId = authResult.userId || undefined;
        const claims = authResult.sessionClaims as Record<string, unknown> | null | undefined;
        const possibleEmail =
          (claims?.email as string | undefined) ||
          (claims?.primary_email as string | undefined) ||
          (claims?.primaryEmail as string | undefined);
        userEmail = typeof possibleEmail === 'string' ? possibleEmail : undefined;
        if (!userEmail && userId) {
          try {
            const client = await clerkClient();
            const user = await client.users.getUser(userId);
            userEmail =
              user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
                ?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress;
          } catch {
            // ignore email lookup failures
          }
        }
        
        if (!userId) {
          statusCode = 401;
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }

      // 2. Extract orgId from params and check access
      if (
        config.requireOrg &&
        resolvedParams &&
        typeof resolvedParams === 'object' &&
        'orgId' in (resolvedParams as Record<string, unknown>)
      ) {
        orgId = (resolvedParams as Record<string, unknown>).orgId as string | undefined;
        
        if (userId && orgId) {
          await enforceOrgAccess(userId, orgId, userEmail);
        }
      }

      // 3. Rate limiting
      let rateLimitHeaders: Record<string, string> = {};
      if (config.rateLimit) {
        const requestIp =
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip') ||
          undefined;
        const identifier = config.rateLimit.identifier
          ? config.rateLimit.identifier(req, userId, orgId)
          : userId || requestIp || 'anonymous';

        rateLimitHeaders = await enforceRateLimit(
          config.rateLimit.type,
          identifier
        );
      }

      // 4. Permission check
      if (config.permission && userId && orgId) {
        await enforcePermission(userId, orgId, config.permission, userEmail);
      }

      // 5. Input validation
      let body: any;
      let query: any;

      if (config.validation?.body && req.method !== 'GET') {
        try {
          const rawBody = await req.json();
          body = config.validation.body.parse(rawBody);
        } catch (error) {
          if (error instanceof z.ZodError) {
            statusCode = 400;
            return NextResponse.json(
              {
                error: 'Validation failed',
                details: error.issues,
              },
              { status: 400 }
            );
          }
          throw error;
        }
      }

      if (config.validation?.query) {
        try {
          const searchParams = Object.fromEntries(req.nextUrl.searchParams);
          query = config.validation.query.parse(searchParams);
        } catch (error) {
          if (error instanceof z.ZodError) {
            statusCode = 400;
            return NextResponse.json(
              {
                error: 'Invalid query parameters',
                details: error.issues,
              },
              { status: 400 }
            );
          }
          throw error;
        }
      }

      // 6. Execute handler
      const response = await handler(req, {
        params: resolvedParams,
        userId,
        orgId,
        body,
        query,
      });

      statusCode = response.status;
      
      // Add rate limit headers to response
      if (Object.keys(rateLimitHeaders).length > 0) {
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
      
      return response;
    } catch (error) {
      const errorResponse = handleAPIError(error, {
        path: req.nextUrl.pathname,
        method: req.method,
        userId,
        orgId,
        correlationId,
      });

      statusCode = errorResponse.statusCode;

      const response = NextResponse.json(
        {
          error: sanitizeHtml(errorResponse.error),
          code: errorResponse.code,
          correlationId,
        },
        { status: errorResponse.statusCode }
      );

      if (correlationId) {
        response.headers.set("x-correlation-id", correlationId);
      }

      return response;
    } finally {
      // Log request
      logAPIRequest({
        method: req.method,
        path: req.nextUrl.pathname,
        userId,
        orgId,
        duration: Date.now() - startTime,
        status: statusCode,
      });
    }
  };
}

// Convenience wrappers
export const createProtectedRoute = <T = any>(
  permission: Permission,
  handler: RouteHandler<T>
) =>
  createRoute<T>(
    {
      requireAuth: true,
      requireOrg: true,
      permission,
      rateLimit: { type: 'api' },
    },
    handler
  );

export const createPublicRoute = <T = any>(handler: RouteHandler<T>) =>
  createRoute<T>(
    {
      requireAuth: false,
      rateLimit: {
        type: 'api',
        identifier: (req) =>
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip') ||
          'anonymous',
      },
    },
    handler
  );

/**
 * SECURITY: Helper to verify org access for unscoped routes
 * Validates that the authenticated user has access to the org that owns the resource
 * @param userId - Authenticated user ID
 * @param candidateId - Optional candidate ID to look up org
 * @param jobId - Optional job ID to look up org
 * @returns The orgId if access is granted, throws otherwise
 */
export async function verifyResourceAccess(
  userId: string,
  candidateId?: string,
  jobId?: string
): Promise<string> {
  let orgId: string | null = null;

  if (candidateId) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { orgId: true },
    });
    if (!candidate) {
      throw new Error('Candidate not found');
    }
    orgId = candidate.orgId;
  } else if (jobId) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { orgId: true },
    });
    if (!job) {
      throw new Error('Job not found');
    }
    orgId = job.orgId;
  } else {
    throw new Error('Either candidateId or jobId must be provided');
  }

  // Use the RBAC org access resolver so Clerk IDs and internal DB user IDs both work.
  await enforceOrgAccess(userId, orgId);

  return orgId;
}

/**
 * Extract orgId from URL path pattern /api/orgs/[orgId]/*
 * @param pathname - URL pathname (e.g., "/api/orgs/org-123/candidates")
 * @returns orgId or null if not found
 */
export function extractOrgIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/orgs\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * Check if a path requires org scoping for middleware validation
 * @param pathname - URL pathname
 * @returns true if path follows /api/orgs/[orgId]/* pattern
 */
export function isOrgScopedPath(pathname: string): boolean {
  return /^\/api\/orgs\/[^\/]+/.test(pathname);
}
