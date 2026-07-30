import fs from "fs/promises";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

function normalizePdfText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export async function extractPdfText(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(data),
  });

  const pdf = await loadingTask.promise;

  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    const content = await page.getTextContent();

    const text = content.items
      .map((item: any) => item.str)
      .join(" ");

    pages.push(text);
  }
  console.log("===== Extracted Text Preview =====");
  console.log(pages.join("\n\n").slice(0, 3000));
  return normalizePdfText(pages.join("\n\n"));
}