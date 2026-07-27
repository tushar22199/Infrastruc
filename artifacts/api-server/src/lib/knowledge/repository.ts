import { and, eq, gte, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  documentsTable,
  documentChunksTable,
} from "@workspace/db";

/* -------------------------------------------------------------------------- */
/*                               Document CRUD                                */
/* -------------------------------------------------------------------------- */

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
  return db.select().from(documentsTable);
}

/* -------------------------------------------------------------------------- */
/*                              Chunk Management                              */
/* -------------------------------------------------------------------------- */

export async function createDocumentChunks(
  documentId: string,
  chunks: string[]
) {
  if (!chunks.length) return;

  await db.insert(documentChunksTable).values(
    chunks.map((chunk, index) => ({
      documentId,
      chunkIndex: index,
      content: chunk,
      pageNumber: null,
    }))
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
  embedding: number[]
) {
  await db
    .update(documentChunksTable)
    .set({
      embedding,
    })
    .where(eq(documentChunksTable.id, chunkId));
}

/* -------------------------------------------------------------------------- */
/*                            Semantic Vector Search                          */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                              Keyword Search                                */
/* -------------------------------------------------------------------------- */

export async function searchKeywordChunks(
  keywords: string[],
  phrases: string[],
  limit = 20
) {
  const searchText = [...phrases, ...keywords]
    .filter(Boolean)
    .join(" ");

  if (!searchText.trim()) {
    return [];
  }

  console.log("\n===== FTS Query =====");
  console.log(searchText);

  const result = await db.execute(sql`
    SELECT
      id,
      document_id,
      chunk_index,
      content,
      page_number,
      ts_rank(
        to_tsvector('english', content),
        plainto_tsquery('english', ${searchText})
      ) AS score
    FROM document_chunks
    WHERE
      to_tsvector('english', content)
      @@ plainto_tsquery('english', ${searchText})
    ORDER BY score DESC
    LIMIT ${limit};
  `);

  return result.rows;
}

/* -------------------------------------------------------------------------- */
/*                           Neighbor Chunk Expansion                         */
/* -------------------------------------------------------------------------- */

export async function getNeighborChunks(
  documentId: string,
  chunkIndex: number,
  window = 2
) {
  return db
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