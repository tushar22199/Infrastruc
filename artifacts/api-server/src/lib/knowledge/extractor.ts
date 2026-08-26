import { normalizeIS875AppendixA } from "./is875-appendix-a";
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

  const filteredPages = pages.filter(
    (page) => page.text.trim().length > 0
  );
  console.log(
    filteredPages
      .filter((page) =>
        /appendix|delhi|wind speed|basic wind/i.test(page.text)
      )
      .map((page) => ({
        page: page.pageNumber,
        text: page.text.slice(0, 2000),
      }))
  );
  return normalizeIS875AppendixA(filteredPages);
}

export async function extractPdfText(
  filePath: string
): Promise<string> {
  const pages = await extractPdfPages(filePath);

  return pages
    .map((page) => page.text)
    .join("\n");
}