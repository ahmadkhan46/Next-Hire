import { CandidateActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface LogCandidateActivityInput {
  orgId: string;
  candidateId: string;
  type: CandidateActivityType;
  title: string;
  description?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logCandidateActivity(input: LogCandidateActivityInput) {
  try {
    await prisma.candidateActivity.create({
      data: {
        orgId: input.orgId,
        candidateId: input.candidateId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        actorId: input.actorId ?? null,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logger.error("Failed to log candidate activity", { error });
  }
}
