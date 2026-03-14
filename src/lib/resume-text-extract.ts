type PdfParseResult = {
  text?: string | null;
};

type PDFParseInstance = {
  getText: () => Promise<PdfParseResult>;
  destroy: () => Promise<void>;
};

type PDFParseConstructor = new (input: { data: Buffer | Uint8Array }) => PDFParseInstance;

type PdfParseRuntime = {
  PDFParse: PDFParseConstructor;
};

type MammothRuntime = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string | null }>;
};

let pdfParseModule: PdfParseRuntime | null = null;
let mammothModule: MammothRuntime | null = null;

async function getPdfParse(): Promise<PdfParseRuntime> {
  if (pdfParseModule) return pdfParseModule;
  const mod = await import("pdf-parse");
  const resolved = ((mod as any).PDFParse ? mod : (mod as any).default) as PdfParseRuntime | undefined;
  if (!resolved?.PDFParse) {
    throw new Error("pdf-parse runtime is unavailable");
  }
  pdfParseModule = resolved;
  return pdfParseModule;
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

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await getPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromFile(
  fileName: string,
  mimeType: string,
  buffer: Buffer
) {
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
