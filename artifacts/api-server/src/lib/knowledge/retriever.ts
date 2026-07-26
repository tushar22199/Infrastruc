import { generateEmbedding } from "./embeddings";
import {
  searchSimilarChunks,
  getNeighborChunks,
} from "./repository";

export async function retrieveContext(question: string) {
  const embedding = await generateEmbedding(question);

  const chunks = await searchSimilarChunks(embedding, 10);

  const seen = new Set<string>();

  const uniqueChunks = chunks.filter((chunk: any) => {
    const key = chunk.content.trim();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
  const expandedChunks: any[] = [];
  for (const chunk of uniqueChunks) {
    const neighbors = await getNeighborChunks(
      chunk.document_id as string,
      chunk.chunk_index as number,
      2
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