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
        (word) => word.length > 2 && !STOP_WORDS.has(word)
      )
    ),
  ];

  // Generate phrases from RAW words
  const phrases = new Set<string>();

  for (let i = 0; i < rawWords.length - 1; i++) {
    const phrase = `${rawWords[i]} ${rawWords[i + 1]}`;

    if (
      phrase.split(" ").some((w) => !STOP_WORDS.has(w))
    ) {
      phrases.add(phrase);
    }
  }

  for (let i = 0; i < rawWords.length - 2; i++) {
    const phrase =
      `${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]}`;

    if (
      phrase.split(" ").some((w) => !STOP_WORDS.has(w))
    ) {
      phrases.add(phrase);
    }
  }

  return {
    keywords,
    phrases: [...phrases],
  };
}
export async function retrieveContext(question: string) {
  const embedding = await generateEmbedding(question);

  const { keywords, phrases } = extractSearchTerms(question);

  const semanticChunks = await searchSimilarChunks(embedding, 5);

  
  const keywordChunks = await searchKeywordChunks(
      keywords,
      phrases,
      5
  );
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
    }))
  );
  const mergedChunks = [
    ...semanticChunks,
    ...keywordChunks,
  ];

  const seen = new Set<string>();

  const uniqueChunks = mergedChunks.filter((chunk: any) => {
    const key = chunk.content
      .replace(/\s+/g, " ")
      .trim();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
  const topChunks = uniqueChunks.slice(0, 5);
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
      expandedChunks.map((chunk: any) => [chunk.id, chunk])
    ).values()
  );
  uniqueExpanded.sort(
    (a: any, b: any) => a.chunkIndex - b.chunkIndex
  );
  return uniqueExpanded;
}
