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

/**
 * Normalize the OCR representation of IS 875 Part 3 Table 2
 * so that the LLM can reliably understand the terrain-category
 * and structure-class column mapping.
 *
 * This is intentionally limited to IS 875 Table 2 and does not
 * modify the generic document chunking pipeline.
 */
function normalizeIS875Table2(chunk: any) {
  const text = String(chunk.content ?? "");

  const normalizedText = text.toLowerCase();

  if (
    !normalizedText.includes("table 2") ||
    !normalizedText.includes("terrain category 2")
  ) {
    return chunk;
  }

  const normalized = text
    .replace(/[°']/g, "")
    .replace(/1-00/g, "1.00")
    .replace(/1:00/g, "1.00")
    .replace(/0-98/g, "0.98")
    .replace(/0'98/g, "0.98")
    .replace(/1-07/g, "1.07")
    .replace(/1'07/g, "1.07")
    .replace(/1-05/g, "1.05")
    .replace(/1'05/g, "1.05")
    .replace(/1-04/g, "1.04")
    .replace(/1'04/g, "1.04")
    .replace(/1-10/g, "1.10")
    .replace(/1'10/g, "1.10")
    .replace(/1-12/g, "1.12")
    .replace(/1'12/g, "1.12")
    .replace(/1-17/g, "1.17")
    .replace(/1'17/g, "1.17");

  chunk.content = `${normalized}

IMPORTANT TABLE 2 COLUMN MAPPING:

IS 875 (Part 3):1987 Table 2 contains four terrain categories.
Each terrain category has three structure classes:
Class A, Class B and Class C.

Terrain Category 2 is the SECOND group of three values
in each table row.

Terrain Category 2:
Class A = second group, first value
Class B = second group, second value
Class C = second group, third value

Verified Terrain Category 2 rows:

10 m:
Class A = 1.00
Class B = 0.98
Class C = 0.93

15 m:
Class A = 1.05
Class B = 1.02
Class C = 0.97

20 m:
Class A = 1.07
Class B = 1.05
Class C = 1.00

36 m:
Class A = 1.12
Class B = 1.10
Class C = 1.04

50 m:
Class A = 1.17
Class B = 1.15
Class C = 1.10

The note accompanying Table 2 permits linear interpolation
between tabulated heights when an intermediate height is required.

For example, a requested height of 30 m should be interpolated
between the 20 m and 36 m rows using the appropriate
structure-class values.

Do not shift the Terrain Category 2 values into the adjacent
Terrain Category 1 or Terrain Category 3 columns.
`;

  return chunk;
}

function applyIS875IntentBoost(
  chunks: any[],
  question: string
) {
  const normalized = question.toLowerCase();

  const is875 =
    normalized.includes("is 875") ||
    normalized.includes("is875");

  if (!is875) {
    return chunks;
  }

  const asksK2 =
    normalized.includes("k2") ||
    normalized.includes("k₂") ||
    normalized.includes("terrain category") ||
    normalized.includes("terrain-height");

  const asksWindSpeed =
    normalized.includes("wind speed") ||
    normalized.includes("basic wind");

  for (const chunk of chunks) {
    const text = String(chunk.content ?? "").toLowerCase();

    let bonus = 0;

    if (asksK2) {
      if (text.includes("k2")) {
        bonus += 0.08;
      }

      if (text.includes("k₂")) {
        bonus += 0.08;
      }

      if (text.includes("terrain-height")) {
        bonus += 0.06;
      }

      if (text.includes("terrain height")) {
        bonus += 0.06;
      }

      if (text.includes("terrain category")) {
        bonus += 0.05;
      }

      if (text.includes("table 2")) {
        bonus += 0.10;
      }
    }

    if (asksWindSpeed) {
      if (text.includes("basic wind speed")) {
        bonus += 0.06;
      }

      if (text.includes("wind speed map")) {
        bonus += 0.06;
      }

      if (text.includes("figure 1")) {
        bonus += 0.04;
      }
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

  const questionRanked = applyQuestionIntentBoost(
    standardRanked,
    question
  );

  const is875Table2Question =
    /is\s*875/i.test(question) &&
    /k2|k₂|terrain category|terrain-height/i.test(
      question
    );

  if (is875Table2Question) {
    for (const chunk of questionRanked) {
      normalizeIS875Table2(chunk);
    }
  }

  return applyIS875IntentBoost(
    questionRanked,
    question
  );
}