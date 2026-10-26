import mammoth from "mammoth";
// Import the implementation directly: pdf-parse's index.js runs a debug routine on load.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const MIN_TEXT = 100;

export async function extractPdf(buffer) {
  const pages = [];
  const { text } = await pdfParse(buffer, {
    pagerender: async (page) => {
      const content = await page.getTextContent();
      // Keep line breaks (a y-coordinate change) — the chunker's heading patterns are line-anchored.
      let lastY;
      let pageText = "";
      for (const item of content.items) {
        const y = item.transform[5];
        if (lastY !== undefined && y !== lastY) pageText += "\n";
        pageText += item.str;
        lastY = y;
      }
      pages.push(pageText);
      return pageText;
    },
  });
  const rawText = pages.length ? pages.map((p) => p.trim()).join("\n\n") : text;
  if (rawText.trim().length < MIN_TEXT) {
    throw new Error(
      "Could not extract readable text from this PDF. The file may be a scanned image without OCR data.",
    );
  }
  return rawText;
}

export async function extractDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  const rawText = value.trim();
  if (rawText.length < MIN_TEXT) {
    throw new Error("DOCX file appears to be empty or contains no readable text.");
  }
  return rawText;
}

export async function extractDocument(buffer, filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return extractPdf(buffer);
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return extractDocx(buffer);
  throw new Error(`Unsupported file type: ${filename}. Only PDF and DOCX are supported.`);
}

const MAGIC = [Buffer.from("%PDF"), Buffer.from([0x50, 0x4b, 0x03, 0x04])];

export const hasValidMagic = (buffer) => MAGIC.some((m) => buffer.subarray(0, m.length).equals(m));
