import { generateEmbedding } from "./embeddings";
import {
  getDocumentChunks,
  updateChunkEmbedding,
} from "./repository";

export async function embedDocument(documentId: string) {
  const chunks = await getDocumentChunks(documentId);

  console.log(`Embedding ${chunks.length} chunks...`);

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.content);

    await updateChunkEmbedding(chunk.id, embedding);

    console.log(
      `Embedded chunk ${chunk.chunkIndex + 1}/${chunks.length}`
    );
  }

  console.log("Document embedding complete.");
}