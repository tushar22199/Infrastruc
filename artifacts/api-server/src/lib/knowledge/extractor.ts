import fs from "fs/promises";
import pdfParse from "pdf-parse";
import { normalizePdfText } from "./normalize";

export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

export async function extractPdfPages(
  filePath: string
): Promise<ExtractedPage[]> {
  const buffer = await fs.readFile(filePath);

  const parsePdf = pdfParse as any;
  const pages: ExtractedPage[] = [];

  await parsePdf(buffer, {
    pagerender: async (pageData: any) => {
      const textContent = await pageData.getTextContent();

      const text = textContent.items
        .map((item: any) => item.str)
        .join(" ");

      pages.push({
        pageNumber: pages.length + 1,
        text: normalizePdfText(text),
      });

      return text;
    },
  });

  return pages.filter((page) => page.text.trim().length > 0);
}

export async function extractPdfText(
  filePath: string
): Promise<string> {
  const pages = await extractPdfPages(filePath);

  return pages
    .map((page) => page.text)
    .join("\n");
}