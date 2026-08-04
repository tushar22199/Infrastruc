import { logger } from "../logger";

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
function rrf(rank: number, k = 60): number {
  return 1 / (k + rank);
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
  const scored = new Map<
    string,
    (typeof semanticChunks)[number] & {
      score: number;
      semanticRank?: number;
      keywordRank?: number;
    }
  >();
  const SEMANTIC_WEIGHT = 0.7;
  const KEYWORD_WEIGHT = 1.3;
  // Semantic ranking
  semanticChunks.forEach((chunk, index) => {
    scored.set(chunk.id as string, {
      ...chunk,
      score: rrf(index + 1) * SEMANTIC_WEIGHT,
      semanticRank: index + 1,
    });
  });

  // Keyword ranking
  keywordChunks.forEach((chunk: any, index: number) => {
    const id = chunk.id as string;

    if (scored.has(id)) {
      const existing = scored.get(id)!;

      existing.score += rrf(index + 1) * KEYWORD_WEIGHT;
      existing.keywordRank = index + 1;
    } else {
      scored.set(id, {
        ...chunk,
        score: rrf(index + 1) * KEYWORD_WEIGHT,
        keywordRank: index + 1,
      });
    }
  });

  // ----------------------------
  // Debug Logs
  // ----------------------------
  if (DEBUG_RAG) {
    logger.debug(
      {
        semanticResults: semanticChunks.map((chunk) => ({
          chunkIndex: chunk.chunk_index,
          distance: chunk.distance,
        })),
      },
      "Semantic retrieval results"
    );
  }

  if (DEBUG_RAG) {
    logger.debug(
      {
        keywordResults: keywordChunks.map((chunk: any) => ({
          chunkIndex: chunk.chunk_index,
          score: chunk.score,
        })),
      },
      "Keyword retrieval results"
    );
  }

  // ----------------------------
  // Rank by combined score
  // ----------------------------
  const rankedChunks = [...scored.values()].sort(
    (a, b) => b.score - a.score
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
  // Lexical Re-ranking
  // ----------------------------
 

  for (const chunk of rankedChunks) {
    const text = String(chunk.content).toLowerCase();

    let bonus = 0;

    // Reward chunks containing important query terms
    const IMPORTANT_TERMS = keywords
      .map((k) => k.toLowerCase())
      .filter((k) => k.length >= 3);

    for (const term of IMPORTANT_TERMS) {
      if (text.includes(term)) {
        bonus += 0.005;
      }
    }

    for (const phrase of phrases) {
      if (text.includes(phrase.toLowerCase())) {
        bonus += 0.03;
      }
    }

    // Engineering-specific boosts
    if (text.includes("table")) {
      bonus += 0.02;
    }

    if (text.includes("clause")) {
      bonus += 0.02;
    }

    if (text.includes("figure")) {
      bonus += 0.01;
    }

    if (text.includes("note")) {
      bonus += 0.01;
    }
    if (/table\s+\d+/i.test(text)) {
      bonus += 0.05;
    }

    if (/clause\s+\d+(\.\d+)*/i.test(text)) {
      bonus += 0.03;
    }

    if (/m\d+/i.test(text)) {
      bonus += 0.03;
    }

    chunk.score += bonus;
  }

  // Re-sort after applying bonuses
  rankedChunks.sort((a, b) => b.score - a.score);

  if (DEBUG_RAG) {
    logger.debug("After lexical reranking");
  }

  if (DEBUG_RAG) {
    logger.debug(
      {
        lexicalRanking: rankedChunks.slice(0, 10).map((chunk: any) => ({
          chunk: chunk.chunk_index,
          score: chunk.score.toFixed(5),
          semantic: chunk.semanticRank ?? "-",
          keyword: chunk.keywordRank ?? "-",
        })),
      },
      "After lexical reranking"
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
  const topChunks = uniqueChunks.slice(0, 8);

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
  if (DEBUG_RAG) {
    logger.debug(
      {
        topChunks: topChunks.map((chunk: any) => ({
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
      3
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
    if (a.document_id !== b.documentId) {
      return String(a.document_id).localeCompare(String(b.documentId));
    }

    return a.chunk_index - b.chunkIndex;
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