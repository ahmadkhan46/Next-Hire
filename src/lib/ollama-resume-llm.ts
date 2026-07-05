import type { CandidateProfileExtract } from "@/lib/resume-extract-schema";

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_RESUME_MODEL = process.env.OLLAMA_RESUME_MODEL ?? "apex-resume-qwen-3b:latest";

// Schema the fine-tuned model was trained on (from training/data/*.jsonl)
interface OllamaRawExtract {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedin?: string | null;
  github?: string | null;
  website?: string | null;
  summary?: string | null;
  skills?: Record<string, string[]>;
  experience?: Array<{
    title?: string;
    company?: string;
    period?: string;
    location?: string;
    bullets?: string[];
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    period?: string;
    gpa?: string;
  }>;
  projects?: Array<{
    name?: string;
    tech?: string;
    url?: string;
    bullets?: string[];
  }>;
  certifications?: Array<{ name?: string; issuer?: string; date?: string }>;
  achievements?: string[];
  languages?: Array<{ language?: string; level?: string }>;
  hobbies?: string[];
}

function parsePeriod(period: string | undefined | null): {
  start: { year: number; month: number } | null;
  end: { year: number; month: number } | null;
  isCurrent: boolean;
} {
  if (!period) return { start: null, end: null, isCurrent: false };
  const isCurrent = /present|current|now/i.test(period);
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

  const parseYM = (s: string): { year: number; month: number } | null => {
    const ym = s.match(/\d{4}/);
    if (!ym) return null;
    const year = parseInt(ym[0]);
    const lc = s.toLowerCase();
    const mi = months.findIndex((m) => lc.includes(m));
    return { year, month: mi >= 0 ? mi + 1 : 1 };
  };

  const parts = period.split(/\s*[-–—]\s*|\s+to\s+/i).map((p) => p.trim()).filter(Boolean);
  const start = parts[0] ? parseYM(parts[0]) : null;
  const end = isCurrent ? null : parts[1] ? parseYM(parts[1]) : null;
  return { start, end, isCurrent };
}

function mapToAppSchema(raw: OllamaRawExtract): CandidateProfileExtract {
  const skillsObj = raw.skills ?? {};
  const allSkills = Array.from(
    new Set(Object.values(skillsObj).flat().map((s) => String(s).trim()).filter(Boolean))
  );
  const technologies = Object.entries(skillsObj)
    .map(([cat, items]) => ({
      category: cat.toUpperCase(),
      items: (items ?? []).map((s) => String(s).trim()).filter(Boolean),
    }))
    .filter((t) => t.items.length > 0);

  const educations = (raw.education ?? []).map((edu) => {
    const years = (edu.period ?? "").match(/\d{4}/g) ?? [];
    return {
      school: edu.institution ?? null,
      degree: edu.degree ?? null,
      location: null,
      startYear: years[0] ? parseInt(years[0]) : null,
      endYear: years[1] ? parseInt(years[1]) : null,
    };
  });

  const primaryEdu = educations[0] ?? null;

  const experiences = (raw.experience ?? []).map((exp) => {
    const { start, end, isCurrent } = parsePeriod(exp.period);
    return {
      company: (exp.company ?? "").trim() || "Unknown",
      role: (exp.title ?? "").trim() || "Unknown",
      location: exp.location ?? null,
      start,
      end,
      isCurrent,
      bullets: (exp.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
    };
  });

  const projects = (raw.projects ?? []).map((p) => ({
    title: (p.name ?? "").trim() || "Project",
    dates: null,
    techStack: p.tech ?? null,
    link: p.url ?? null,
    bullets: (p.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
  }));

  return {
    personal: {
      fullName: raw.name ?? null,
      email: raw.email ?? null,
      phone: raw.phone ?? null,
      location: raw.location ?? null,
      currentTitle: experiences[0]?.role ?? null,
      yearsOfExperience: null,
      notes: raw.summary ?? null,
      education: primaryEdu
        ? { school: primaryEdu.school, degree: primaryEdu.degree, year: primaryEdu.endYear }
        : null,
    },
    educations,
    skillsFlat: allSkills,
    technologies,
    experiences,
    projects,
  };
}

const SYSTEM_PROMPT =
  "You parse resume text and return ALL information as structured JSON. No invented data — only what appears in the source text. Return JSON only.";

const USER_TEMPLATE = `Extract ALL resume data as JSON. Include every field you can find. No invented data. Return JSON with these fields (omit only if truly absent):
{"name":"Full Name","email":"...","phone":"...","location":"...","linkedin":"...","github":"...","website":"...","summary":"...","skills":{"Languages":["Python"],"Frameworks":["React"]},"experience":[{"title":"...","company":"...","period":"...","location":"...","bullets":["..."]}],"education":[{"institution":"...","degree":"...","period":"...","gpa":"..."}],"projects":[{"name":"...","tech":"...","url":"...","bullets":["..."]}],"certifications":[{"name":"...","issuer":"...","date":"..."}],"achievements":["..."],"languages":[{"language":"...","level":"..."}],"hobbies":["..."]}

RESUME:
`;

export function isOllamaEnabled(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_RESUME_MODEL);
}

export async function extractWithOllama(
  resumeText: string,
  timeoutMs = 45000
): Promise<CandidateProfileExtract | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_RESUME_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: USER_TEMPLATE + resumeText.slice(0, 8000) },
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.1, num_ctx: 16384 },
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      message?: { content?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data?.message?.content ?? data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const rawJson = JSON.parse(content) as OllamaRawExtract;
    const mapped = mapToAppSchema(rawJson);
    // Reject hollow extracts — fall through to OpenAI fallback
    const hasName = Boolean(mapped.personal.fullName?.trim());
    const hasSubstance = mapped.experiences.length > 0 || mapped.educations.length > 0;
    if (!hasName || !hasSubstance) return null;
    return mapped;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
