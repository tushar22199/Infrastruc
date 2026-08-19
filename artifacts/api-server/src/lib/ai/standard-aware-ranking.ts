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
export function extractRequestedStandard(
  question: string
): string | null {
  const normalized = question
    .toUpperCase()
    .replace(/[–—-]/g, " ");

  const isMatch = normalized.match(/\bIS\s*(\d{3,5})\b/);

  if (isMatch) {
    return `IS ${isMatch[1]}`;
  }

  const ircMatch = normalized.match(/\bIRC\s*(\d{1,3})\b/);

  if (ircMatch) {
    return `IRC ${ircMatch[1]}`;
  }

  if (/\bMORTH\b/.test(normalized)) {
    return "MoRTH";
  }

  return null;
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

function applyQuestionIntentBoost(
  chunks: any[],
  question: string
) {
  const normalizedQuestion = question.toLowerCase();

  const isMinimumGradeQuestion =
    normalizedQuestion.includes("minimum grade") ||
    normalizedQuestion.includes("minimum grade of concrete");

  if (!isMinimumGradeQuestion) {
    return chunks;
  }

  for (const chunk of chunks) {
    const text = String(chunk.content ?? "").toLowerCase();

    let bonus = 0;

    // Strongest signal: the exact table containing
    // minimum concrete grades in IS 456.
    if (text.includes("table 5")) {
      bonus += 0.08;
    }

    if (text.includes("minimum grade")) {
      bonus += 0.04;
    }

    if (text.includes("grade of concrete")) {
      bonus += 0.03;
    }

    // Concrete grade notation such as M20, M25, M30...
    if (/\bm\d+\b/i.test(text)) {
      bonus += 0.02;
    }

    chunk.score += bonus;
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

  const standardRanked = applyStandardBoost(
    ranked,
    standard
  );

  return applyQuestionIntentBoost(
    standardRanked,
    question
  );
}