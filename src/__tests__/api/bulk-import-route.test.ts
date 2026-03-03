import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockBulkImportAdd, mockRedisAddJob, mockGetQueueMode } = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      findFirst: vi.fn(),
    },
    resumeUploadBatch: {
      create: vi.fn(),
    },
  },
  mockBulkImportAdd: vi.fn(),
  mockRedisAddJob: vi.fn(),
  mockGetQueueMode: vi.fn(),
}));

vi.mock("@/lib/api-middleware", () => ({
  createRoute:
    (_config: unknown, handler: (req: Request, context: any) => Promise<Response>) =>
    async (req: Request, { params }: { params: Promise<Record<string, string>> }) => {
      const body = await req.json();
      return handler(req, {
        params: await params,
        orgId: "org_test",
        userId: "user_test",
        body,
      });
    },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/memory-queue", () => ({
  memoryQueues: {
    bulkImport: {
      add: mockBulkImportAdd,
    },
  },
}));

vi.mock("@/lib/queue-mode", () => ({
  getQueueMode: mockGetQueueMode,
}));

vi.mock("@/lib/queue", () => ({
  queues: {
    bulkImport: { name: "bulk-import" },
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

import { POST } from "@/app/api/orgs/[orgId]/candidates/import/route";

describe("Bulk import route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.job.findFirst.mockResolvedValue({ id: "job_1" });
    mockPrisma.resumeUploadBatch.create.mockResolvedValue({ id: "batch_1" });
    mockBulkImportAdd.mockResolvedValue({ id: "queue_job_1" });
    mockRedisAddJob.mockResolvedValue({ id: "redis_job_1" });
    mockGetQueueMode.mockReturnValue("memory");
  });

  it("returns 400 for duplicate email rows in the same payload", async () => {
    const req = new Request("http://localhost/api/orgs/org_test/candidates/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        candidates: [
          { fullName: "A One", email: "dup@example.com" },
          { fullName: "B Two", email: "dup@example.com" },
        ],
      }),
    });

    const res = await POST(req as any, { params: Promise.resolve({ orgId: "org_test" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Duplicate email");
    expect(mockBulkImportAdd).not.toHaveBeenCalled();
  });

  it("queues import in memory mode and propagates correlation id", async () => {
    const correlationId = "corr-import-123";
    const req = new Request("http://localhost/api/orgs/org_test/candidates/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify({
        targetJobId: "job_1",
        candidates: [{ fullName: "John Doe", email: "john@example.com" }],
      }),
    });

    const res = await POST(req as any, { params: Promise.resolve({ orgId: "org_test" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.jobId).toBe("queue_job_1");
    expect(data.batchId).toBe("batch_1");
    expect(data.correlationId).toBe(correlationId);
    expect(data.queueMode).toBe("memory");
    expect(res.headers.get("x-correlation-id")).toBe(correlationId);
    expect(mockBulkImportAdd).toHaveBeenCalledWith(
      "bulk-import",
      expect.objectContaining({
        orgId: "org_test",
        userId: "user_test",
        batchId: "batch_1",
        targetJobId: "job_1",
        correlationId,
      })
    );
    expect(mockRedisAddJob).not.toHaveBeenCalled();
  });

  it("queues import in redis mode", async () => {
    mockGetQueueMode.mockReturnValue("redis");
    const req = new Request("http://localhost/api/orgs/org_test/candidates/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        candidates: [{ fullName: "John Doe", email: "john@example.com" }],
      }),
    });

    const res = await POST(req as any, { params: Promise.resolve({ orgId: "org_test" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.jobId).toBe("redis_job_1");
    expect(data.queueMode).toBe("redis");
    expect(mockRedisAddJob).toHaveBeenCalledWith(
      expect.anything(),
      "bulk-import",
      expect.objectContaining({
        orgId: "org_test",
        userId: "user_test",
        batchId: "batch_1",
      })
    );
    expect(mockBulkImportAdd).not.toHaveBeenCalled();
  });
});
