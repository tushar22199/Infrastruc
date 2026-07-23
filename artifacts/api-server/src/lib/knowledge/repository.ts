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
