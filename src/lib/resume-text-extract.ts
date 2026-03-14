import path from "node:path";
import { pathToFileURL } from "node:url";

let workerConfigured = false;
type PDFParseConstructor = new (options: { data: Buffer }) => {
  getText: () => Promise<{ text?: string | null }>;
  destroy: () => Promise<void>;
};

type MammothRuntime = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string | null }>;
};

let PDFParseCtor: PDFParseConstructor | null = null;
let mammothModule: MammothRuntime | null = null;

async function getPDFParseCtor(): Promise<PDFParseConstructor> {
  if (PDFParseCtor) return PDFParseCtor;
  const mod = await import("pdf-parse");
  const resolved = ((mod as any).PDFParse ?? (mod as any).default?.PDFParse) as
    | PDFParseConstructor
    | undefined;
  if (!resolved) {
    throw new Error("pdf-parse runtime is unavailable");
  }
  PDFParseCtor = resolved;
  return PDFParseCtor;
}

async function getMammoth(): Promise<MammothRuntime> {
  if (mammothModule) return mammothModule;
  const mod = await import("mammoth");
  const resolved = ((mod as any).extractRawText ? (mod as any) : (mod as any).default) as
    | MammothRuntime
    | undefined;
  if (!resolved?.extractRawText) {
    throw new Error("mammoth runtime is unavailable");
  }
  mammothModule = resolved;
  return mammothModule;
}

async function ensurePdfWorker() {
  if (workerConfigured) return;
  try {
    const PDFParse = await getPDFParseCtor();
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs"
    );
    if (typeof (PDFParse as any).setWorker === "function") {
      (PDFParse as any).setWorker(pathToFileURL(workerPath).toString());
    }
  } catch {
    // If worker setup fails, pdf.js will fall back to fake worker.
  } finally {
    workerConfigured = true;
  }
}

export async function extractTextFromFile(
  fileName: string,
  mimeType: string,
  buffer: Buffer
) {
  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    const PDFParse = await getPDFParseCtor();
    await ensurePdfWorker();
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text ?? "";
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.toLowerCase().endsWith(".docx")
  ) {
    const mammoth = await getMammoth();
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  throw new Error("Unsupported file type");
}
