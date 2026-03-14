type MammothRuntime = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string | null }>;
};

type PdfJsTextItem = {
  str?: string;
};

type PdfJsTextMarkedContent = {
  type?: string;
};

type PdfJsPage = {
  getTextContent: () => Promise<{
    items: Array<PdfJsTextItem | PdfJsTextMarkedContent>;
  }>;
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy: () => Promise<void>;
};

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
  destroy?: () => void;
};

type PdfJsRuntime = {
  getDocument: (options: {
    data: Uint8Array;
    disableWorker: boolean;
    useWorkerFetch: boolean;
    isEvalSupported: boolean;
  }) => PdfJsLoadingTask;
};

let mammothModule: MammothRuntime | null = null;
let pdfJsModule: PdfJsRuntime | null = null;

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

async function getPdfJs(): Promise<PdfJsRuntime> {
  if (pdfJsModule) return pdfJsModule;
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const resolved = mod as unknown as PdfJsRuntime;
  if (typeof resolved?.getDocument !== "function") {
    throw new Error("pdfjs runtime is unavailable");
  }
  pdfJsModule = resolved;
  return pdfJsModule;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  let document: PdfJsDocument | null = null;
  try {
    document = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .filter(Boolean)
        .join(" ")
        .trim();

      if (text) {
        pages.push(text);
      }
    }

    return pages.join("\n\n").trim();
  } finally {
    loadingTask.destroy?.();
    if (document) {
      await document.destroy();
    }
  }
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
