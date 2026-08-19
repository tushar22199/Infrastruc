import { rankStandardAwareChunks } from "../ai/standard-aware-ranking";
import { logger } from "../logger";
import { generateEmbedding } from "./embeddings";
import {
  searchSimilarChunks,
  searchKeywordChunks,
  getNeighborChunks,
} from "./repository";

const DEBUG_RAG = process.env.DEBUG_RAG === "true";

const STOP_WORDS = new Set([
  "what",
  "which",
  "where",
  "when",
  "according",
  "about",
  "their",
  "there",
  "with",
  "from",
  "have",
  "does",
  "into",
  "this",
  "that",
  "shall",
  "would",
  "could",
  "should",
  "the",
  "and",
  "for",
  "are",
  "was",
  "were",
  "who",
  "why",
  "how",
  "is",
  "to",
  "in",
  "on",
  "at",
  "by",
]);

export function extractSearchTerms(question: string) {
  const rawWords = question
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const keywords = [
    ...new Set(
      rawWords.filter(
        (word) =>
          word.length > 2 &&
          !STOP_WORDS.has(word) &&
          !/^\d+$/.test(word)
      )
    ),
  ];

  const rawPhrases = new Set<string>();

  // 2-word phrases
  for (let i = 0; i < rawWords.length - 1; i++) {
    rawPhrases.add(`${rawWords[i]} ${rawWords[i + 1]}`);
  }

  // 3-word phrases
  for (let i = 0; i < rawWords.length - 2; i++) {
    rawPhrases.add(
      `${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]}`
    );
  }

  const PHRASE_STOP_WORDS = new Set([
    "what",
    "which",
    "where",
    "when",
    "why",
    "how",
    "the",
    "is",
    "are",
    "was",
    "were",
    "to",
    "according",
  ]);

  const phrases = [...rawPhrases].filter((phrase) => {
    const words = phrase.split(" ");

    if (PHRASE_STOP_WORDS.has(words[0])) {
      return false;
    }

    if (words.every((word) => /^\d+$/.test(word))) {
      return false;
    }

    const meaningfulWords = words.filter(
      (word) =>
        !PHRASE_STOP_WORDS.has(word) &&
        !/^\d+$/.test(word)
    );

    return meaningfulWords.length >= 2;
  });

  if (DEBUG_RAG) {
    logger.debug({ keywords }, "Extracted keywords");
    logger.debug({ phrases }, "Extracted phrases");
  }

  return {
    keywords,
    phrases,
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

export async function retrieveContext(question: string) {
  const embedding = await generateEmbedding(question);

  const { keywords, phrases } = extractSearchTerms(question);

  const semanticChunks = await searchSimilarChunks(
    embedding,
    40
  );

  const keywordChunks = await searchKeywordChunks(
    keywords,
    phrases,
    40
  );

  // ----------------------------
  // Standard-aware hybrid ranking
  // ----------------------------

  const rankedChunks = rankStandardAwareChunks(
    semanticChunks,
    keywordChunks,
    keywords,
    phrases,
    question
  );

  if (DEBUG_RAG) {
    logger.debug(
      {
        ranking: rankedChunks.slice(0, 10).map(
          (chunk: any, index: number) => ({
            rank: index + 1,
            id: chunk.id,
            document: chunk.documentTitle,
            chunkIndex: chunk.chunk_index,
            page: chunk.page_number,
            score: chunk.score,
            standardMatch: chunk.standardMatch,
          })
        ),
      },
      "Standard-aware RAG ranking"
    );
  }

  // ----------------------------
  // Remove duplicate chunks
  // ----------------------------

  const seen = new Set<string>();

  const uniqueChunks = rankedChunks.filter((chunk: any) => {
    const key = String(chunk.content ?? "")
      .replace(/\s+/g, " ")
      .trim();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  // ----------------------------
  // Select top ranked chunks
  // ----------------------------

  const topChunks = uniqueChunks.slice(0, 4);

  if (DEBUG_RAG) {
    logger.debug(
      {
        topChunks: topChunks.map(
          (chunk: any, index: number) => ({
            rank: index + 1,
            id: chunk.id,
            chunkIndex: chunk.chunk_index,
            page: chunk.page_number,
            score: chunk.score,
            standardMatch: chunk.standardMatch,
          })
        ),
      },
      "Top retrieved chunks"
    );
  }

  // ----------------------------
  // Neighbor Expansion
  // ----------------------------

  const expandedChunks: any[] = [];

  for (const chunk of topChunks) {
    // Keep the original ranked chunk.
    expandedChunks.push(chunk);

    const neighbors = await getNeighborChunks(
      chunk.document_id as string,
      chunk.chunk_index as number,
      1
    );

    for (const neighbor of neighbors) {
      expandedChunks.push({
        ...neighbor,
        parentScore: chunk.score,
        parentChunkIndex: chunk.chunk_index,
      });
    }
  }

  // ----------------------------
  // Remove duplicate expanded chunks
  // ----------------------------

  const uniqueExpanded = Array.from(
    new Map(
      expandedChunks.map((chunk: any) => [
        `${chunk.document_id}:${chunk.chunk_index}`,
        chunk,
      ])
    ).values()
  );

  // ----------------------------
  // Rank expanded context
  // ----------------------------

  uniqueExpanded.sort((a: any, b: any) => {
    const scoreA =
      typeof a.score === "number"
        ? a.score
        : typeof a.parentScore === "number"
          ? a.parentScore - 0.001
          : 0;

    const scoreB =
      typeof b.score === "number"
        ? b.score
        : typeof b.parentScore === "number"
          ? b.parentScore - 0.001
          : 0;

    return scoreB - scoreA;
  });

  if (DEBUG_RAG) {
    logger.debug(
      {
        expandedChunks: uniqueExpanded.map(
          (chunk: any) => ({
            chunkIndex: chunk.chunk_index,
            score: chunk.score,
            parentScore: chunk.parentScore,
            parentChunkIndex: chunk.parentChunkIndex,
          })
        ),
      },
      "Expanded neighbor chunks"
    );
  }

  // ----------------------------
  // Build final context
  // ----------------------------

  const MAX_CONTEXT_CHARS = 12000;

  let totalChars = 0;
  const finalContext: any[] = [];

  for (const chunk of uniqueExpanded) {
    const contentLength = String(
      chunk.content ?? ""
    ).length;

    if (totalChars + contentLength > MAX_CONTEXT_CHARS) {
      continue;
    }

    finalContext.push(chunk);
    totalChars += contentLength;
  }

  if (DEBUG_RAG) {
    logger.debug(
      {
        finalChunkCount: finalContext.length,
        totalChars,
        finalRanking: finalContext.map(
          (chunk: any, index: number) => ({
            rank: index + 1,
            chunkIndex: chunk.chunk_index,
            page: chunk.page_number,
            score: chunk.score,
            parentScore: chunk.parentScore,
          })
        ),
      },
      "Final RAG context"
    );
  }

  return finalContext;
}