import path from "node:path";
import { pathToFileURL } from "node:url";

type PDFPage = {
  getTextContent: (options?: { disableNormalization?: boolean }) => Promise<{
    items: Array<{ str?: string; hasEOL?: boolean }>;
  }>;
  cleanup: () => void;
};

type PDFDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPage>;
  destroy: () => Promise<void>;
};

type PDFJSRuntime = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (options: {
    data: Uint8Array;
    useWorkerFetch?: boolean;
    isEvalSupported?: boolean;
    useSystemFonts?: boolean;
  }) => { promise: Promise<PDFDocument>; destroy?: () => void };
};

type MammothRuntime = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string | null }>;
};

let pdfjsModule: PDFJSRuntime | null = null;
let mammothModule: MammothRuntime | null = null;

async function getPdfjs(): Promise<PDFJSRuntime> {
  if (pdfjsModule) return pdfjsModule;
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const resolved = mod as unknown as PDFJSRuntime;
  if (typeof resolved.getDocument !== "function") {
    throw new Error("pdfjs runtime is unavailable");
  }
  if (resolved.GlobalWorkerOptions) {
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs"
    );
    resolved.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
  }
  pdfjsModule = resolved;
  return pdfjsModule;
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
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
  });

  const doc = await loadingTask.promise;
  const pageTexts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      try {
        const content = await page.getTextContent({ disableNormalization: false });
        const parts: string[] = [];
        for (const item of content.items) {
          if (typeof item.str === "string" && item.str.length > 0) {
            parts.push(item.str);
          }
          if (item.hasEOL) {
            parts.push("\n");
          }
        }
        pageTexts.push(parts.join(" ").replace(/[ \t]+\n/g, "\n").trim());
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
    if (typeof loadingTask.destroy === "function") {
      loadingTask.destroy();
    }
  }

  return pageTexts.filter(Boolean).join("\n\n").trim();
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
