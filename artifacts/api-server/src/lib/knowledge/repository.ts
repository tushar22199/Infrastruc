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
  limit = 5
) {
  if (keywords.length === 0 && phrases.length === 0) {
    return [];
  }

  const phraseScore =
    phrases.length > 0
      ? sql.join(
          phrases.map((phrase) => {
            const words = phrase.split(" ");

            let weight = 25;

            if (words.length === 3) {
              weight = 100;
            } else if (words.length >= 4) {
              weight = 200;
            }

            return sql`
              CASE
                WHEN content ILIKE ${"%" + phrase + "%"}
                THEN ${weight}
                ELSE 0
              END
            `;
          }),
          sql` + `
        )
      : sql`0`;

  const keywordScore =
    keywords.length > 0
      ? sql.join(
          keywords.map(
            (word) => sql`
              CASE
                WHEN content ILIKE ${"%" + word + "%"}
                THEN 1
                ELSE 0
              END
            `
          ),
          sql` + `
        )
      : sql`0`;

  const score = sql`${phraseScore} + ${keywordScore}`;

  const conditions = sql.join(
    [
      ...phrases.map(
        (phrase) => sql`content ILIKE ${"%" + phrase + "%"}`
      ),
      ...keywords.map(
        (word) => sql`content ILIKE ${"%" + word + "%"}`
      ),
    ],
    sql` OR `
  );

  const result = await db.execute(sql`
    SELECT
      id,
      document_id,
      chunk_index,
      content,
      page_number,
      ${score} AS score
    FROM document_chunks
    WHERE ${conditions}
    ORDER BY score DESC, chunk_index ASC
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