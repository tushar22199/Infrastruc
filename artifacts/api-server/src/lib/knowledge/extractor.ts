import fs from "fs/promises";
import pdfParse from "pdf-parse";

function normalizePdfText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export async function extractPdfText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);

  const result = await pdfParse(buffer);

  const text = normalizePdfText(result.text);

  console.log("===== PDF TEXT PREVIEW =====");
  console.log(text.slice(0, 3000));

  return text;
}