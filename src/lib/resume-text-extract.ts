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

/**
 * pdfjs-dist v5 references browser DOM APIs (DOMMatrix, DOMPoint, Path2D)
 * even when running in Node.js text-extraction mode.
 * Provide minimal stubs so the module initialises without throwing.
 */
function ensureDomGlobals() {
  const g = globalThis as Record<string, unknown>;

  if (!g.DOMMatrix) {
    g.DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true; isIdentity = true;
      constructor(_init?: string | number[]) {}
      static fromMatrix() { return new (g.DOMMatrix as new () => object)(); }
      inverse() { return new (g.DOMMatrix as new () => object)(); }
      multiply() { return new (g.DOMMatrix as new () => object)(); }
      translate() { return new (g.DOMMatrix as new () => object)(); }
      scale() { return new (g.DOMMatrix as new () => object)(); }
      rotate() { return new (g.DOMMatrix as new () => object)(); }
      toString() { return "matrix(1, 0, 0, 1, 0, 0)"; }
      toFloat32Array() { return new Float32Array(16); }
      toFloat64Array() { return new Float64Array(16); }
    };
  }

  if (!g.DOMPoint) {
    g.DOMPoint = class DOMPoint {
      x: number; y: number; z: number; w: number;
      constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x; this.y = y; this.z = z; this.w = w;
      }
      static fromPoint() { return new (g.DOMPoint as new () => object)(); }
      matrixTransform() { return new (g.DOMPoint as new () => object)(); }
    };
  }

  if (!g.Path2D) {
    g.Path2D = class Path2D {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_path?: unknown) {}
      addPath() {} closePath() {} moveTo() {} lineTo() {}
      bezierCurveTo() {} quadraticCurveTo() {} arc() {} arcTo() {}
      ellipse() {} rect() {}
    };
  }
}

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
  ensureDomGlobals();
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
