export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createRoute } from "@/lib/api-middleware";
import { searchLocations } from "@/lib/location-search";

export const GET = createRoute(
  {
    requireAuth: true,
    rateLimit: { type: "api" },
  },
  async (req) => {
    const q = req.nextUrl.searchParams.get("query")?.trim() ?? "";
    const limit = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get("limit") ?? 8)));
    const suggestions = q ? searchLocations(q, limit) : [];
    return NextResponse.json({ ok: true, suggestions });
  }
);
