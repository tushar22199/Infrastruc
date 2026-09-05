import fs from "fs/promises";
import { processDocument } from "../lib/knowledge/documentProcessor";
import { Router } from "express";

import { logger } from "../lib/logger";
import { retrieveContext } from "../lib/knowledge/retriever";
import { embedDocument } from "../lib/knowledge/embedder";
import {
  createDocument,
  createDocumentChunks,
  deleteDocumentChunks,
  listDocuments,
  getDocumentById,
  deleteDocument,
  updateDocumentProcessingStatus,
} from "../lib/knowledge/repository";
import {
  extractPdfPages,
  extractIS875AppendixPages,
} from "../lib/knowledge/extractor";
import { chunkText } from "../lib/knowledge/chunker";
import { upload } from "../lib/knowledge/upload";
import { authorize } from "../middlewares/authorize";
import { requireAuth } from "../middlewares/authMiddleware";

const documentsRouter = Router();

documentsRouter.use(requireAuth);

/* -------------------------------------------------------------------------- */
/*                              Document Listing                              */
/* -------------------------------------------------------------------------- */

documentsRouter.get("/", async (_req, res, next) => {
  try {
    const documents = await listDocuments();

    res.json({
      success: true,
      documents,
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------------------- */
/*                              Document Upload                               */
/* -------------------------------------------------------------------------- */

documentsRouter.post(
  "/upload",
  authorize(["ADMIN", "INSPECTOR"]),
  upload.single("file"),
  async (req, res, next) => {
    let documentId: string | undefined;

    try {
      if (!req.file) {
        res.status(400).json({
          message: "No PDF uploaded",
        });
        return;
      }

      const userId = req.user!.id;

      const allowedCategories = [
        "Standard",
        "Project Document",
        "Report",
        "Manual",
        "Drawing",
        "Other",
      ] as const;

      type DocumentCategory = (typeof allowedCategories)[number];

      function getCategory(value: string): DocumentCategory {
        if (
          (allowedCategories as readonly string[]).includes(value)
        ) {
          return value as DocumentCategory;
        }

        return "Other";
      }

      function getValue(
        value: string | string[] | undefined,
      ): string {
        if (!value) return "";

        return Array.isArray(value) ? value[0] : value;
      }

      const document = await createDocument({
        title: getValue(req.body.title),
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        category: getCategory(getValue(req.body.category)),
        uploadedBy: userId,
        fileSize: req.file.size,
        storagePath: req.file.path,
      });

      documentId = document.id;

      await updateDocumentProcessingStatus(
        document.id,
        "processing",
        null,
      );

      const pages = await extractIS875AppendixPages(
        req.file.path,
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
          "Document extraction produced no chunks",
        );
      }

      await createDocumentChunks(
        document.id,
        chunks,
      );

      logger.info(
        {
          documentId: document.id,
          uploadedBy: userId,
          chunkCount: chunks.length,
          fileSize: req.file.size,
        },
        "Document processed successfully",
      );

      // Embedding runs in the background.
      void (async () => {
        try {
          await embedDocument(document.id);

          await updateDocumentProcessingStatus(
            document.id,
            "completed",
            null,
          );

          logger.info(
            { documentId: document.id },
            "Document embedding completed",
          );
        } catch (err) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : String(err);

          await updateDocumentProcessingStatus(
            document.id,
            "failed",
            errorMessage,
          ).catch((statusErr) => {
            logger.error(
              {
                err: statusErr,
                documentId: document.id,
              },
              "Failed to update document processing status",
            );
          });

          logger.error(
            {
              err,
              documentId: document.id,
            },
            "Document embedding failed",
          );
        }
      })();

      res.status(201).json(document);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      if (documentId) {
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
      }

      logger.error(
        {
          err,
          documentId,
          userId: req.user?.id,
          file: req.file?.originalname,
          path: req.file?.path,
        },
        "Document upload failed",
      );

      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                         IS 875 Document Repair                             */
/* -------------------------------------------------------------------------- */

documentsRouter.post(
  "/repair-is875",
  authorize(["ADMIN"]),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const documentId =
        "1c6d38ce-fd4e-45dd-8973-e6371972485f";

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "IS 875 PDF file is required",
        });
        return;
      }

      const filePath = req.file.path;

      await updateDocumentProcessingStatus(
        documentId,
        "processing",
        null,
      );

      logger.info(
        {
          documentId,
          file: req.file.originalname,
          path: filePath,
        },
        "Starting IS 875 document repair",
      );

      // Return immediately. OCR, chunk rebuilding,
      // and embedding happen in the background.
      res.status(202).json({
        success: true,
        message: "IS 875 document repair started",
        documentId,
      });

      void (async () => {
        try {
          await processDocument(documentId, filePath);
          logger.info({ documentId }, "IS 875 document repair completed");
        } catch (err) {
          logger.error({ err, documentId }, "IS 875 document repair failed");
        } finally {
          await fs.rm(filePath, { force: true }).catch(err => {
            logger.warn(
              { err, filePath },
              "Failed to remove temporary IS 875 PDF",
            );
          });
        }
      })();
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                                  Search                                    */
/* -------------------------------------------------------------------------- */

documentsRouter.post(
  "/search",
  async (req, res, next): Promise<void> => {
    try {
      const { question } = req.body;

      if (!question) {
        res.status(400).json({
          message: "Question is required",
        });
        return;
      }

      const chunks = await retrieveContext(question);

      res.json({
        question,
        results: chunks,
      });
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                              Document Details                              */
/* -------------------------------------------------------------------------- */

documentsRouter.get("/:id", async (req, res, next) => {
  try {
    const document = await getDocumentById(req.params.id);

    if (!document) {
      res.status(404).json({
        success: false,
        message: "Document not found",
      });
      return;
    }

    res.json({
      success: true,
      document,
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------------------- */
/*                              Document Delete                               */
/* -------------------------------------------------------------------------- */

documentsRouter.delete(
  "/:id",
  authorize(["ADMIN"]),
  async (req, res, next) => {
    try {
      const documentId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const deleted = await deleteDocument(documentId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: "Document not found",
        });
        return;
      }

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (err) {
      next(err);
    }
  },
);

export default documentsRouter;