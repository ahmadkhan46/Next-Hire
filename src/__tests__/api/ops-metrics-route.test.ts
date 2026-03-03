import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetOrgLLMStats, mockGetOrgLLMStatsByModel } = vi.hoisted(() => ({
  mockPrisma: {
    resumeUploadBatch: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
  mockGetOrgLLMStats: vi.fn(),
  mockGetOrgLLMStatsByModel: vi.fn(),
}));

vi.mock("@/lib/api-middleware", () => ({
  createRoute:
    (_config: unknown, handler: (req: Request, context: any) => Promise<Response>) =>
    async (req: Request, { params }: { params: Promise<Record<string, string>> }) => {
      const url = new URL(req.url);
      return handler(req, {
        params: await params,
        orgId: "org_test",
        userId: "user_test",
        query: {
          days: Number(url.searchParams.get("days") ?? "7"),
        },
      });
    },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/llm-tracking", () => ({
  getOrgLLMStats: mockGetOrgLLMStats,
  getOrgLLMStatsByModel: mockGetOrgLLMStatsByModel,
}));

vi.mock("@/lib/queue-mode", () => ({
  getQueueMode: () => "memory",
}));

vi.mock("@/lib/memory-queue", () => ({
  memoryQueues: {
    bulkImport: {
      getWaitingCount: vi.fn().mockResolvedValue(1),
      getActiveCount: vi.fn().mockResolvedValue(2),
      getCompletedCount: vi.fn().mockResolvedValue(30),
      getFailedCount: vi.fn().mockResolvedValue(4),
    },
    resumeParse: {
      getWaitingCount: vi.fn().mockResolvedValue(0),
      getActiveCount: vi.fn().mockResolvedValue(1),
      getCompletedCount: vi.fn().mockResolvedValue(50),
      getFailedCount: vi.fn().mockResolvedValue(3),
    },
  },
}));

import { GET } from "@/app/api/orgs/[orgId]/ops/metrics/route";

describe("Ops metrics route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.resumeUploadBatch.aggregate.mockResolvedValue({
      _count: { _all: 8 },
      _sum: {
        totalFiles: 100,
        createdCount: 70,
        updatedCount: 20,
        failedCount: 10,
      },
    });

    mockPrisma.resumeUploadBatch.groupBy
      .mockResolvedValueOnce([
        {
          sourceType: "CSV",
          _count: { _all: 5 },
          _sum: { totalFiles: 80, failedCount: 8 },
        },
      ])
      .mockResolvedValueOnce([
        {
          status: "COMPLETED",
          _count: { _all: 6 },
        },
        {
          status: "PARTIAL_FAILED",
          _count: { _all: 2 },
        },
      ]);

    mockPrisma.$queryRaw.mockResolvedValue([
      { reason: "Invalid or missing email address", count: BigInt(6) },
      { reason: "Only PDF or DOCX supported", count: BigInt(3) },
    ]);

    mockGetOrgLLMStats.mockResolvedValue({
      total_cost: 12.34,
      total_tokens: 12345,
      total_requests: 120,
      success_rate: 0.98,
      avg_duration: 1020,
    });
    mockGetOrgLLMStatsByModel.mockResolvedValue([
      { model: "gpt-4o-mini", total_cost: 8.1, total_requests: 100 },
    ]);
  });

  it("returns upload, queue, and llm metrics", async () => {
    const req = new Request("http://localhost/api/orgs/org_test/ops/metrics?days=14");
    const res = await GET(req as any, { params: Promise.resolve({ orgId: "org_test" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.periodDays).toBe(14);
    expect(data.uploads.files.total).toBe(100);
    expect(data.uploads.rates.successRate).toBe(90);
    expect(data.uploads.rates.failureRate).toBe(10);
    expect(data.uploads.topFailureReasons).toHaveLength(2);
    expect(data.queues.mode).toBe("memory");
    expect(data.queues.bulkImport.waiting).toBe(1);
    expect(data.llm.summary.total_requests).toBe(120);
  });
});
