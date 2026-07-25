import { generateEmbedding } from "./embeddings";
import { searchSimilarChunks } from "./repository";

export async function retrieveContext(question: string) {
  const embedding = await generateEmbedding(question);

  return await searchSimilarChunks(embedding, 5);
}