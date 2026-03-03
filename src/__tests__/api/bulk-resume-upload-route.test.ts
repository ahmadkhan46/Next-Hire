import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      findFirst: vi.fn(),
    },
    resumeUploadBatch: {
      create: vi.fn(),
      update: vi.fn(),
    },
    resumeUploadItem: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-middleware", () => ({
  createRoute:
    (_config: unknown, handler: (req: Request, context: any) => Promise<Response>) =>
    async (req: Request, { params }: { params: Promise<Record<string, string>> }) =>
      handler(req, {
        params: await params,
        orgId: "org_test",
        userId: "user_test",
      }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/resume-text-extract", () => ({
  extractTextFromFile: vi.fn(),
}));

vi.mock("@/lib/resume-llm", () => ({
  extractCandidateProfile: vi.fn(),
}));

vi.mock("@/lib/resume-apply", () => ({
  buildCandidateUpdate: vi.fn(),
}));

vi.mock("@/lib/auto-matching", () => ({
  autoMatchCandidateToJob: vi.fn(),
  autoMatchCandidateToJobs: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST } from "@/app/api/orgs/[orgId]/candidates/resumes/upload/route";

describe("Bulk resume upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.job.findFirst.mockResolvedValue({ id: "job_1" });
    mockPrisma.resumeUploadBatch.create.mockResolvedValue({ id: "batch_1" });
    mockPrisma.resumeUploadItem.create.mockResolvedValue({ id: "item_1" });
    mockPrisma.resumeUploadItem.update.mockResolvedValue({});
    mockPrisma.resumeUploadItem.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.resumeUploadBatch.update.mockResolvedValue({});
  });

  it("returns 400 when no files are provided", async () => {
    const form = new FormData();
    const req = new Request("http://localhost/api/orgs/org_test/candidates/resumes/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req as any, { params: Promise.resolve({ orgId: "org_test" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("No files provided");
  });

  it("returns structured failure info for invalid file type and keeps correlation id", async () => {
    const form = new FormData();
    form.append("files", new File(["bad"], "bad.txt", { type: "text/plain" }));
    const correlationId = "corr-upload-123";
    const req = new Request("http://localhost/api/orgs/org_test/candidates/resumes/upload", {
      method: "POST",
      headers: { "x-correlation-id": correlationId },
      body: form,
    });

    const res = await POST(req as any, { params: Promise.resolve({ orgId: "org_test" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-correlation-id")).toBe(correlationId);
    expect(data.correlationId).toBe(correlationId);
    expect(data.results).toHaveLength(1);
    expect(data.results[0]).toEqual(
      expect.objectContaining({
        ok: false,
        status: "FAILED",
        errorCode: "INVALID_MIME",
        attempts: 1,
        retryCount: 0,
        transient: false,
      })
    );
    expect(data.failedFiles).toEqual([
      expect.objectContaining({
        fileName: "bad.txt",
        errorCode: "INVALID_MIME",
      }),
    ]);
  });
});
