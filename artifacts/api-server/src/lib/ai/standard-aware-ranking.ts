import { rankChunks } from "./ranking";

export type StandardReference = {
  code: string;
  year?: string;
  normalized: string;
};

const STANDARD_PATTERN =
  /\bIS\s*[-:]?\s*(\d{2,5})(?:\s*:\s*(\d{4}))?\b/i;

export function detectStandard(
  question: string
): StandardReference | null {
  const match = question.match(STANDARD_PATTERN);

  if (!match) {
    return null;
  }

  const code = match[1];
  const year = match[2];

  return {
    code,
    year,
    normalized: year
      ? `IS ${code}:${year}`
      : `IS ${code}`,
  };
}

function normalizeTitle(title: unknown): string {
  return String(title ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*/g, ":")
    .trim();
}

export function applyStandardBoost(
  chunks: any[],
  standard: StandardReference | null
) {
  if (!standard) {
    return chunks;
  }

  for (const chunk of chunks) {
    const title = normalizeTitle(chunk.documentTitle);

    const numberMatches = new RegExp(
      `\\bIS\\s*[-:]?\\s*${standard.code}\\b`,
      "i"
    ).test(title);

    const yearMatches =
      !standard.year ||
      new RegExp(
        `\\bIS\\s*[-:]?\\s*${standard.code}\\s*:\\s*${standard.year}\\b`,
        "i"
      ).test(title);

    if (numberMatches && yearMatches) {
      chunk.score += 0.05;
      chunk.standardMatch = true;
    } else {
      chunk.standardMatch = false;
    }
  }

  return chunks.sort(
    (a: any, b: any) => b.score - a.score
  );
}

export function rankStandardAwareChunks(
  semanticChunks: any[],
  keywordChunks: any[],
  keywords: string[],
  phrases: string[],
  question: string
) {
  const ranked = rankChunks(
    semanticChunks,
    keywordChunks,
    keywords,
    phrases
  );

  const standard = detectStandard(question);

  return applyStandardBoost(ranked, standard);
}
