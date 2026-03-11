import { PrismaClient, MatchStatus } from "@prisma/client";

const prisma = new PrismaClient();

type SeedCandidate = {
  fullName: string;
  email: string;
  phone?: string;
  skills: string[];
  location?: string;
  currentTitle?: string;
  yearsOfExperience?: number;
  notes?: string;
  educationSchool?: string;
  educationDegree?: string;
  educationYear?: number;
  experiences?: SeedExperience[];
  projects?: SeedProject[];
  technologies?: SeedTechnology[];
};

type SeedExperience = {
  company: string;
  role: string;
  location?: string;
  startMonth: string;
  endMonth?: string;
  isCurrent?: boolean;
  bullets: string[];
};

type SeedProject = {
  title: string;
  dates?: string;
  techStack?: string;
  link?: string;
  bullets: string[];
};

type SeedTechnology = {
  category: string;
  items: string[];
};

async function main() {
  console.log("Seeding database...");

  const seedEmail = "ahmadkhan58012@gmail.com";
  const seedName = "Ahmad Khan";
  const orgName = "NextHire";

  let org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!org) {
    org = await prisma.organization.create({ data: { name: orgName } });
  }

  const user = await prisma.user.upsert({
    where: { email: seedEmail },
    update: { name: seedName },
    create: { email: seedEmail, name: seedName },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, orgId: org.id, role: "OWNER" },
  });

  const skillNames = [
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "PostgreSQL",
    "SQL",
    "AWS",
    "Python",
    "Data Visualization",
    "Product Strategy",
    "Java",
    "Machine Learning",
    "NLP",
    "Deep Learning",
  ];

  const skills = await Promise.all(
    skillNames.map((name) =>
      prisma.skill.upsert({
        where: { orgId_name: { orgId: org.id, name } },
        update: {},
        create: { orgId: org.id, name },
      })
    )
  );

  const jobs = [
    {
      title: "Senior Full-Stack Engineer",
      description: "Build scalable web applications with modern tech stack.",
      location: "Remote",
      status: "OPEN" as const,
      skills: [
        { name: "TypeScript", weight: 5 },
        { name: "React", weight: 4 },
        { name: "Node.js", weight: 4 },
        { name: "PostgreSQL", weight: 3 },
        { name: "AWS", weight: 3 },
      ],
    },
    {
      title: "Product Analyst",
      description: "Own product analytics and insights across the hiring funnel.",
      location: "London, UK",
      status: "OPEN" as const,
      skills: [
        { name: "Python", weight: 4 },
        { name: "Data Visualization", weight: 4 },
        { name: "Product Strategy", weight: 3 },
        { name: "SQL", weight: 3 },
      ],
    },
  ];

  const createdJobs = [] as { id: string; title: string; skillWeights: Record<string, number> }[];

  for (const job of jobs) {
    const existing = await prisma.job.findFirst({
      where: { orgId: org.id, title: job.title },
    });

    const record =
      existing ??
      (await prisma.job.create({
        data: {
          orgId: org.id,
          title: job.title,
          description: job.description,
          location: job.location,
          status: job.status,
        },
      }));

    const skillWeights: Record<string, number> = {};
    for (const skill of job.skills) {
      skillWeights[skill.name] = skill.weight;
    }

    const skillMap = skills.reduce<Record<string, string>>((acc, skill) => {
      acc[skill.name] = skill.id;
      return acc;
    }, {});

    await prisma.jobSkill.createMany({
      data: job.skills
        .map((s) => ({
          jobId: record.id,
          skillId: skillMap[s.name],
          weight: s.weight,
        }))
        .filter((row) => Boolean(row.skillId)),
      skipDuplicates: true,
    });

    createdJobs.push({ id: record.id, title: record.title, skillWeights });
  }

  const candidates: SeedCandidate[] = [
    {
      fullName: "Alice Johnson",
      email: "alice@example.com",
      phone: "+1-555-0101",
      skills: ["JavaScript", "React", "Node.js", "AWS"],
      location: "San Francisco, CA",
      currentTitle: "Full-Stack Engineer",
      yearsOfExperience: 5,
      notes: "Strong React + Node.js background, open to remote work.",
      educationSchool: "Stanford University",
      educationDegree: "BSc Computer Science",
      educationYear: 2020,
    },
    {
      fullName: "Bob Smith",
      email: "bob@example.com",
      phone: "+1-555-0102",
      skills: ["TypeScript", "React", "PostgreSQL"],
      location: "Austin, TX",
      currentTitle: "Frontend Engineer",
      yearsOfExperience: 3,
      notes: "Focused on UI systems and performance optimization.",
      educationSchool: "University of Texas",
      educationDegree: "BSc Software Engineering",
      educationYear: 2021,
    },
    {
      fullName: "Carol Davis",
      email: "carol@example.com",
      phone: "+1-555-0103",
      skills: ["Python", "Data Visualization", "SQL", "Product Strategy"],
      location: "London, UK",
      currentTitle: "Product Analyst",
      yearsOfExperience: 7,
      notes: "Strong analytics and stakeholder management.",
      educationSchool: "London School of Economics",
      educationDegree: "MSc Data Analytics",
      educationYear: 2018,
    },
    {
      fullName: "Ahmad Said Khan",
      email: "ahmadsaidkhan46@gmail.com",
      phone: "+353-899830291",
      skills: ["Python", "JavaScript", "SQL", "Machine Learning", "NLP", "Deep Learning", "React", "Node.js"],
      location: "Athlone, Ireland",
      currentTitle: "AI & Software Engineer",
      yearsOfExperience: 2,
      notes: "AI and software engineer with production-ready ML and full-stack experience.",
      educationSchool: "Technological University of the Shannon",
      educationDegree: "MSc Software Design with Artificial Intelligence",
      educationYear: 2026,
      experiences: [
        {
          company: "Affy Clouds IT Solutions",
          role: "AI Engineer",
          location: "Bhopal, India",
          startMonth: "2024-08-01",
          endMonth: "2025-08-01",
          bullets: [
            "Developed a Resume Parser using NLP and deep learning, reducing manual entry effort by 40% and improving processing speed by 3x.",
            "Built a Conversational AI Chatbot leveraging LLMs, achieving 85%+ intent recognition accuracy and cutting support response time by 30%.",
            "Applied Generative AI and RNNs to model sequential data, improving prediction accuracy by 20%.",
            "Fine-tuned pre-trained models with embeddings, enhancing contextual accuracy by 15–25%.",
            "Designed and deployed supervised ML models (classification, regression, clustering) with 90%+ test accuracy.",
          ],
        },
        {
          company: "Affy Clouds IT Solutions",
          role: "AI Intern",
          location: "Bhopal, India",
          startMonth: "2023-07-01",
          endMonth: "2024-07-01",
          bullets: [
            "Built and fine-tuned supervised ML models for multiple client datasets, achieving up to 92% accuracy.",
            "Designed end-to-end ML pipelines using Scikit-learn and Pandas, cutting processing time by 25%.",
            "Created visual analytics dashboards with Matplotlib to improve decision-making speed by 20%.",
            "Contributed to 3+ production-ready AI projects, improving reliability and deployment efficiency.",
          ],
        },
      ],
      projects: [
        {
          title: "Predictive Analysis of Student Performance",
          dates: "May 2025",
          techStack: "Python · Scikit-learn · Data Preprocessing",
          bullets: [
            "Built decision tree and logistic regression models to predict student performance.",
            "Achieved 85%+ accuracy with strong feature engineering and evaluation.",
          ],
        },
        {
          title: "Resume Parser & Conversational AI Chatbot",
          dates: "Jan 2025",
          techStack: "Python · NLP · Deep Learning · LLMs",
          bullets: [
            "Developed a Resume Parser to extract structured data, improving processing efficiency by 40%.",
            "Built and fine-tuned an LLM-based chatbot achieving 85%+ intent recognition accuracy.",
            "Integrated both modules into a unified recruitment assistant.",
          ],
        },
        {
          title: "Trello Clone – Task Management Application",
          dates: "Aug 2024",
          techStack: "React.js · Next.js · Vercel",
          link: "https://trello-clone-lad7a7zka-ahmads-projects-5f486425.vercel.app",
          bullets: [
            "Built a Trello-like web app with boards, lists, and drag-and-drop tasks.",
            "Deployed on Vercel with responsive UI and real-time state management.",
          ],
        },
      ],
      technologies: [
        {
          category: "Languages",
          items: ["Python", "JavaScript", "Java", "SQL"],
        },
        {
          category: "AI/ML",
          items: ["Supervised Learning", "Deep Learning", "NLP", "LLMs", "RNNs", "Generative AI"],
        },
        {
          category: "Data & Analytics",
          items: ["Pandas", "NumPy", "Matplotlib", "Seaborn", "Power BI"],
        },
        {
          category: "Frameworks",
          items: ["TensorFlow", "PyTorch", "Keras", "Scikit-learn", "React.js", "Next.js", "Node.js"],
        },
        {
          category: "Cloud & DevOps",
          items: ["Git", "Docker (basic)", "Vercel", "AWS (basic)", "Linux"],
        },
      ],
    },
  ];

  const createdCandidates = [] as { id: string; fullName: string; skills: string[] }[];

  for (const candidate of candidates) {
    const existing = await prisma.candidate.findFirst({
      where: { orgId: org.id, email: candidate.email },
    });

    const record =
      existing ??
      (await prisma.candidate.create({
        data: {
          orgId: org.id,
          fullName: candidate.fullName,
          email: candidate.email,
          phone: candidate.phone ?? null,
          location: candidate.location ?? null,
          currentTitle: candidate.currentTitle ?? null,
          yearsOfExperience: candidate.yearsOfExperience ?? null,
          notes: candidate.notes ?? null,
          educationSchool: candidate.educationSchool ?? null,
          educationDegree: candidate.educationDegree ?? null,
          educationYear: candidate.educationYear ?? null,
        },
      }));

    if (existing) {
      await prisma.candidate.update({
        where: { id: existing.id },
        data: {
          location: candidate.location ?? null,
          currentTitle: candidate.currentTitle ?? null,
          yearsOfExperience: candidate.yearsOfExperience ?? null,
          notes: candidate.notes ?? null,
          educationSchool: candidate.educationSchool ?? null,
          educationDegree: candidate.educationDegree ?? null,
          educationYear: candidate.educationYear ?? null,
        },
      });
    }

    if (candidate.experiences?.length) {
      await prisma.candidateExperience.deleteMany({ where: { candidateId: record.id } });
      await prisma.candidateExperience.createMany({
        data: candidate.experiences.map((exp) => ({
          candidateId: record.id,
          company: exp.company,
          role: exp.role,
          location: exp.location ?? null,
          startMonth: new Date(exp.startMonth),
          endMonth: exp.endMonth ? new Date(exp.endMonth) : null,
          isCurrent: exp.isCurrent ?? false,
          bullets: exp.bullets,
        })),
      });
    }

    if (candidate.projects?.length) {
      await prisma.candidateProject.deleteMany({ where: { candidateId: record.id } });
      await prisma.candidateProject.createMany({
        data: candidate.projects.map((project) => ({
          candidateId: record.id,
          title: project.title,
          dates: project.dates ?? null,
          techStack: project.techStack ?? null,
          link: project.link ?? null,
          bullets: project.bullets,
        })),
      });
    }

    if (candidate.technologies?.length) {
      await prisma.candidateTechnology.deleteMany({ where: { candidateId: record.id } });
      await prisma.candidateTechnology.createMany({
        data: candidate.technologies.map((tech) => ({
          candidateId: record.id,
          category: tech.category,
          items: tech.items,
        })),
      });
    }

    createdCandidates.push({ id: record.id, fullName: record.fullName, skills: candidate.skills });

    const skillMap = skills.reduce<Record<string, string>>((acc, skill) => {
      acc[skill.name] = skill.id;
      return acc;
    }, {});

    await prisma.candidateSkill.createMany({
      data: candidate.skills
        .map((name) => ({
          candidateId: record.id,
          skillId: skillMap[name],
        }))
        .filter((row) => Boolean(row.skillId)),
      skipDuplicates: true,
    });
  }

  for (const job of createdJobs) {
    const totalWeight = Object.values(job.skillWeights).reduce((sum, w) => sum + w, 0);

    for (const candidate of createdCandidates) {
      const matched = candidate.skills.filter((s) => job.skillWeights[s]);
      const missing = Object.keys(job.skillWeights).filter((s) => !matched.includes(s));
      const matchedWeight = matched.reduce((sum, skill) => sum + (job.skillWeights[skill] ?? 0), 0);
      const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;

      await prisma.matchResult.upsert({
        where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
        update: {
          score,
          matched,
          missing,
          matchedWeight,
          totalWeight,
        },
        create: {
          jobId: job.id,
          candidateId: candidate.id,
          orgId: org.id,
          score,
          matched,
          missing,
          matchedWeight,
          totalWeight,
          status: score >= 0.75 ? MatchStatus.SHORTLISTED : MatchStatus.NONE,
        },
      });
    }
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
