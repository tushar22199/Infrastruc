import app from "./app";
import { logger } from "./lib/logger";
import { getProcessingDocuments } from "./lib/knowledge/repository";
import { processDocument } from "./lib/knowledge/documentProcessor";
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
async function recoverProcessingDocuments() {
  try {
    const documents = await getProcessingDocuments();

    if (!documents.length) {
      return;
    }

    logger.warn(
      {
        count: documents.length,
        documents: documents.map((document: any) => ({
          id: String(document.id),
          title: String(document.title),
          storagePath: String(document.storage_path),
        })),
      },
      "Found documents stuck in processing",
    );

    for (const document of documents) {
      try {
        const documentId = String(document.id);
        const storagePath = String(document.storage_path);

        await processDocument(
          documentId,
          storagePath,
        );
      } catch (err) {
        logger.error(
          {
            err,
            documentId: String(document.id),
          },
          "Failed to recover document processing",
        );
      }
    }
  } catch (err) {
    logger.error(
      { err },
      "Failed to recover processing documents",
    );
  }
}
app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  void recoverProcessingDocuments();
});