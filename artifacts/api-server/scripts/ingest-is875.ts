import fs from "node:fs/promises";
import path from "node:path";
import {
  chunkText,
  type DocumentChunk,
} from "../src/lib/knowledge/chunker";
import { db, documentsTable } from "@workspace/db";

import {
  createDocument,
  createDocumentChunks,
} from "../src/lib/knowledge/repository";
import { embedDocument } from "../src/lib/knowledge/embedder";
const OCR_DIR = "/tmp/pdf-ocr-2ZMIys/text";

const TITLE = "IS 875 Part 3";
const FILE_NAME = "IS 875 Part 3.pdf";
const FILE_TYPE = "application/pdf";
const CATEGORY = "Standard";

async function main() {
  const uploadedBy = process.argv[2];

  if (!uploadedBy) {
    console.error("Usage: pnpm exec tsx scripts/ingest-is875.ts <USER_ID>");
    process.exit(1);
  }

  console.log("Starting IS 875 Part 3 ingestion...");
  console.log(`OCR directory: ${OCR_DIR}`);
  console.log(`Uploaded by: ${uploadedBy}`);

  try {
    await fs.access(OCR_DIR);
  } catch {
    throw new Error(`OCR directory does not exist: ${OCR_DIR}`);
  }

  const files = await fs.readdir(OCR_DIR);

  const pageFiles = files
    .filter((file) => /^page-\\d+\\.txt$/i.test(file))
    .sort((a, b) => {
      const pageA = Number(a.match(/\\d+/)?.[0] ?? 0);
      const pageB = Number(b.match(/\\d+/)?.[0] ?? 0);
      return pageA - pageB;
    });

  if (!pageFiles.length) {
    throw new Error(`No OCR page files found in ${OCR_DIR}`);
  }

  console.log(`Found ${pageFiles.length} OCR pages.`);

  const existing = await db
    .select({
      id: documentsTable.id,
      title: documentsTable.title,
    })
    .from(documentsTable);

  const duplicate = existing.find(
    (document) =>
      document.title.trim().toLowerCase() === TITLE.toLowerCase()
  );

  if (duplicate) {
    throw new Error(
      `A document titled "${TITLE}" already exists (${duplicate.id}). ` +
        "Delete it first if you intentionally want to re-ingest it."
    );
  }

  const allChunks: DocumentChunk[] = [];
  for (const file of pageFiles) {
    const match = file.match(/^page-(\\d+)\\.txt$/i);
    if (!match) continue;

    const pageNumber = Number(match[1]);
    const filePath = path.join(OCR_DIR, file);
    const text = await fs.readFile(filePath, "utf8");

    if (!text.trim()) {
      console.warn(`Page ${pageNumber}: empty OCR text, skipping.`);
      continue;
    }

    const chunks = await chunkText(text, pageNumber);

    console.log(
      `Page ${pageNumber}: ${text.length} chars -> ${chunks.length} chunks`
    );

    allChunks.push(...chunks);
  }

  if (!allChunks.length) {
    throw new Error("No chunks were generated from the OCR text.");
  }

  console.log(`Total chunks generated: ${allChunks.length}`);

  const document = await createDocument({
    title: TITLE,
    fileName: FILE_NAME,
    fileType: FILE_TYPE,
    category: CATEGORY,
    uploadedBy,
    fileSize: 0,
    storagePath: "ocr://pdf-ocr-2ZMIys",
  });

  console.log(`Created document: ${document.id}`);

  await createDocumentChunks(document.id, allChunks);

  console.log(
    `Inserted ${allChunks.length} chunks for document ${document.id}`
  );

  console.log("Starting embeddings...");

  await embedDocument(document.id);

  console.log("");
  console.log("==============================================");
  console.log("IS 875 Part 3 ingestion completed successfully");
  console.log("==============================================");
  console.log(`Document ID: ${document.id}`);
  console.log(`Pages: ${pageFiles.length}`);
  console.log(`Chunks: ${allChunks.length}`);
}

main().catch((error) => {
  console.error("");
  console.error("IS 875 ingestion failed:");
  console.error(error);
  process.exit(1);
});
