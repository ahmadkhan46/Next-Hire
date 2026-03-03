import { NextRequest, NextResponse } from "next/server";
import { createRoute } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

export const GET = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "candidates:read",
  },
  async (req, { orgId }) => {
    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit") || "100");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 100;
    const search = searchParams.get("search")?.trim();
    const view = searchParams.get("view");

    const where = {
      orgId: orgId!,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    if (view === "compare") {
      const candidates = await prisma.candidate.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          currentTitle: true,
          yearsOfExperience: true,
          location: true,
          skills: {
            select: {
              skill: { select: { name: true } },
            },
          },
          matches: {
            select: {
              score: true,
            },
          },
          _count: {
            select: {
              projects: true,
              educations: true,
              experiences: true,
            },
          },
        },
        orderBy: { fullName: "asc" },
        take: limit,
      });

      return NextResponse.json({
        candidates: candidates.map((candidate) => {
          const avgMatchScore = candidate.matches.length
            ? candidate.matches.reduce((sum, item) => sum + item.score, 0) / candidate.matches.length
            : 0;
          return {
            id: candidate.id,
            fullName: candidate.fullName,
            email: candidate.email,
            currentTitle: candidate.currentTitle,
            yearsOfExperience: candidate.yearsOfExperience,
            location: candidate.location,
            skills: candidate.skills.map((entry) => entry.skill.name),
            avgMatchScore,
            projectsCount: candidate._count.projects,
            educationsCount: candidate._count.educations,
            experiencesCount: candidate._count.experiences,
          };
        }),
      });
    }

    const candidates = await prisma.candidate.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: { fullName: "asc" },
      take: limit,
    });

    return NextResponse.json({ candidates });
  }
);

export const POST = createRoute(
  {
    requireAuth: true,
    requireOrg: true,
    permission: "candidates:write",
    rateLimit: { type: "api" },
  },
  async (req: NextRequest, { orgId, userId }) => {
    const body = await req.json().catch(() => ({}));

    const fullName = String(body.fullName ?? "").trim();
    const emailRaw = String(body.email ?? "").trim().toLowerCase();
    const phone = body.phone ? String(body.phone).trim() : null;
    const location = body.location ? String(body.location).trim() : null;
    const currentTitle = body.currentTitle ? String(body.currentTitle).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    const yearsRaw = body.yearsOfExperience;
    const yearsOfExperience =
      yearsRaw === null || yearsRaw === undefined || yearsRaw === "" ? null : Number(yearsRaw);

    const educationSchool = body.educationSchool ? String(body.educationSchool).trim() : null;
    const educationDegree = body.educationDegree ? String(body.educationDegree).trim() : null;
    const educationYearRaw = body.educationYear;
    const educationYear =
      educationYearRaw === null || educationYearRaw === undefined || educationYearRaw === ""
        ? null
        : Number(educationYearRaw);

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }
    if (!emailRaw) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailRaw)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (yearsOfExperience !== null && !Number.isFinite(yearsOfExperience)) {
      return NextResponse.json({ error: "Invalid yearsOfExperience" }, { status: 400 });
    }
    if (educationYear !== null && !Number.isFinite(educationYear)) {
      return NextResponse.json({ error: "Invalid educationYear" }, { status: 400 });
    }

    const existing = await prisma.candidate.findFirst({
      where: {
        orgId: orgId!,
        OR: [
          {
            fullName: { equals: fullName, mode: "insensitive" as const },
            email: { equals: emailRaw, mode: "insensitive" as const },
          },
          ...(phone
            ? [
                {
                  fullName: { equals: fullName, mode: "insensitive" as const },
                  phone: { equals: phone, mode: "insensitive" as const },
                },
              ]
            : []),
        ],
      },
      select: { id: true, fullName: true, email: true, phone: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Candidate already exists", candidate: existing },
        { status: 409 }
      );
    }

    const candidate = await prisma.candidate.create({
      data: {
        orgId: orgId!,
        createdBy: userId ?? null,
        fullName,
        email: emailRaw,
        phone,
        location,
        currentTitle,
        yearsOfExperience: yearsOfExperience as number | null,
        notes,
        educationSchool,
        educationDegree,
        educationYear: educationYear as number | null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        location: true,
        currentTitle: true,
        yearsOfExperience: true,
        notes: true,
        educationSchool: true,
        educationDegree: true,
        educationYear: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, id: candidate.id, candidate }, { status: 201 });
  }
);
