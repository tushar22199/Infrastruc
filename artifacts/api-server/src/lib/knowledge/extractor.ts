import fs from "fs/promises";
import pdfParse from "pdf-parse";

export async function extractPdfText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);

  const result = await pdfParse(buffer);

  return result.text;
}