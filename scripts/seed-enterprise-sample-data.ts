import { PrismaClient, ResumeParseStatus } from "@prisma/client";

const prisma = new PrismaClient();

const JOB_TEMPLATES = [
  {
    title: "Senior Frontend Engineer",
    description: "Lead modern frontend architecture across candidate and recruiter workflows.",
    location: "San Francisco, United States",
    status: "OPEN",
    workMode: "HYBRID",
    skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Jest", "Web Accessibility"],
  },
  {
    title: "Backend Platform Engineer",
    description: "Build and scale secure APIs, data pipelines, and reliability tooling.",
    location: "Austin, United States",
    status: "OPEN",
    workMode: "REMOTE",
    skills: ["Node.js", "PostgreSQL", "Prisma", "REST API", "Docker", "AWS"],
  },
  {
    title: "AI Product Manager",
    description: "Own roadmap and delivery for AI-powered hiring intelligence features.",
    location: "New York, United States",
    status: "OPEN",
    workMode: "HYBRID",
    skills: ["Product Management", "AI", "A/B Testing", "Data Analysis", "Stakeholder Management", "Agile"],
  },
  {
    title: "Data Engineer",
    description: "Design robust ETL and analytics pipelines for enterprise hiring metrics.",
    location: "Toronto, Canada",
    status: "OPEN",
    workMode: "REMOTE",
    skills: ["Python", "Apache Spark", "ETL", "Data Warehousing", "SQL", "PostgreSQL"],
  },
  {
    title: "Security Engineer",
    description: "Drive secure SDLC, cloud security posture, and compliance readiness.",
    location: "London, United Kingdom",
    status: "OPEN",
    workMode: "ONSITE",
    skills: ["Cybersecurity", "OWASP", "Application Security", "SOC 2", "Incident Response", "AWS"],
  },
  {
    title: "DevOps Engineer",
    description: "Improve CI/CD velocity and infrastructure reliability for multi-team delivery.",
    location: "Berlin, Germany",
    status: "OPEN",
    workMode: "HYBRID",
    skills: ["Kubernetes", "Docker", "Terraform", "GitHub Actions", "Prometheus", "AWS"],
  },
  {
    title: "QA Automation Engineer",
    description: "Own end-to-end test automation and release quality controls.",
    location: "Dubai, United Arab Emirates",
    status: "OPEN",
    workMode: "ONSITE",
    skills: ["Playwright", "Cypress", "Jest", "Test Automation", "Performance Testing", "CI/CD"],
  },
  {
    title: "UX Designer",
    description: "Craft accessible and conversion-focused experiences for hiring teams.",
    location: "Dublin, Ireland",
    status: "CLOSED",
    workMode: "REMOTE",
    skills: ["Figma", "UX Design", "Design Systems", "User Research", "Prototyping", "Web Accessibility"],
  },
];

const CANDIDATES = [
  ["Ayesha Rahman", "San Francisco, United States", "Senior Frontend Engineer", "REFERRAL"],
  ["Daniel Kim", "Austin, United States", "Backend Platform Engineer", "LINKEDIN"],
  ["Marta Kowalski", "Berlin, Germany", "DevOps Engineer", "REFERRAL"],
  ["Priya Nair", "Toronto, Canada", "Data Engineer", "INDEED"],
  ["Omar Haddad", "Dubai, United Arab Emirates", "QA Automation Engineer", "WEBSITE"],
  ["Sofia Mendes", "Lisbon, Portugal", "AI Product Manager", "REFERRAL"],
  ["Liam O'Connor", "Dublin, Ireland", "Security Engineer", "LINKEDIN"],
  ["Camila Alvarez", "Mexico City, Mexico", "UX Designer", "WEBSITE"],
] as const;

async function ensureSkill(orgId: string, name: string) {
  return prisma.skill.upsert({
    where: { orgId_name: { orgId, name } },
    create: { orgId, name },
    update: {},
    select: { id: true },
  });
}

function weight(i: number) {
  return i < 2 ? 5 : i < 4 ? 4 : 3;
}

async function seedJobs(orgId: string) {
  for (const job of JOB_TEMPLATES) {
    const existing = await prisma.job.findFirst({
      where: { orgId, title: job.title },
      select: { id: true },
    });

    const saved = existing
      ? await prisma.job.update({
          where: { id: existing.id },
          data: {
            description: job.description,
            location: job.location,
            status: job.status as "OPEN" | "CLOSED",
          },
          select: { id: true },
        })
      : await prisma.job.create({
          data: {
            orgId,
            title: job.title,
            description: job.description,
            location: job.location,
            status: job.status as "OPEN" | "CLOSED",
          },
          select: { id: true },
        });

    await prisma.$executeRaw`
      UPDATE "Job"
      SET "workMode" = ${job.workMode}::"WorkMode"
      WHERE id = ${saved.id}
    `;

    await prisma.jobSkill.deleteMany({ where: { jobId: saved.id } });
    for (let i = 0; i < job.skills.length; i += 1) {
      const skill = await ensureSkill(orgId, job.skills[i]);
      await prisma.jobSkill.create({
        data: { jobId: saved.id, skillId: skill.id, weight: weight(i) },
      });
    }
  }
}

async function seedCandidates(orgId: string) {
  const member = await prisma.membership.findFirst({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });

  for (let i = 0; i < CANDIDATES.length; i += 1) {
    const idx = i + 1;
    const [fullName, location, currentTitle, source] = CANDIDATES[i];
    const externalId = `SAMPLE-CAND-${String(idx).padStart(3, "0")}`;
    const email = `${fullName.toLowerCase().replace(/[^a-z]/g, ".").replace(/\.+/g, ".")}.sample@careeros.dev`;

    const candidate = await prisma.candidate.upsert({
      where: { orgId_externalId: { orgId, externalId } },
      create: {
        orgId,
        createdBy: member?.userId ?? null,
        fullName,
        email,
        phone: `+1-555-200${idx}`,
        location,
        currentTitle,
        yearsOfExperience: 4 + idx,
        notes: "Enterprise sample profile seeded for demo.",
        externalId,
        dateOfBirth: new Date(`199${idx}-05-15`),
        fingerprint: `sample-fingerprint-${orgId}-${idx}`,
        linkedinUrl: `https://linkedin.com/in/sample-${idx}`,
        githubUrl: `https://github.com/sample-${idx}`,
        portfolioUrl: `https://sample-${idx}.dev`,
        status: "ACTIVE",
        source,
        educationSchool: "Sample University",
        educationDegree: "BS Computer Science",
        educationYear: 2012 + idx,
      },
      update: {
        fullName,
        email,
        phone: `+1-555-200${idx}`,
        location,
        currentTitle,
        yearsOfExperience: 4 + idx,
        notes: "Enterprise sample profile seeded for demo.",
        dateOfBirth: new Date(`199${idx}-05-15`),
        fingerprint: `sample-fingerprint-${orgId}-${idx}`,
        linkedinUrl: `https://linkedin.com/in/sample-${idx}`,
        githubUrl: `https://github.com/sample-${idx}`,
        portfolioUrl: `https://sample-${idx}.dev`,
        status: "ACTIVE",
        source,
        educationSchool: "Sample University",
        educationDegree: "BS Computer Science",
        educationYear: 2012 + idx,
      },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.candidateSkill.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.candidateExperience.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.candidateEducation.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.candidateProject.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.candidateTechnology.deleteMany({ where: { candidateId: candidate.id } }),
      prisma.resume.deleteMany({ where: { candidateId: candidate.id } }),
    ]);

    const skillNames = JOB_TEMPLATES[i]?.skills.slice(0, 5) ?? ["Communication", "Problem Solving"];
    for (let s = 0; s < skillNames.length; s += 1) {
      const skill = await ensureSkill(orgId, skillNames[s]);
      await prisma.candidateSkill.create({
        data: {
          candidateId: candidate.id,
          skillId: skill.id,
          level: 3 + (s % 3),
          source: s % 2 === 0 ? "manual" : "resume",
        },
      });
    }

    await prisma.candidateEducation.create({
      data: {
        candidateId: candidate.id,
        school: "Sample University",
        degree: "BS Computer Science",
        location: "United States",
        startYear: 2008 + idx,
        endYear: 2012 + idx,
      },
    });

    await prisma.candidateExperience.createMany({
      data: [
        {
          candidateId: candidate.id,
          company: "SampleCorp A",
          role: currentTitle,
          location,
          startMonth: new Date(`2021-01-01`),
          endMonth: null,
          isCurrent: true,
          bullets: ["Led critical initiative", "Improved delivery reliability"],
        },
        {
          candidateId: candidate.id,
          company: "SampleCorp B",
          role: "Engineer",
          location,
          startMonth: new Date(`2018-01-01`),
          endMonth: new Date(`2020-12-01`),
          isCurrent: false,
          bullets: ["Built scalable systems", "Collaborated across functions"],
        },
      ],
    });

    await prisma.candidateProject.createMany({
      data: [
        {
          candidateId: candidate.id,
          title: "Enterprise Workflow Suite",
          dates: "2024",
          techStack: skillNames.slice(0, 3).join(", "),
          link: `https://github.com/sample-${idx}/workflow-suite`,
          bullets: ["Delivered high-impact feature", "Improved user outcomes"],
        },
        {
          candidateId: candidate.id,
          title: "Automation Toolkit",
          dates: "2023",
          techStack: skillNames.slice(2, 5).join(", "),
          link: `https://github.com/sample-${idx}/automation-toolkit`,
          bullets: ["Reduced manual effort", "Standardized quality checks"],
        },
      ],
    });

    await prisma.candidateTechnology.createMany({
      data: [
        { candidateId: candidate.id, category: "Engineering", items: skillNames.slice(0, 3) },
        { candidateId: candidate.id, category: "Business & People", items: ["Communication", "Leadership"] },
      ],
    });

    await prisma.resume.create({
      data: {
        candidateId: candidate.id,
        fileName: `${fullName.replace(/\s+/g, "_")}_Resume.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 250000 + idx * 1000,
        rawText: `${fullName} resume summary for ${currentTitle}.`,
        parsedJson: {
          summary: `${fullName} profile`,
          skills: skillNames,
          experienceCount: 2,
          educationCount: 1,
        },
        parseStatus: ResumeParseStatus.SAVED,
        parsedAt: new Date(),
        parseModel: "gpt-4o-mini",
        promptVersion: "candidate-profile-v1",
      },
    });
  }
}

async function main() {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!org) throw new Error("No organization found.");

  await seedJobs(org.id);
  await seedCandidates(org.id);

  const [jobsCount, candidatesCount] = await Promise.all([
    prisma.job.count({ where: { orgId: org.id } }),
    prisma.candidate.count({ where: { orgId: org.id } }),
  ]);

  console.log(`Seeded org: ${org.name} (${org.id})`);
  console.log(`jobs_total=${jobsCount}`);
  console.log(`candidates_total=${candidatesCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
