import fs from "fs/promises";
import pdfParse from "pdf-parse";

function normalizePdfText(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, "\n")

    // Collapse repeated spaces/tabs
    .replace(/[ \t]+/g, " ")

    // Collapse excessive blank lines
    .replace(/\n{3,}/g, "\n\n")

    // Split camelCase only
    .replace(/([a-z])([A-Z])/g, "$1 $2")

    // ===== Engineering-specific normalization =====

    // M 20 20  -> M20
    .replace(/\bM\s+(\d{2})\s+\1\b/g, "M$1")

    // M2020 -> M20
    .replace(/\bM(\d{2})\1\b/g, "M$1")

    // Fe 500 500 -> Fe500
    .replace(/\bFe\s+(\d{3})\s+\1\b/g, "Fe$1")

    // Fe500500 -> Fe500
    .replace(/\bFe(\d{3})\1\b/g, "Fe$1")

    // Remove spaces before punctuation
    .replace(/\s+([.,;:])/g, "$1")

    .trim();
}

export async function extractPdfText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);

  const result = await pdfParse(buffer);

  const text = normalizePdfText(result.text);

  return text;
}