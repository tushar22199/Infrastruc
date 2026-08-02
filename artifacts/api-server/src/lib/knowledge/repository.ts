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
    dc.id,
    dc.document_id,
    d.title AS "documentTitle",
    dc.chunk_index,
    dc.content,
    dc.page_number,
    dc.embedding <=> ${embedding}::vector AS distance
  FROM document_chunks dc
  JOIN documents d
    ON dc.document_id = d.id
  WHERE dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> ${embedding}::vector
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
  const searchText = [
    ...phrases.slice(0, 3).map((p) => `"${p}"`),
    ...keywords,
  ].join(" ");

  if (!searchText.trim()) {
    return [];
  }
  const result = await db.execute(sql`
    SELECT
    dc.id,
    dc.document_id,
   d.title AS "documentTitle",
    dc.chunk_index,
    dc.content,
    dc.page_number,
    ts_rank(
      to_tsvector('english', dc.content),
      websearch_to_tsquery('english', ${searchText})
    ) AS score
  FROM document_chunks dc
  JOIN documents d
    ON dc.document_id = d.id
  WHERE
    to_tsvector('english', dc.content)
    @@ websearch_to_tsquery('english', ${searchText})
  ORDER BY score DESC
  LIMIT ${limit};
`);
  console.log("\n===== FTS Query =====");
  console.log(searchText);
  console.log(`Returned ${result.rows.length} rows`);

  console.table(
    result.rows.map((row: any) => ({
      chunk: row.chunk_index,
      score: Number(row.score).toFixed(5),
      preview: row.content.substring(0, 80).replace(/\n/g, " "),
    }))
  );

 

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
  const result = await db.execute(sql`
    SELECT
      dc.id,
      dc.document_id,
      d.title AS "documentTitle",
      dc.chunk_index,
      dc.page_number,
      dc.content
    FROM document_chunks dc
    JOIN documents d
      ON dc.document_id = d.id
    WHERE
      dc.document_id = ${documentId}
      AND dc.chunk_index >= ${chunkIndex - window}
      AND dc.chunk_index <= ${chunkIndex + window}
    ORDER BY dc.chunk_index;
  `);

  console.log(
    `Neighbors for chunk ${chunkIndex}:`,
    result.rows.map((r: any) => r.chunk_index)
  );

  return result.rows;
}