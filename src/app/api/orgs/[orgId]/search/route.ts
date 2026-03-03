import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/api-middleware";

const pages = [
  { name: "Dashboard", path: "/orgs/[orgId]", keywords: ["home", "overview"] },
  { name: "Candidates", path: "/orgs/[orgId]/candidates", keywords: ["talent", "people"] },
  { name: "Jobs", path: "/orgs/[orgId]/jobs", keywords: ["roles", "positions"] },
  { name: "Matchboard", path: "/orgs/[orgId]/matchboard", keywords: ["matches", "ranking"] },
  { name: "Intelligence", path: "/orgs/[orgId]/intelligence", keywords: ["analytics", "insights"] },
  { name: "Uploads", path: "/orgs/[orgId]/uploads", keywords: ["import", "history"] },
  { name: "Settings", path: "/orgs/[orgId]/settings", keywords: ["config", "preferences"] },
];

export const GET = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
  },
  async (req, { orgId }) => {
    const query = (req.nextUrl.searchParams.get("q") || "").trim();
    if (!query) {
      return NextResponse.json({ candidates: [], jobs: [], pages: [] });
    }

    const q = query.toLowerCase();

    const matchedPages = pages
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.keywords.some((k) => k.includes(q))
      )
      .map((p) => ({
        name: p.name,
        path: p.path.replace("[orgId]", orgId!),
      }))
      .slice(0, 5);

    const [candidates, jobs] = await Promise.all([
      prisma.candidate.findMany({
        where: {
          orgId: orgId!,
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, fullName: true, email: true },
        take: 8,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.job.findMany({
        where: {
          orgId: orgId!,
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { location: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, title: true, location: true },
        take: 8,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      pages: matchedPages,
      candidates: candidates.map((c) => ({
        id: c.id,
        name: c.fullName,
        email: c.email ?? "No email",
      })),
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        department: j.location ?? "No location",
      })),
    });
  }
);
