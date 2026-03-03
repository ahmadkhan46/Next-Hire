import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createProtectedRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { logCandidateActivity } from "@/lib/candidate-activity";

const communicationSchema = z.object({
  template: z.enum(["INTERVIEW_INVITE", "FOLLOW_UP", "REJECTION", "CUSTOM"]).default("CUSTOM"),
  channel: z.enum(["EMAIL"]).default("EMAIL"),
  subject: z.string().min(1).max(250),
  body: z.string().min(1).max(10000),
  recipientEmail: z.string().email().optional().nullable(),
});

export const POST = createProtectedRoute(
  "candidates:write",
  async (req, { params, body, userId }) => {
    const { orgId, candidateId } = await params;
    const payload = body ?? (await req.json());
    const data = communicationSchema.parse(payload);
    const authResult = await auth();
    const claims = authResult.sessionClaims as Record<string, unknown> | null | undefined;
    let senderEmail =
      (claims?.email as string | undefined) ||
      (claims?.primary_email as string | undefined) ||
      (claims?.primaryEmail as string | undefined) ||
      null;

    if (!senderEmail && authResult.userId) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(authResult.userId);
        senderEmail =
          clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
          clerkUser.emailAddresses?.[0]?.emailAddress ??
          null;
      } catch {
        senderEmail = null;
      }
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, orgId },
      select: { id: true, fullName: true, email: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const toEmail = data.recipientEmail ?? candidate.email;
    if (!toEmail) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }

    await logCandidateActivity({
      orgId,
      candidateId,
      type: "COMMUNICATION_SENT",
      title: `Email prepared: ${data.template.replaceAll("_", " ").toLowerCase()}`,
      description: `${senderEmail ? `From ${senderEmail} - ` : ""}To ${toEmail} - ${data.subject}`,
      actorId: userId,
      metadata: {
        template: data.template,
        channel: data.channel,
        senderEmail,
        recipientEmail: toEmail,
        subject: data.subject,
      },
    });

    return NextResponse.json({
      ok: true,
      communication: {
        candidateName: candidate.fullName,
        recipientEmail: toEmail,
        subject: data.subject,
        body: data.body,
        channel: data.channel,
        template: data.template,
        senderEmail,
      },
    });
  }
);
