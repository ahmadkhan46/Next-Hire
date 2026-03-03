import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockResumeParseAdd, mockRedisAddJob, mockGetQueueMode } = vi.hoisted(() => ({
  mockPrisma: {
    resumeUploadBatch: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  mockResumeParseAdd: vi.fn(),
  mockRedisAddJob: vi.fn(),
  mockGetQueueMode: vi.fn(),
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

vi.mock("@/lib/memory-queue", () => ({
  memoryQueues: {
    resumeParse: {
      add: mockResumeParseAdd,
    },
  },
}));

vi.mock("@/lib/queue-mode", () => ({
  getQueueMode: mockGetQueueMode,
}));

vi.mock("@/lib/queue", () => ({
  queues: {
    resumeParse: { name: "resume-parse" },
  },
  addJob: mockRedisAddJob,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/workers/memory-worker", () => ({}));

import { POST } from "@/app/api/orgs/[orgId]/candidates/uploads/[batchId]/retry/route";

describe("Uploads retry route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.resumeUploadBatch.findFirst.mockResolvedValue({
      id: "batch_1",
      items: [{ fileName: "cv1.pdf", resumeId: "resume_1" }],
    });
    mockPrisma.resumeUploadBatch.update.mockResolvedValue({});
    mockResumeParseAdd.mockResolvedValue({ id: "retry_job_1" });
    mockRedisAddJob.mockResolvedValue({ id: "retry_job_redis_1" });
    mockGetQueueMode.mockReturnValue("memory");
  });

  it("queues retry in memory mode with correlation id", async () => {
    const correlationId = "corr-retry-123";
    const req = new Request("http://localhost/api/orgs/org_test/candidates/uploads/batch_1/retry", {
      method: "POST",
      headers: { "x-correlation-id": correlationId },
    });

    const res = await POST(req as any, {
      params: Promise.resolve({ orgId: "org_test", batchId: "batch_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("x-correlation-id")).toBe(correlationId);
    expect(data.correlationId).toBe(correlationId);
    expect(data.queueMode).toBe("memory");
    expect(mockResumeParseAdd).toHaveBeenCalledWith(
      "retry-failed",
      expect.objectContaining({
        orgId: "org_test",
        batchId: "batch_1",
        userId: "user_test",
        correlationId,
      })
    );
    expect(mockRedisAddJob).not.toHaveBeenCalled();
  });

  it("queues retry in redis mode", async () => {
    mockGetQueueMode.mockReturnValue("redis");
    const req = new Request("http://localhost/api/orgs/org_test/candidates/uploads/batch_1/retry", {
      method: "POST",
    });

    const res = await POST(req as any, {
      params: Promise.resolve({ orgId: "org_test", batchId: "batch_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.jobId).toBe("retry_job_redis_1");
    expect(data.queueMode).toBe("redis");
    expect(mockRedisAddJob).toHaveBeenCalledWith(
      expect.anything(),
      "retry-failed",
      expect.objectContaining({
        orgId: "org_test",
        batchId: "batch_1",
        userId: "user_test",
      })
    );
    expect(mockResumeParseAdd).not.toHaveBeenCalled();
  });
});
