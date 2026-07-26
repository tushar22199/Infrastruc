import { and, eq, gte, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  documentsTable,
  documentChunksTable,
} from "@workspace/db";


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
export async function searchSimilarChunks(
  queryEmbedding: number[],
  limit = 5
) {
  const embedding = `[${queryEmbedding.join(",")}]`;

  const result = await db.execute(sql`
    SELECT
      id,
      document_id,
      chunk_index,
      content,
      page_number,
      embedding <=> ${embedding}::vector AS distance
    FROM document_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT ${limit};
  `);

  return result.rows;
}
export async function getNeighborChunks(
  documentId: string,
  chunkIndex: number,
  window = 2
) {
  return await db
    .select()
    .from(documentChunksTable)
    .where(
      and(
        eq(documentChunksTable.documentId, documentId),
        gte(documentChunksTable.chunkIndex, chunkIndex - window),
        lte(documentChunksTable.chunkIndex, chunkIndex + window)
      )
    )
    .orderBy(documentChunksTable.chunkIndex);
}
