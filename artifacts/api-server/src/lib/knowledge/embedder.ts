import { logger } from "../logger";
import { generateEmbedding } from "./embeddings";
import {
  getDocumentChunks,
  updateChunkEmbedding,
} from "./repository";

export async function embedDocument(documentId: string) {
  const chunks = await getDocumentChunks(documentId);
  logger.info(
    {
      chunkCount: chunks.length,
      documentId,
    },
    "Starting document embedding"
  );
  

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.content);

    await updateChunkEmbedding(chunk.id, embedding);

    
  }
  logger.info(
    { documentId },
    "Document embedding completed"
  );
  
}