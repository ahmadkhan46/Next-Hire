type MammothRuntime = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string | null }>;
};

let mammothModule: MammothRuntime | null = null;

async function getMammoth(): Promise<MammothRuntime> {
  if (mammothModule) return mammothModule;
  const mod = await import("mammoth");
  const resolved = ((mod as any).extractRawText ? mod : (mod as any).default) as
    | MammothRuntime
    | undefined;
  if (!resolved?.extractRawText) {
    throw new Error("mammoth runtime is unavailable");
  }
  mammothModule = resolved;
  return mammothModule;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse ships its own bundled pdfjs v2 — no Web Worker, no DOM APIs,
  // works in Node.js / Vercel serverless out of the box.
  const mod = await import("pdf-parse");
  const parse = (mod as any).default ?? mod;
  if (typeof parse !== "function") {
    throw new Error("pdf-parse runtime is unavailable");
  }
  const result = await parse(buffer);
  return (result.text ?? "").trim();
}

export async function extractTextFromFile(fileName: string, mimeType: string, buffer: Buffer) {
  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    return extractTextFromPdf(buffer);
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
