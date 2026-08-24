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

function applyIS875PressureIntentBoost(
  chunks: any[],
  question: string
) {
  const normalized = question.toLowerCase();

  const is875 =
    normalized.includes("is 875") ||
    normalized.includes("is875");

  const asksPressure =
    normalized.includes("design wind pressure") ||
    normalized.includes("wind pressure") ||
    normalized.includes("pressure at height") ||
    normalized.includes("p_z") ||
    normalized.includes("pz") ||
    normalized.includes("pressure");

  if (!is875 || !asksPressure) {
    return chunks;
  }

  for (const chunk of chunks) {
    const text = String(chunk.content ?? "").toLowerCase();

    let bonus = 0;

    // Strongest signal: Clause 5.4 / actual pressure equation
    if (text.includes("5.4")) {
      bonus += 0.12;
    }

    if (text.includes("design wind pressure")) {
      bonus += 0.12;
    }

    if (text.includes("wind pressure")) {
      bonus += 0.08;
    }

    if (text.includes("0.6")) {
      bonus += 0.10;
    }

    if (text.includes("v_z")) {
      bonus += 0.06;
    }

    if (text.includes("vz")) {
      bonus += 0.04;
    }

    if (text.includes("p_z")) {
      bonus += 0.06;
    }

    if (text.includes("n/m")) {
      bonus += 0.03;
    }

    chunk.score += bonus;
  }

  return chunks.sort(
    (a: any, b: any) => b.score - a.score
  );
}

function applyIS875CityWindSpeedBoost(
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

  const asksCityWindSpeed =
    normalized.includes("wind speed") &&
    (
      normalized.includes("city") ||
      normalized.includes("town") ||
      normalized.includes("delhi") ||
      normalized.includes("agra") ||
      normalized.includes("mumbai") ||
      normalized.includes("bombay") ||
      normalized.includes("calcutta") ||
      normalized.includes("kolkata") ||
      normalized.includes("chennai") ||
      normalized.includes("madras") ||
      normalized.includes("bangalore") ||
      normalized.includes("hyderabad") ||
      normalized.includes("jaipur") ||
      normalized.includes("pune") ||
      normalized.includes("ahmedabad")
    );

  if (!asksCityWindSpeed) {
    return chunks;
  }

  for (const chunk of chunks) {
    const text = String(chunk.content ?? "").toLowerCase();

    let bonus = 0;

    if (text.includes("appendix a")) {
      bonus += 0.15;
    }

    if (text.includes("basic wind speed")) {
      bonus += 0.10;
    }

    if (text.includes("city/town")) {
      bonus += 0.08;
    }

    if (text.includes("city/ town")) {
      bonus += 0.08;
    }

    // Boost the specific city mentioned in the question.
    const cityNames = [
      "delhi",
      "agra",
      "ahmadabad",
      "ajmer",
      "almora",
      "amritsar",
      "asansol",
      "aurangabad",
      "bahraich",
      "bangalore",
      "barauni",
      "bareilly",
      "bhatinda",
      "bhilai",
      "bhopal",
      "bhubaneshwar",
      "bhuj",
      "bikaner",
      "bokaro",
      "bombay",
      "calcutta",
      "calicut",
      "chandigarh",
      "coimbatore",
      "cuttack",
      "darbhanga",
      "darjeeling",
      "dehra dun",
      "durgapur",
      "gangtok",
      "gauhati",
      "gaya",
      "gorakhpur",
      "hyderabad",
      "imphal",
      "jabalpur",
      "jaipur",
      "jamshedpur",
      "jhansi",
      "jodhpur",
      "kanpur",
      "kohima",
      "kurnool",
      "lucknow",
      "ludhiana",
      "madras",
      "madurai",
      "mandi",
      "mangalore",
      "moradabad",
      "mysore",
      "nagpur",
      "nainital",
      "nasik",
      "nellore",
      "panjim",
      "patiala",
      "patna",
      "pondicherry",
      "port blair",
      "pune",
      "raipur",
      "rajkot",
      "ranchi",
      "roorkee",
      "rourkela",
      "simla",
      "srinagar",
      "surat",
      "trivandrum",
      "udaipur",
      "vadodara",
      "varanasi",
      "vijaywada",
      "visakhapatnam",
    ];

    for (const city of cityNames) {
      if (normalized.includes(city) && text.includes(city)) {
        bonus += 0.20;
        break;
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

  const windSpeedRanked = applyIS875IntentBoost(
    questionRanked,
    question
  );

  const pressureRanked = applyIS875PressureIntentBoost(
    windSpeedRanked,
    question
  );

  return applyIS875CityWindSpeedBoost(
    pressureRanked,
    question
  );
}