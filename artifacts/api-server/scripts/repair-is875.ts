import fs from "node:fs/promises";
import path from "node:path";

import { db, documentChunksTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

import { chunkText } from "../src/lib/knowledge/chunker.js";
import { createDocumentChunks } from "../src/lib/knowledge/repository.js";


const DOCUMENT_ID = "02038ff4-6356-4ac1-95d8-0a825145493f";
const OCR_DIR = "/tmp/pdf-ocr-2ZMIys/text";

async function main() {
  console.log("==============================================");
  console.log("IS 875 Part 3 - RAG chunk repair");
  console.log("==============================================");

  await fs.access(OCR_DIR);

  const files = await fs.readdir(OCR_DIR);

  const pageFiles = files
    .filter((file) => /^page-\d+\.txt$/i.test(file))
    .sort((a, b) => {
      const pageA = Number(a.match(/\d+/)?.[0] ?? 0);
      const pageB = Number(b.match(/\d+/)?.[0] ?? 0);
      return pageA - pageB;
    });

  console.log(`OCR pages found: ${pageFiles.length}`);

  if (pageFiles.length !== 69) {
    throw new Error(
      `Expected 69 OCR pages, but found ${pageFiles.length}. Aborting.`
    );
  }

  const allChunks: {
    content: string;
    pageNumber: number;
  }[] = [];

  let skippedPages = 0;

  for (const file of pageFiles) {
    const match = file.match(/^page-(\d+)\.txt$/i);

    if (!match) continue;

    const pageNumber = Number(match[1]);
    const filePath = path.join(OCR_DIR, file);
    const text = await fs.readFile(filePath, "utf8");

    if (!text.trim()) {
      skippedPages++;
      console.log(`Page ${pageNumber}: empty OCR -> skipped`);
      continue;
    }

    const chunks = await chunkText(text, pageNumber);

    console.log(
      `Page ${pageNumber}: ${text.length} chars -> ${chunks.length} chunks`
    );

    allChunks.push(...chunks);
  }

  if (!allChunks.length) {
    throw new Error("No chunks generated. Aborting.");
  }

  console.log("");
  console.log(`Generated chunks: ${allChunks.length}`);
  console.log(`Skipped empty pages: ${skippedPages}`);

  const before = await db.execute(sql`
    SELECT
      COUNT(*)::int AS chunks,
      COUNT(embedding)::int AS embeddings
    FROM document_chunks
    WHERE document_id = ${DOCUMENT_ID};
  `);

  console.log("Before:");
  console.table(before.rows);

  console.log("Deleting existing chunks...");

  await db
    .delete(documentChunksTable)
    .where(eq(documentChunksTable.documentId, DOCUMENT_ID));

  console.log("Inserting OCR chunks...");

  await createDocumentChunks(DOCUMENT_ID, allChunks);

  const inserted = await db.execute(sql`
    SELECT
      COUNT(*)::int AS chunks,
      COUNT(embedding)::int AS embeddings,
      MIN(page_number)::int AS first_page,
      MAX(page_number)::int AS last_page
    FROM document_chunks
    WHERE document_id = ${DOCUMENT_ID};
  `);

  console.log("After chunk insertion:");
  console.table(inserted.rows);

  console.log("");
  console.log("Skipping embeddings in local repair mode.");
  console.log(
    "Chunks are ready. Embeddings will be generated on Render."
  );

  const final = await db.execute(sql`
    SELECT
      COUNT(*)::int AS chunks,
      COUNT(embedding)::int AS embeddings,
      COUNT(DISTINCT page_number)::int AS pages,
      MIN(page_number)::int AS first_page,
      MAX(page_number)::int AS last_page
    FROM document_chunks
    WHERE document_id = ${DOCUMENT_ID};
  `);

  console.log("");
  console.log("==============================================");
  console.log("REPAIR COMPLETED");
  console.log("==============================================");
  console.table(final.rows);
}

main().catch((error) => {
  console.error("");
  console.error("IS 875 repair failed:");
  console.error(error);
  process.exit(1);
});
