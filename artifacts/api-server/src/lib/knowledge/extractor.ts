import fs from "fs/promises";
import pdfParse from "pdf-parse";
import { normalizePdfText } from "./normalize";


export async function extractPdfText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);

  const result = await pdfParse(buffer);

  const text = normalizePdfText(result.text);

  return text;
}