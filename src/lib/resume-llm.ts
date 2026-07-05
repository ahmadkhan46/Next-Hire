import OpenAI from "openai";
import { ZodError } from "zod";
import {
  candidateProfileExtractSchema,
  type CandidateProfileExtract,
} from "@/lib/resume-extract-schema";
import { estimateCost } from "@/lib/llm-cost";
import { LLMError } from "@/lib/errors";
import { trackLLMUsage } from "@/lib/llm-tracking";
import { logger } from "@/lib/logger";
import { extractWithOllama, isOllamaEnabled } from "@/lib/ollama-resume-llm";

const PROMPT_VERSION = "candidate-profile-v1";
const DEFAULT_MODEL = process.env.OPENAI_RESUME_MODEL ?? "gpt-4o-mini";
const MAX_TEXT_CHARS = 50000;

// Upload route now runs with maxDuration = 120 s, so LLM calls can take longer.
// Individual parse calls default to 45 s on Vercel, 60 s locally.
const IS_VERCEL = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const DEFAULT_TIMEOUT_MS = IS_VERCEL ? 45000 : 60000;

// Models that support structured outputs (json_schema)
const STRUCTURED_OUTPUT_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4o-2024-08-06'];

if (!process.env.OPENAI_API_KEY) {
  logger.warn("OPENAI_API_KEY not set - LLM resume parsing will fail");
}

if (!STRUCTURED_OUTPUT_MODELS.includes(DEFAULT_MODEL)) {
  logger.warn(
    `Model ${DEFAULT_MODEL} may not support structured outputs. Use gpt-4o or gpt-4o-mini.`
  );
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["personal", "educations", "skillsFlat", "technologies", "experiences", "projects"],
  properties: {
    personal: {
      type: "object",
      additionalProperties: false,
      required: [
        "fullName",
        "email",
        "phone",
        "location",
        "currentTitle",
        "yearsOfExperience",
        "notes",
        "education",
      ],
      properties: {
        fullName: { anyOf: [{ type: "string" }, { type: "null" }] },
        email: { anyOf: [{ type: "string" }, { type: "null" }] },
        phone: { anyOf: [{ type: "string" }, { type: "null" }] },
        location: { anyOf: [{ type: "string" }, { type: "null" }] },
        currentTitle: { anyOf: [{ type: "string" }, { type: "null" }] },
        yearsOfExperience: { anyOf: [{ type: "integer" }, { type: "null" }] },
        notes: { anyOf: [{ type: "string" }, { type: "null" }] },
        education: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              required: ["school", "degree", "year"],
              properties: {
                school: { anyOf: [{ type: "string" }, { type: "null" }] },
                degree: { anyOf: [{ type: "string" }, { type: "null" }] },
                year: { anyOf: [{ type: "integer" }, { type: "null" }] },
              },
            },
          ],
        },
      },
    },
    educations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["school", "degree", "location", "startYear", "endYear"],
        properties: {
          school: { anyOf: [{ type: "string" }, { type: "null" }] },
          degree: { anyOf: [{ type: "string" }, { type: "null" }] },
          location: { anyOf: [{ type: "string" }, { type: "null" }] },
          startYear: { anyOf: [{ type: "integer" }, { type: "null" }] },
          endYear: { anyOf: [{ type: "integer" }, { type: "null" }] },
        },
      },
    },
    skillsFlat: {
      type: "array",
      items: { type: "string" },
    },
    technologies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "items"],
        properties: {
          category: { type: "string" },
          items: { type: "array", items: { type: "string" } },
        },
      },
    },
    experiences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["company", "role", "location", "start", "end", "isCurrent", "bullets"],
        properties: {
          company: { type: "string" },
          role: { type: "string" },
          location: { anyOf: [{ type: "string" }, { type: "null" }] },
          start: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: ["year", "month"],
                properties: {
                  year: { type: "integer" },
                  month: { type: "integer", minimum: 1, maximum: 12 },
                },
              },
            ],
          },
          end: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: ["year", "month"],
                properties: {
                  year: { type: "integer" },
                  month: { type: "integer", minimum: 1, maximum: 12 },
                },
              },
            ],
          },
          isCurrent: { type: "boolean" },
          bullets: { type: "array", items: { type: "string" } },
        },
      },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "dates", "techStack", "link", "bullets"],
        properties: {
          title: { type: "string" },
          dates: { anyOf: [{ type: "string" }, { type: "null" }] },
          techStack: { anyOf: [{ type: "string" }, { type: "null" }] },
          link: { anyOf: [{ type: "string" }, { type: "null" }] },
          bullets: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

type LlmResult = {
  extract: CandidateProfileExtract;
  model: string;
  promptVersion: string;
  warnings: string[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
};

export class ResumeParseError extends Error {
  kind: "JSON_PARSE" | "VALIDATION";
  constructor(kind: "JSON_PARSE" | "VALIDATION", message: string) {
    super(message);
    this.kind = kind;
  }
}

function trimText(text: string) {
  if (text.length <= MAX_TEXT_CHARS) return { text, warnings: [] as string[] };
  return {
    text: text.slice(0, MAX_TEXT_CHARS),
    warnings: [`rawText trimmed to ${MAX_TEXT_CHARS} chars`],
  };
}

function buildSystemPrompt(extra?: string) {
  return [
    "You are an expert resume parser.",
    "Return JSON only that matches the provided schema.",
    "Do not guess. If missing, use null.",
    "Bullets must be short strings.",
    "Deduplicate skills and technology items.",
    "Return educations as an array (most recent first if possible).",
    "Category names must be simple uppercase labels (e.g., LANGUAGES, AI/ML, FRAMEWORKS, DATA & ANALYTICS, CLOUD & DEVOPS, TOOLS).",
    extra ? `Previous validation error: ${extra}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function callOpenAIWithTimeout(
  resumeText: string,
  validationError: string | undefined,
  timeoutMs: number
) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { text, warnings } = trimText(resumeText);

  const responsePromise = openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: buildSystemPrompt(validationError) },
      { role: "user", content: `RESUME TEXT:\n${text}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "candidate_profile_extract",
        schema: responseSchema,
        strict: true,
      },
    },
  });

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    const response = await responsePromise;
    const outputText = response.choices[0]?.message?.content ?? "";
    const usage = response.usage;

    if (!outputText) {
      throw new Error("No JSON output from LLM");
    }

    return { outputText, warnings, usage };
  }

  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("LLM timeout"));
    }, timeoutMs);
  });

  const response = await Promise.race([responsePromise, timeoutPromise]);
  if (timeoutId) clearTimeout(timeoutId);

  const outputText = response.choices[0]?.message?.content ?? "";
  const usage = response.usage;

  if (!outputText) {
    throw new Error("No JSON output from LLM");
  }

  return { outputText, warnings, usage };
}

export async function extractCandidateProfile(
  resumeText: string,
  orgId?: string,
  options?: { timeoutMs?: number }
): Promise<LlmResult> {
  const startTime = Date.now();

  // Try fine-tuned Ollama model first (free, local)
  if (isOllamaEnabled()) {
    try {
      const ollamaExtract = await extractWithOllama(resumeText);
      if (ollamaExtract) {
        logger.info("Resume parsed via Ollama (apex-resume-qwen-3b)");
        return {
          extract: ollamaExtract,
          model: process.env.OLLAMA_RESUME_MODEL ?? "apex-resume-qwen-3b:latest",
          promptVersion: PROMPT_VERSION,
          warnings: [],
          usage: undefined,
        };
      }
    } catch (ollamaErr) {
      logger.warn("Ollama extraction failed, falling back to OpenAI", { error: ollamaErr });
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new LLMError("OPENAI_API_KEY not configured", "openai", DEFAULT_MODEL);
  }

  try {
    const timeoutMs =
      typeof options?.timeoutMs === "number"
        ? options.timeoutMs
        : Number(process.env.OPENAI_RESUME_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    const { outputText, warnings, usage } = await callOpenAIWithTimeout(
      resumeText,
      undefined,
      timeoutMs
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch (err: any) {
      throw new ResumeParseError("JSON_PARSE", err?.message ?? "Invalid JSON");
    }
    const extract = candidateProfileExtractSchema.parse(parsed);
    
    const usageData = usage ? {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      estimatedCost: estimateCost(DEFAULT_MODEL, usage.prompt_tokens, usage.completion_tokens),
    } : undefined;
    
    // Track usage
    if (orgId && usageData) {
      await trackLLMUsage({
        orgId,
        model: DEFAULT_MODEL,
        operation: 'resume_parse',
        inputTokens: usageData.inputTokens,
        outputTokens: usageData.outputTokens,
        totalTokens: usageData.totalTokens,
        cost: usageData.estimatedCost,
        success: true,
        duration: Date.now() - startTime,
      });
    }
    
    return {
      extract,
      model: DEFAULT_MODEL,
      promptVersion: PROMPT_VERSION,
      warnings,
      usage: usageData,
    };
  } catch (err: any) {
    // Handle both JSON parse errors and Zod validation errors
    if (err instanceof ResumeParseError || err instanceof ZodError) {
      const errorType =
        err instanceof ResumeParseError ? "JSON parse error" : "Zod validation error";
      logger.warn(`${errorType}, retrying with error context...`);

      const timeoutMs =
        typeof options?.timeoutMs === "number"
          ? options.timeoutMs
          : Number(process.env.OPENAI_RESUME_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
      const { outputText, warnings, usage } = await callOpenAIWithTimeout(
        resumeText,
        err.message,
        timeoutMs
      );
      let parsed: unknown;
      try {
        parsed = JSON.parse(outputText);
      } catch (parseErr: any) {
        throw new ResumeParseError("JSON_PARSE", parseErr?.message ?? "Invalid JSON");
      }
      const extract = candidateProfileExtractSchema.parse(parsed);
      
      const usageData = usage ? {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        estimatedCost: estimateCost(DEFAULT_MODEL, usage.prompt_tokens, usage.completion_tokens),
      } : undefined;
      
      // Track retry usage
      if (orgId && usageData) {
        await trackLLMUsage({
          orgId,
          model: DEFAULT_MODEL,
          operation: 'resume_parse_retry',
          inputTokens: usageData.inputTokens,
          outputTokens: usageData.outputTokens,
          totalTokens: usageData.totalTokens,
          cost: usageData.estimatedCost,
          success: true,
          duration: Date.now() - startTime,
          metadata: { retryReason: errorType },
        });
      }
      
      return {
        extract,
        model: DEFAULT_MODEL,
        promptVersion: PROMPT_VERSION,
        warnings: [...warnings, `Retried due to ${errorType}`],
        usage: usageData,
      };
    }
    
    // Track failure
    if (orgId) {
      await trackLLMUsage({
        orgId,
        model: DEFAULT_MODEL,
        operation: 'resume_parse',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        success: false,
        duration: Date.now() - startTime,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      });
    }
    
    throw err;
  }
}

// ─── Batch normalizer ────────────────────────────────────────────────────────
// json_object mode lets the model omit nullable fields entirely (undefined)
// instead of setting them to null.  This normalizer fills gaps before Zod.
function normalizeBatchItem(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  // ── personal ──
  const p = obj.personal && typeof obj.personal === "object"
    ? { ...(obj.personal as Record<string, unknown>) }
    : {};
  p.fullName        = p.fullName        ?? null;
  p.email           = p.email           ?? null;
  p.phone           = p.phone           ?? null;
  p.location        = p.location        ?? null;
  p.currentTitle    = p.currentTitle    ?? null;
  p.yearsOfExperience = p.yearsOfExperience ?? null;
  p.notes           = p.notes           ?? null;
  p.education       = p.education       ?? null;
  obj.personal = p;

  // ── top-level arrays ──
  obj.skillsFlat  = Array.isArray(obj.skillsFlat)  ? obj.skillsFlat  : [];
  obj.educations  = Array.isArray(obj.educations)  ? obj.educations  : [];
  obj.experiences = Array.isArray(obj.experiences) ? obj.experiences : [];
  obj.projects    = Array.isArray(obj.projects)    ? obj.projects    : [];

  // technologies: model sometimes returns {LANGUAGES:[...]} instead of [{category,items}]
  if (!Array.isArray(obj.technologies)) {
    if (obj.technologies && typeof obj.technologies === "object") {
      obj.technologies = Object.entries(obj.technologies as Record<string, unknown>).map(
        ([category, items]) => ({ category, items: Array.isArray(items) ? items : [] }),
      );
    } else {
      obj.technologies = [];
    }
  }

  // ── fill nullable sub-fields in arrays ──
  obj.educations = (obj.educations as unknown[]).map((e) => {
    if (!e || typeof e !== "object") return e;
    const ed = { ...(e as Record<string, unknown>) };
    ed.school    = ed.school    ?? null;
    ed.degree    = ed.degree    ?? null;
    ed.location  = ed.location  ?? null;
    ed.startYear = ed.startYear ?? null;
    ed.endYear   = ed.endYear   ?? null;
    return ed;
  });

  obj.experiences = (obj.experiences as unknown[]).map((e) => {
    if (!e || typeof e !== "object") return e;
    const ex = { ...(e as Record<string, unknown>) };
    ex.company   = ex.company   ?? "";
    ex.role      = ex.role      ?? "";
    ex.location  = ex.location  ?? null;
    ex.start     = ex.start     ?? null;
    ex.end       = ex.end       ?? null;
    ex.isCurrent = ex.isCurrent ?? false;
    ex.bullets   = Array.isArray(ex.bullets) ? ex.bullets : [];
    return ex;
  });

  obj.projects = (obj.projects as unknown[]).map((pr) => {
    if (!pr || typeof pr !== "object") return pr;
    const proj = { ...(pr as Record<string, unknown>) };
    proj.title     = proj.title     ?? "";
    proj.dates     = proj.dates     ?? null;
    proj.techStack = proj.techStack ?? null;
    proj.link      = proj.link      ?? null;
    proj.bullets   = Array.isArray(proj.bullets) ? proj.bullets : [];
    return proj;
  });

  return obj;
}

// ─── Batch extraction ───────────────────────────────────────────────────────
// Sends up to BATCH_LLM_SIZE resumes in a single OpenAI call.
// Returns one result per input item. extract=null means that item failed;
// the caller should fall back to individual extractCandidateProfile() calls.

export const BATCH_LLM_SIZE = 5;

export type BatchLlmItem = { rawText: string; fileName: string };
export type BatchLlmResult = { extract: CandidateProfileExtract | null; error?: string };

export async function extractCandidateProfilesBatch(
  items: BatchLlmItem[],
  orgId: string,
): Promise<BatchLlmResult[]> {
  if (!items.length) return [];
  if (!process.env.OPENAI_API_KEY) {
    return items.map(() => ({ extract: null, error: "OPENAI_API_KEY not configured" }));
  }

  const charsPerResume = Math.floor(MAX_TEXT_CHARS / items.length);
  const startTime = Date.now();

  const resumeBlocks = items
    .map((item, i) =>
      `=== RESUME ${i + 1} (${item.fileName}) ===\n${item.rawText.slice(0, charsPerResume)}`,
    )
    .join("\n\n");

  const systemPrompt = [
    "You are an expert resume parser.",
    `You will receive ${items.length} resume(s). Extract structured candidate data from each.`,
    `Return a JSON object with a "resumes" array containing EXACTLY ${items.length} object(s), one per resume in the same order.`,
    "Use EXACTLY these field names — no synonyms:",
    "personal: { fullName, email, phone, location, currentTitle, yearsOfExperience (int|null), notes (summary text), education: { school, degree, year (int|null) } | null }",
    "educations: [ { school, degree, location, startYear (int|null), endYear (int|null) } ]",
    "experiences: [ { company, role, location, start: { year (int), month (1-12) } | null, end: { year (int), month (1-12) } | null, isCurrent (bool), bullets: [string] } ]",
    "projects: [ { title, dates (string|null), techStack (string|null), link (url|null), bullets: [string] } ]",
    "technologies: [ { category (e.g. LANGUAGES, FRAMEWORKS, AI/ML, CLOUD & DEVOPS, TOOLS, DATABASES), items: [string] } ]",
    "skillsFlat: [string] — flat deduplicated list of every skill",
    "Do not guess. Use null or [] when a field is absent. Deduplicate skills.",
  ].join("\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // Allow 30 s per resume in the batch, minimum 30 s, capped at 120 s
  const batchTimeoutMs = Math.min(120000, Math.max(30000, items.length * 30000));

  try {
    const responsePromise = openai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: resumeBlocks },
      ],
      response_format: { type: "json_object" },
    });

    let batchTimeoutId: NodeJS.Timeout | null = null;
    const batchTimeoutPromise = new Promise<never>((_, reject) => {
      batchTimeoutId = setTimeout(
        () => reject(new Error(`Batch LLM timeout after ${batchTimeoutMs / 1000}s`)),
        batchTimeoutMs,
      );
    });

    const response = await Promise.race([responsePromise, batchTimeoutPromise]);
    if (batchTimeoutId) clearTimeout(batchTimeoutId);

    const outputText = response.choices[0]?.message?.content ?? "";
    const usage = response.usage;

    if (orgId && usage) {
      await trackLLMUsage({
        orgId,
        model: DEFAULT_MODEL,
        operation: "resume_parse_batch",
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost: estimateCost(DEFAULT_MODEL, usage.prompt_tokens, usage.completion_tokens),
        success: true,
        duration: Date.now() - startTime,
        metadata: { batchSize: items.length },
      }).catch(() => {});
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new Error("Batch LLM returned invalid JSON");
    }

    const resumesRaw = (parsed as Record<string, unknown>)?.resumes;
    if (!Array.isArray(resumesRaw)) {
      throw new Error("Batch LLM did not return a resumes array");
    }

    // Validate each item with Zod; return null for any that fail
    return Array.from({ length: items.length }, (_, i) => {
      const raw = resumesRaw[i];
      if (raw == null) return { extract: null, error: `Missing result for resume ${i + 1}` };
      try {
        return { extract: candidateProfileExtractSchema.parse(normalizeBatchItem(raw)) };
      } catch (err) {
        return { extract: null, error: err instanceof Error ? err.message : "Schema validation failed" };
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Batch LLM call failed", { batchSize: items.length, error: message });
    if (orgId) {
      await trackLLMUsage({
        orgId,
        model: DEFAULT_MODEL,
        operation: "resume_parse_batch",
        inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0,
        success: false,
        duration: Date.now() - startTime,
        metadata: { error: message, batchSize: items.length },
      }).catch(() => {});
    }
    return items.map(() => ({ extract: null, error: message }));
  }
}
