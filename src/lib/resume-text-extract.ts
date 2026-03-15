import { existsSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";

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

/**
 * pdfjs (used internally by pdf-parse) references browser DOM APIs at module
 * initialisation time even in Node.js / Vercel serverless.
 * Provide minimal stubs so the module loads without throwing.
 * Called once, right before the first pdf-parse import.
 */
function ensureDomGlobals() {
  const g = globalThis as Record<string, unknown>;

  if (!g.DOMMatrix) {
    class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true; isIdentity = true;
      constructor(_init?: string | number[]) {}
      static fromMatrix() { return new DOMMatrix(); }
      inverse() { return new DOMMatrix(); }
      multiply() { return new DOMMatrix(); }
      translate() { return new DOMMatrix(); }
      scale() { return new DOMMatrix(); }
      rotate() { return new DOMMatrix(); }
      toString() { return "matrix(1, 0, 0, 1, 0, 0)"; }
      toFloat32Array() { return new Float32Array(16); }
      toFloat64Array() { return new Float64Array(16); }
    }
    g.DOMMatrix = DOMMatrix;
  }

  if (!g.DOMPoint) {
    class DOMPoint {
      x: number; y: number; z: number; w: number;
      constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x; this.y = y; this.z = z; this.w = w;
      }
      static fromPoint() { return new DOMPoint(); }
      matrixTransform() { return new DOMPoint(); }
    }
    g.DOMPoint = DOMPoint;
  }

  if (!g.Path2D) {
    g.Path2D = class Path2D {
      constructor(_path?: unknown) {}
      addPath() {} closePath() {} moveTo() {} lineTo() {}
      bezierCurveTo() {} quadraticCurveTo() {} arc() {} arcTo() {}
      ellipse() {} rect() {}
    };
  }
}

let pdfParseReady = false;

/**
 * Returns the file:// URL for the pdfjs worker that is bundled inside
 * pdf-parse's own node_modules. We must point to THIS worker (not the
 * project-level pdfjs-dist worker) because:
 *   - pdf-parse@2.x bundles pdfjs-dist@5.4.x (compatible with Node 20+)
 *   - The project's pdfjs-dist@5.5.x requires Node 24+ (uses Promise.try)
 *
 * Falls back to the top-level pdfjs-dist worker in case npm hoisted the
 * package to the root (versions match → deduplication).
 */
function getPdfWorkerSrc(): string {
  const cwd = process.cwd();

  // Primary: pdf-parse ships its own nested pdfjs-dist (v5.4.x).
  const nested = resolve(
    cwd,
    "node_modules", "pdf-parse", "node_modules", "pdfjs-dist",
    "legacy", "build", "pdf.worker.mjs"
  );

  // Fallback: if npm deduplication hoisted pdfjs-dist to the root.
  const hoisted = resolve(
    cwd,
    "node_modules", "pdfjs-dist",
    "legacy", "build", "pdf.worker.mjs"
  );

  return pathToFileURL(existsSync(nested) ? nested : hoisted).href;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  if (!pdfParseReady) {
    ensureDomGlobals();
    pdfParseReady = true;
  }

  // pdf-parse v2 exports a PDFParse class (not the old v1 function).
  const { PDFParse } = await import("pdf-parse");
  if (typeof PDFParse !== "function") {
    throw new Error("pdf-parse runtime is unavailable");
  }

  // pdfjs v5 requires a real workerSrc file URL — an empty string causes
  // "Setting up fake worker failed". Point to pdf-parse's bundled worker.
  PDFParse.setWorker(getPdfWorkerSrc());

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
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
