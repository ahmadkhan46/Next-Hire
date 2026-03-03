import { PDFParse } from "pdf-parse";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mammoth from "mammoth";

let workerConfigured = false;

function ensurePdfWorker() {
  if (workerConfigured) return;
  try {
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs"
    );
    PDFParse.setWorker(pathToFileURL(workerPath).toString());
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
    ensurePdfWorker();
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
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  throw new Error("Unsupported file type");
}
