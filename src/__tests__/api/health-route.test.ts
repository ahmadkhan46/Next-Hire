import { describe, expect, it, vi } from "vitest";

describe("Health route", () => {
  it("returns ok payload with queue mode", async () => {
    vi.resetModules();
    process.env.QUEUE_MODE = "memory";

    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.queueMode).toBe("memory");
    expect(typeof data.timestamp).toBe("string");
  });
});
