const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_TAILOR_MODEL = process.env.OLLAMA_TAILOR_MODEL ?? "apex-resume-8b";

export interface TailoringDecisions {
  role_family: string;
  seniority_target: string;
  lead_project: string;
  dropped_projects: string[];
  honest_gaps: string[];
  key_jd_vocabulary: string[];
}

export interface TailoredExperience {
  company: string;
  role: string;
  dates: string;
  bullets: string[];
}

export interface TailoredProject {
  title: string;
  tech?: string | null;
  dates?: string | null;
  link?: string | null;
  bullets: string[];
}

export interface TailoredCV {
  summary: string;
  experience: TailoredExperience[];
  projects: TailoredProject[];
  skills: Record<string, string[]>;
  education: string;
  certifications?: string[];
}

export interface TailorResult {
  tailoring_decisions: TailoringDecisions;
  tailored_cv: TailoredCV;
  tailored_cover_letter: string;
}

export interface MasterProfile {
  name: string;
  location?: string | null;
  contact?: {
    phone?: string | null;
    email?: string | null;
    linkedin?: string | null;
    github?: string | null;
  };
  education?: string | null;
  experience?: Array<{
    company: string;
    role: string;
    dates?: string | null;
    bullets?: string[];
  }>;
  skills?: string[] | Record<string, string[]>;
  projects?: Array<{
    title: string;
    tech?: string | null;
    dates?: string | null;
    link?: string | null;
    bullets?: string[];
  }>;
  certifications?: string[];
}

const SYSTEM_PROMPT =
  "You are a resume tailoring assistant. You are given a candidate MASTER PROFILE (the only source of truth) and a JOB DESCRIPTION. Produce a tailored CV and a cover letter as a single JSON object with keys tailoring_decisions, tailored_cv, and tailored_cover_letter. Follow these rules exactly:\n1. Never fabricate. Every skill, technology, tool, metric, number, company, and project in your output must appear in the master profile. If it is not in the profile, you may not use it.\n2. Edit conservatively. Each tailored experience or project bullet must keep at least 70 percent of the words of one master bullet. You may reorder words, swap a single verb, or drop a clause, but you may not invent new technologies, metrics, or responsibilities.\n3. Drop, do not dilute. If a master bullet is not relevant to the job, omit it entirely rather than water it down.\n4. Reorder projects so the one most relevant to this job appears first, and list the projects you drop in dropped_projects.\n5. Record honest gaps. If the job requires something the candidate lacks, either acknowledge it in the cover letter, bridge it with an adjacent skill that is in the profile, or omit it. Never claim a skill the candidate does not have.\n6. Never use em dashes or en dashes. Use hyphens, commas, or the word 'to'.\n7. The cover letter is a fixed six-paragraph business letter: opening and positioning, education and background, most relevant project, secondary relevant work, why this company, closing.\n8. For an imperfect fit, position honestly: acknowledge gaps plainly, bridge missing tools with adjacent skills you do have.\nOutput only the JSON object, nothing else.";

export function isTailorOllamaEnabled(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_TAILOR_MODEL);
}

export async function tailorWithOllama(
  masterProfile: MasterProfile,
  jobDescription: string,
  timeoutMs = 180000
): Promise<TailorResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const userMessage = `MASTER PROFILE:\n${JSON.stringify(masterProfile, null, 2)}\n\nJOB DESCRIPTION:\n${jobDescription.slice(0, 6000)}`;

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_TAILOR_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.2, num_ctx: 16384 },
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      message?: { content?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data?.message?.content ?? data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as TailorResult;
    if (!parsed.tailored_cv || !parsed.tailored_cover_letter) return null;

    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
