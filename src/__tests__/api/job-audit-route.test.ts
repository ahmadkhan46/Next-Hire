import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAuth,
  mockVerifyResourceAccess,
  mockEnforcePermission,
  mockFetchJobAuditEvents,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockVerifyResourceAccess: vi.fn(),
  mockEnforcePermission: vi.fn(),
  mockFetchJobAuditEvents: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/api-middleware", () => ({
  verifyResourceAccess: mockVerifyResourceAccess,
}));

vi.mock("@/lib/rbac", () => ({
  enforcePermission: mockEnforcePermission,
}));

vi.mock("@/lib/job-audit", () => ({
  fetchJobAuditEvents: mockFetchJobAuditEvents,
}));

import { GET } from "@/app/api/jobs/[jobId]/audit/route";

describe("Job audit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_test" });
    mockVerifyResourceAccess.mockResolvedValue("org_test");
    mockEnforcePermission.mockResolvedValue(undefined);
    mockFetchJobAuditEvents.mockResolvedValue({
      events: [{ id: "evt_1", action: "JOB_SKILLS_UPDATED" }],
      nextCursor: "cursor_2",
      hasMore: true,
    });
  });

  it("returns paginated audit events for authorized user", async () => {
    const req = new Request(
      "http://localhost/api/jobs/job_1/audit?take=10&action=JOB_SKILLS_UPDATED"
    );
    const res = await GET(req as any, { params: Promise.resolve({ jobId: "job_1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.jobId).toBe("job_1");
    expect(data.events).toHaveLength(1);
    expect(mockFetchJobAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_test",
        jobId: "job_1",
        take: 10,
        action: "JOB_SKILLS_UPDATED",
      })
    );
  });

  it("returns 401 when user is unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    const req = new Request("http://localhost/api/jobs/job_1/audit");
    const res = await GET(req as any, { params: Promise.resolve({ jobId: "job_1" }) });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});
