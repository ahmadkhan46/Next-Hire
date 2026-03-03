import { prisma } from './prisma';

type NotificationType = 'UPLOAD_COMPLETE' | 'UPLOAD_FAILED' | 'MATCH_FOUND' | 'RESUME_PARSED' | 'JOB_CREATED' | 'SYSTEM';

export async function createNotification({
  orgId,
  userId,
  type,
  title,
  message,
  link,
  metadata,
}: {
  orgId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: any;
}) {
  try {
    await prisma.notification.create({
      data: {
        orgId,
        userId,
        type,
        title,
        message,
        link,
        metadata,
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}
