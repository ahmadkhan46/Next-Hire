import { prisma } from './prisma';
import { OrgRole } from '@prisma/client';
import { AuthenticationError } from './errors';
import { clerkClient } from '@clerk/nextjs/server';

export type Permission =
  | 'candidates:read'
  | 'candidates:write'
  | 'candidates:delete'
  | 'jobs:read'
  | 'jobs:write'
  | 'jobs:delete'
  | 'matches:read'
  | 'matches:write'
  | 'analytics:read'
  | 'settings:read'
  | 'settings:write'
  | 'members:read'
  | 'members:write';

const rolePermissions: Record<OrgRole, Permission[]> = {
  OWNER: [
    'candidates:read',
    'candidates:write',
    'candidates:delete',
    'jobs:read',
    'jobs:write',
    'jobs:delete',
    'matches:read',
    'matches:write',
    'analytics:read',
    'settings:read',
    'settings:write',
    'members:read',
    'members:write',
  ],
  ADMIN: [
    'candidates:read',
    'candidates:write',
    'candidates:delete',
    'jobs:read',
    'jobs:write',
    'jobs:delete',
    'matches:read',
    'matches:write',
    'analytics:read',
    'settings:read',
    'members:read',
  ],
  MEMBER: [
    'candidates:read',
    'candidates:write',
    'jobs:read',
    'matches:read',
    'matches:write',
    'analytics:read',
  ],
};

async function resolveInternalUserIdFromEmail(email?: string | null) {
  if (!email) return null;
  const dbUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  return dbUser?.id ?? null;
}

async function resolveInternalUserId(
  clerkUserId: string,
  fallbackEmail?: string | null
): Promise<string | null> {
  const direct = await prisma.user.findUnique({
    where: { id: clerkUserId },
    select: { id: true },
  });
  if (direct) return direct.id;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    const primary =
      user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress;

    if (!primary) {
      return await resolveInternalUserIdFromEmail(fallbackEmail);
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: primary.toLowerCase() },
      select: { id: true },
    });

    return dbUser?.id ?? (await resolveInternalUserIdFromEmail(fallbackEmail));
  } catch {
    return await resolveInternalUserIdFromEmail(fallbackEmail);
  }
}

export async function getUserRole(
  userId: string,
  orgId: string,
  email?: string | null
): Promise<OrgRole | null> {
  const internalUserId = await resolveInternalUserId(userId, email);
  if (!internalUserId) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: internalUserId, orgId } },
    select: { role: true },
  });

  return membership?.role || null;
}

export async function checkPermission(
  userId: string,
  orgId: string,
  permission: Permission,
  email?: string | null
): Promise<boolean> {
  const role = await getUserRole(userId, orgId, email);
  if (!role) return false;

  const permissions = rolePermissions[role];
  return permissions.includes(permission);
}

export async function enforcePermission(
  userId: string,
  orgId: string,
  permission: Permission,
  email?: string | null
): Promise<void> {
  const hasPermission = await checkPermission(userId, orgId, permission, email);
  
  if (!hasPermission) {
    throw new AuthenticationError(
      `Permission denied: ${permission} required`
    );
  }
}

export async function enforceOrgAccess(
  userId: string,
  orgId: string,
  email?: string | null
): Promise<OrgRole> {
  const role = await getUserRole(userId, orgId, email);
  
  if (!role) {
    throw new AuthenticationError('Access denied: Not a member of this organization');
  }

  return role;
}

// Helper to check multiple permissions (any)
export async function hasAnyPermission(
  userId: string,
  orgId: string,
  permissions: Permission[]
): Promise<boolean> {
  const role = await getUserRole(userId, orgId);
  if (!role) return false;

  const userPermissions = rolePermissions[role];
  return permissions.some(p => userPermissions.includes(p));
}

// Helper to check multiple permissions (all)
export async function hasAllPermissions(
  userId: string,
  orgId: string,
  permissions: Permission[]
): Promise<boolean> {
  const role = await getUserRole(userId, orgId);
  if (!role) return false;

  const userPermissions = rolePermissions[role];
  return permissions.every(p => userPermissions.includes(p));
}

