import { generateEmbedding } from "./embeddings";
import { searchSimilarChunks } from "./repository";

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

  return uniqueChunks.slice(0, 5);
}