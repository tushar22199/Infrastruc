import fs from "fs/promises";
import path from "path";

import { logger } from "../logger";
import {
  createDocumentChunks,
  deleteDocumentChunks,
  updateDocumentProcessingStatus,
} from "./repository";
import { extractPdfPages } from "./extractor";
import { chunkText } from "./chunker";
import { embedDocument } from "./embedder";

const IS875_DOCUMENT_ID =
  "1c6d38ce-fd4e-45dd-8973-e6371972485f";

const IS875_FILENAME = "is.875.3.1987.pdf";

function getIS875CanonicalPath() {
  return path.resolve(
    process.cwd(),
    "attached_assets",
    IS875_FILENAME,
  );
}

export async function processDocument(
  documentId: string,
  filePath: string,
) {
  let processingPath = filePath;

  if (documentId === IS875_DOCUMENT_ID) {
    const canonicalPath = getIS875CanonicalPath();

    try {
      await fs.access(canonicalPath);

      processingPath = canonicalPath;

      logger.info(
        {
          documentId,
          canonicalPath,
        },
        "Using canonical IS 875 PDF",
      );
    } catch {
      logger.warn(
        {
          documentId,
          canonicalPath,
        },
        "Canonical IS 875 PDF unavailable; using uploaded file",
      );
    }
  }

  try {
    await updateDocumentProcessingStatus(
      documentId,
      "processing",
      null,
    );

    logger.info(
      {
        documentId,
        filePath: processingPath,
      },
      "Document processing started",
    );

    const pages = await extractPdfPages(processingPath);

    logger.info(
      {
        documentId,
        pageCount: pages.length,
      },
      "PDF extraction completed",
    );

    const chunks = (
      await Promise.all(
        pages.map((page) =>
          chunkText(page.text, page.pageNumber),
        ),
      )
    ).flat();

    if (!chunks.length) {
      throw new Error(
        "PDF extraction produced no usable chunks",
      );
    }

    logger.info(
      {
        documentId,
        chunkCount: chunks.length,
      },
      "Document chunks generated",
    );

    /*
     * Do not touch the existing chunks until extraction
     * and chunk generation have succeeded completely.
     */
    await deleteDocumentChunks(documentId);
    await createDocumentChunks(documentId, chunks);

    logger.info(
      {
        documentId,
        pageCount: pages.length,
        chunkCount: chunks.length,
      },
      "Document chunks rebuilt",
    );

    await embedDocument(documentId);

    await updateDocumentProcessingStatus(
      documentId,
      "completed",
      null,
    );

    logger.info(
      { documentId },
      "Document processing completed",
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);

    await updateDocumentProcessingStatus(
      documentId,
      "failed",
      errorMessage,
    ).catch((statusErr) => {
      logger.error(
        {
          err: statusErr,
          documentId,
        },
        "Failed to update document processing status",
      );
    });

    logger.error(
      {
        err,
        documentId,
      },
      "Document processing failed",
    );

    throw err;
  }
}