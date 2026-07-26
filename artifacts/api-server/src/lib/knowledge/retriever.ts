import { generateEmbedding } from "./embeddings";
import {
  searchSimilarChunks,
  searchKeywordChunks,
  getNeighborChunks,
} from "./repository";

function extractKeywords(question: string) {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        ![
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
        ].includes(word)
    );
}

export async function retrieveContext(question: string) {
  const embedding = await generateEmbedding(question);

  const keywords = extractKeywords(question);

  const semanticChunks = await searchSimilarChunks(embedding, 5);

  const keywordResult = await searchKeywordChunks(keywords, 10);
  const keywordChunks = await searchKeywordChunks(keywords, 5);
  console.log("===== Keywords =====");
  console.log(keywords);

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
    const key = chunk.id;

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
