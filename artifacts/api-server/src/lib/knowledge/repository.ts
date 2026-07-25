import { inArray } from "drizzle-orm";
import {
  db,
  documentsTable,
  documentChunksTable,
} from "@workspace/db";

import { eq } from "drizzle-orm";
export async function createDocument(
  document: typeof documentsTable.$inferInsert
) {
  const [created] = await db
    .insert(documentsTable)
    .values(document)
    .returning();

  return created;
}
export async function listDocuments() {
  return db
    .select()
    .from(documentsTable);
}
export async function createDocumentChunks(
  documentId: string,
  chunks: string[],
) {
  if (chunks.length === 0) return;

  await db.insert(documentChunksTable).values(
    chunks.map((chunk, index) => ({
      documentId,
      chunkIndex: index,
      content: chunk,
      pageNumber: null,
    })),
  );
}
export async function getDocumentChunks(documentId: string) {
  return db
    .select()
    .from(documentChunksTable)
    .where(eq(documentChunksTable.documentId, documentId))
    .orderBy(documentChunksTable.chunkIndex);
}
export async function updateChunkEmbedding(
  chunkId: string,
  embedding: number[],
) {
  await db
    .update(documentChunksTable)
    .set({
      embedding,
    })
    .where(eq(documentChunksTable.id, chunkId));
}
