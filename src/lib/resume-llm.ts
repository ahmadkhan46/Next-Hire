import OpenAI from "openai";
import { ZodError } from "zod";
import {
  candidateProfileExtractSchema,
  type CandidateProfileExtract,
} from "@/lib/resume-extract-schema";
import { estimateCost } from "@/lib/llm-cost";
import { LLMError } from "@/lib/errors";
import { trackLLMUsage } from "@/lib/llm-tracking";

const PROMPT_VERSION = "candidate-profile-v1";
const DEFAULT_MODEL = process.env.OPENAI_RESUME_MODEL ?? "gpt-4o-mini";
const MAX_TEXT_CHARS = 50000;

// Models that support structured outputs (json_schema)
const STRUCTURED_OUTPUT_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4o-2024-08-06'];

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not set - LLM resume parsing will fail");
}

if (!STRUCTURED_OUTPUT_MODELS.includes(DEFAULT_MODEL)) {
  console.warn(
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
  if (!process.env.OPENAI_API_KEY) {
    throw new LLMError("OPENAI_API_KEY not configured", "openai", DEFAULT_MODEL);
  }

  const startTime = Date.now();

  try {
    const timeoutMs =
      typeof options?.timeoutMs === "number"
        ? options.timeoutMs
        : Number(process.env.OPENAI_RESUME_TIMEOUT_MS ?? 30000);
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
      console.warn(`${errorType}, retrying with error context...`);

      const timeoutMs =
        typeof options?.timeoutMs === "number"
          ? options.timeoutMs
          : Number(process.env.OPENAI_RESUME_TIMEOUT_MS ?? 30000);
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
