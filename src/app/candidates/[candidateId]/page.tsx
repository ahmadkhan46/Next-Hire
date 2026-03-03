import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function CandidateRedirectPage({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}) {
  const { candidateId } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, orgId: true },
  });

  if (!candidate) notFound();

  redirect(`/orgs/${candidate.orgId}/candidates/${candidate.id}`);
}
