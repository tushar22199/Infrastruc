import { logger } from "../logger";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  documentsTable,
  documentChunksTable,
} from "@workspace/db";

/* -------------------------------------------------------------------------- */
/*                               Document CRUD                                */
/* -------------------------------------------------------------------------- */
const DEBUG_RAG = process.env.DEBUG_RAG === "true";
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
  const result = await db.execute(sql`
    SELECT
      d.id,
      d.title,
      d.file_name,
      d.file_type,
      d.category,
      d.file_size,
      d.created_at,
      COUNT(dc.id)::int AS chunk_count
    FROM documents d
    LEFT JOIN document_chunks dc
      ON d.id = dc.document_id
    GROUP BY
      d.id,
      d.title,
      d.file_name,
      d.file_type,
      d.category,
      d.file_size,
      d.created_at
    ORDER BY d.created_at DESC;
  `);

  return result.rows;
}
export async function getDocumentById(documentId: string) {
  const result = await db.execute(sql`
    SELECT
      d.id,
      d.title,
      d.file_name,
      d.file_type,
      d.category,
      d.file_size,
      d.storage_path,
      d.created_at,
      d.updated_at,
      COUNT(dc.id)::int AS chunk_count
    FROM documents d
    LEFT JOIN document_chunks dc
      ON d.id = dc.document_id
    WHERE d.id = ${documentId}
    GROUP BY
      d.id,
      d.title,
      d.file_name,
      d.file_type,
      d.category,
      d.file_size,
      d.storage_path,
      d.created_at,
      d.updated_at;
  `);

  return result.rows[0] ?? null;
}
export async function deleteDocument(documentId: string) {
  const [deleted] = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, documentId))
    .returning();

  return deleted;
}

/* -------------------------------------------------------------------------- */
/*                              Chunk Management                              */
/* -------------------------------------------------------------------------- */

export async function createDocumentChunks(
  documentId: string,
  chunks: {
    content: string;
    pageNumber: number;
  }[]
) {
  if (!chunks.length) return;

  await db.insert(documentChunksTable).values(
    chunks.map((chunk, index) => ({
      documentId,
      chunkIndex: index,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
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
  const searchText = keywords.join(" ");

  if (!searchText.trim()) {
    return [];
  }
  logger.info(
    {
      searchText,
      keywords,
      phrases,
    },
    "FTS input"
  );
  const result = await db.execute(sql`
    SELECT
    dc.id,
    dc.document_id,
   d.title AS "documentTitle",
    dc.chunk_index,
    dc.content,
    dc.page_number,
     ts_rank(
       to_tsvector('simple', dc.content),
       websearch_to_tsquery('simple', ${searchText})
     ) AS score
  FROM document_chunks dc
  JOIN documents d
    ON dc.document_id = d.id
  WHERE
  to_tsvector('simple', dc.content)
  @@ websearch_to_tsquery('simple', ${searchText})
  ORDER BY score DESC
  LIMIT ${limit};
`);
  logger.info(
    {
      returnedRows: result.rows.length,
      firstChunk:
        result.rows.length > 0
          ? result.rows[0].chunk_index
          : null,
    },
    "FTS output"
  );
  if (DEBUG_RAG) {
    logger.debug(
      {
        searchText,
        returnedRows: result.rows.length,
      },
      "FTS search"
    );
  }

  if (DEBUG_RAG) {
    logger.debug(
      {
        results: result.rows.map((row: any) => ({
          chunk: row.chunk_index,
          score: Number(row.score).toFixed(5),
        })),
      },
      "Keyword search results"
    );
  }

 

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

  if (DEBUG_RAG) {
    logger.debug(
      {
        documentId,
        chunkIndex,
        window,
        returnedRows: result.rows.length,
      },
      "Neighbor chunk search"
    );
  }

  return result.rows;
}