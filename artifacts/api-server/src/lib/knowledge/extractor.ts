import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { normalizePdfText } from "./normalize";
import { normalizeIS875AppendixA } from "./is875-appendix-a";

const execFileAsync = promisify(execFile);

export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

async function getPdfPageCount(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("pdfinfo", [filePath]);

  const match = stdout.match(/^Pages:\s+(\d+)/m);

  if (!match) {
    throw new Error("Could not determine PDF page count");
  }

  return Number(match[1]);
}

async function extractTextPages(
  filePath: string,
): Promise<Map<number, string>> {
  const { stdout } = await execFileAsync(
    "pdftotext",
    ["-layout", filePath, "-"],
    {
      maxBuffer: 50 * 1024 * 1024,
    },
  );

  const pages = stdout.split("\f");
  const result = new Map<number, string>();

  pages.forEach((text, index) => {
    const normalized = normalizePdfText(text);

    if (normalized.trim().length > 0) {
      result.set(index + 1, normalized);
    }
  });

  return result;
}

export async function ocrPdfPage(
  filePath: string,
  pageNumber: number,
): Promise<string> {
  const tempDir = `/tmp/is875-${process.pid}-${pageNumber}`;

  await fs.mkdir(tempDir, { recursive: true });

  try {
    await execFileAsync("pdftoppm", [
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      "-jpeg",
      "-jpegopt",
      "quality=85",
      "-scale-to",
      "1800",
      filePath,
      `${tempDir}/page`,
    ]);

    const files = await fs.readdir(tempDir);

    const imageFile = files.find((file) =>
      /\.(jpg|jpeg)$/i.test(file),
    );

    if (!imageFile) {
      throw new Error(
        `pdftoppm produced no image for PDF page ${pageNumber}. Files: ${files.join(", ")}`,
      );
    }

    const imagePath = `${tempDir}/${imageFile}`;

    const { stdout } = await execFileAsync(
      "tesseract",
      [imagePath, "stdout"],
      {
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    return normalizePdfText(stdout);
  } finally {
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}
export async function extractIS875AppendixPages(
  filePath: string,
): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];

  // IS 875 (Part 3):1987 Appendix A starts on PDF page 62.
  // Appendices continue through page 69.
  for (let pageNumber = 62; pageNumber <= 69; pageNumber++) {
    const text = await ocrPdfPage(filePath, pageNumber);

    if (text.trim().length > 0) {
      pages.push({
        pageNumber,
        text,
      });
    }
  }

  return normalizeIS875AppendixA(pages);
}

export async function extractPdfPages(
  filePath: string,
): Promise<ExtractedPage[]> {
  const pageCount = await getPdfPageCount(filePath);
  const extractedText = await extractTextPages(filePath);

  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    let text = extractedText.get(pageNumber) ?? "";

    // OCR only pages where normal text extraction produced
    // little or no useful text.
    if (text.trim().length < 50) {
      text = await ocrPdfPage(filePath, pageNumber);
    }

    if (text.trim().length > 0) {
      pages.push({
        pageNumber,
        text,
      });
    }
  }

  return normalizeIS875AppendixA(pages);
}

export async function extractPdfText(
  filePath: string,
): Promise<string> {
  const pages = await extractPdfPages(filePath);

  return pages
    .map((page) => page.text)
    .join("\n");
}
export async function debugOcrPdfPage(
  filePath: string,
  pageNumber: number,
): Promise<string> {
  return ocrPdfPage(filePath, pageNumber);
}
