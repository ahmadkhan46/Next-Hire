import { NextResponse } from "next/server";
import { getQueueMode, getQueueModeWarnings } from "@/lib/queue-mode";

export async function GET() {
  const startedAt = Date.now() - Math.round(process.uptime() * 1000);
  const response = NextResponse.json({
    ok: true,
    service: "ai-career-platform",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(startedAt).toISOString(),
    environment: process.env.NODE_ENV ?? "development",
    queueMode: getQueueMode(),
    warnings: getQueueModeWarnings(),
  });

  response.headers.set("cache-control", "no-store");
  return response;
}
