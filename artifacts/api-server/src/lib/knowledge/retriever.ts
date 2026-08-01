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
  console.log("\n===== Keywords =====");
  console.log(keywords);

  console.log("===== Phrases =====");
  console.log(phrases);
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
  console.log("===== Keywords =====");
  console.log(keywords);

  console.log("===== Phrases =====");
  console.log(phrases);

  console.log("===== Semantic Results =====");
  console.log(
    semanticChunks.map((chunk: any) => ({
      chunkIndex: chunk.chunk_index,
      distance: chunk.distance,
    }))
  );

  console.log("===== Keyword Results =====");
  console.log(
    keywordChunks.map((chunk: any) => ({
      chunkIndex: chunk.chunk_index,
      keywordScore: chunk.score,
    }))
  );

  // ----------------------------
  // Rank by combined score
  // ----------------------------
  const rankedChunks = [...scored.values()].sort(
    (a, b) => b.score - a.score
  );
  console.log("\n===== RRF Ranking =====");

  rankedChunks.slice(0, 10).forEach((chunk: any, index: number) => {
    console.log({
      rank: index + 1,
      chunkIndex: chunk.chunk_index,
      score: chunk.score.toFixed(5),
      semanticRank: chunk.semanticRank ?? "-",
      keywordRank: chunk.keywordRank ?? "-",
    });
  });
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

  console.log("\n===== After Lexical Re-ranking =====");

  console.table(
    rankedChunks.slice(0, 10).map((chunk: any) => ({
      chunk: chunk.chunk_index,
      score: chunk.score.toFixed(5),
      semantic: chunk.semanticRank ?? "-",
      keyword: chunk.keywordRank ?? "-",
      preview: chunk.content.substring(0, 80).replace(/\n/g, " "),
    }))
  );

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

  console.log("===== Top Chunks =====");
  console.log(
    topChunks.map((chunk: any) => ({
      chunkIndex: chunk.chunk_index,
      score: chunk.score,
    }))
  );

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
        `${chunk.documentId}:${chunk.chunkIndex}`,
        chunk,
      ])
    ).values()
  );

  uniqueExpanded.sort((a: any, b: any) => {
    if (a.documentId !== b.documentId) {
      return String(a.documentId).localeCompare(String(b.documentId));
    }

    return a.chunkIndex - b.chunkIndex;
  });

  console.log("===== Final Context =====");
  

  
  console.log(
    uniqueExpanded.map((chunk: any) => ({
      chunkIndex: chunk.chunkIndex,
    }))
  );

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
  console.log("Final chunks:", finalContext.length);
  console.log("Total chars:", totalChars);


  return finalContext;
}