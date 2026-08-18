import { logger } from "../logger";
import { rankChunks } from "../ai/ranking";
const DEBUG_RAG = process.env.DEBUG_RAG === "true";
import { generateEmbedding } from "./embeddings";
import {
  searchSimilarChunks,
  searchKeywordChunks,
  getNeighborChunks,
} from "./repository";

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

  // Keywords (remove stop words)
  const keywords = [
    ...new Set(
      rawWords.filter(
        (word) =>
          word.length > 2 &&
          !STOP_WORDS.has(word) &&
          !/^\d+$/.test(word) // Remove pure numbers
      )
    ),
  ];

  // Generate phrases from RAW words
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

    // Reject phrases that start with a stop word
    if (PHRASE_STOP_WORDS.has(words[0])) {
      return false;
    }

    // Reject phrases made only of numbers
    if (words.every((w) => /^\d+$/.test(w))) {
      return false;
    }

    // Keep phrases with at least two non-stop-word terms
    const meaningfulWords = words.filter(
      (w) =>
        !PHRASE_STOP_WORDS.has(w) &&
        !/^\d+$/.test(w)
    );

    return meaningfulWords.length >= 2;
  });
  if (DEBUG_RAG) {
    logger.debug({ keywords }, "Extracted keywords");
  }

  if (DEBUG_RAG) {
    logger.debug({ phrases }, "Extracted phrases");
  }
  return {
    keywords,
    phrases,
  };
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
  // Hybrid Scoring (RRF)
  // ----------------------------
  const rankedChunks = rankChunks(
    semanticChunks,
    keywordChunks,
    keywords,
    phrases
  );
  if (DEBUG_RAG) {
    logger.debug(
      {
        ranking: rankedChunks.slice(0, 10).map((chunk: any, index: number) => ({
          rank: index + 1,
          chunkIndex: chunk.chunk_index,
          score: chunk.score,
        })),
      },
      "RRF ranking"
    );
  }
  // ----------------------------
  // Remove duplicate chunks
  // ----------------------------
  const seen = new Set<string>();

  const uniqueChunks = rankedChunks.filter((chunk: any) => {
    const key = chunk.content
      .replace(/\s+/g, " ")
      .trim();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  // Top chunks
  const topChunks = uniqueChunks.slice(0, 4  );

  if (DEBUG_RAG) {
    logger.debug(
      {
        topChunks: topChunks.map(chunk => ({
          chunkIndex: chunk.chunk_index,
          score: chunk.score,
        })),
      },
      "Top retrieved chunks"
    );
  }

  // ----------------------------
  // Neighbor Expansion
  // ----------------------------
  const expandedChunks: any[] = [];

  for (const chunk of topChunks) {
    const neighbors = await getNeighborChunks(
      chunk.document_id as string,
      chunk.chunk_index as number,
      1
    );

    expandedChunks.push(...neighbors);
  }

  const uniqueExpanded = Array.from(
    new Map(
      expandedChunks.map((chunk: any) => [
        `${chunk.document_id}:${chunk.chunk_index}`,
        chunk,
      ])
    ).values()
  );

  uniqueExpanded.sort((a: any, b: any) => {
    if (a.document_id !== b.document_id) {
      return String(a.document_id).localeCompare(
        String(b.document_id)
      );
    }

    return a.chunk_index - b.chunk_index;
  });


  

  if (DEBUG_RAG) {
    logger.debug(
      {
        expandedChunks: uniqueExpanded.map((chunk: any) => ({
          chunkIndex: chunk.chunk_index,
        })),
      },
      "Expanded neighbor chunks"
    );
  }

  const MAX_CONTEXT_CHARS = 12000;

  let totalChars = 0;
 
  const finalContext = [];

  for (const chunk of uniqueExpanded) {
    if (totalChars + chunk.content.length > MAX_CONTEXT_CHARS) {
      break;
    }

    finalContext.push(chunk);
    totalChars += chunk.content.length;
  }
  if (DEBUG_RAG) {
    logger.debug(
      {
        finalChunkCount: finalContext.length,
        totalChars,
      },
      "Final RAG context"
    );
  }


  return finalContext;
}