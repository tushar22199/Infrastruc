import { logger } from "../lib/logger";
import { retrieveContext } from "../lib/knowledge/retriever";
import { embedDocument } from "../lib/knowledge/embedder";
import {
  createDocument,
  createDocumentChunks,
  listDocuments,
  getDocumentById,
  deleteDocument,
} from "../lib/knowledge/repository";
import { extractPdfPages } from "../lib/knowledge/extractor";
import { chunkText } from "../lib/knowledge/chunker";
import { upload } from "../lib/knowledge/upload";
import { Router } from "express";
import { authorize } from "../middlewares/authorize";
import { requireAuth } from "../middlewares/authMiddleware";


const documentsRouter = Router();

documentsRouter.use(requireAuth);

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
documentsRouter.post(
  "/upload",
  authorize(["ADMIN", "INSPECTOR"]),
  upload.single("file"),
  async (req, res, next) => {
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
        if ((allowedCategories as readonly string[]).includes(value)) {
          return value as DocumentCategory;
        }

        return "Other";
      }
      function getValue(value: string | string[] | undefined): string {
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
      const pages = await extractPdfPages(req.file.path);

      const chunks = (
        await Promise.all(
          pages.map((page) =>
            chunkText(page.text, page.pageNumber)
          )
        )
      ).flat();

      await createDocumentChunks(document.id, chunks);
      logger.info(
        {
          documentId: document.id,
          uploadedBy: userId,
          chunkCount: chunks.length,
          fileSize: req.file.size,
        },
        "Document processed successfully"
      );

      // Run embedding in the background
      void embedDocument(document.id).catch((err) => {
        console.error("Embedding failed:", err);
      });

      res.status(201).json(document);
      } catch (err) {
      logger.error(
        {
          err,
          userId: req.user?.id,
          file: req.file?.originalname,
          path: req.file?.path,
        },
        "Document upload failed"
      );

      next(err);
      }
      },
      );
documentsRouter.post(
  "/repair-is875-embeddings",
  authorize(["ADMIN"]),
  async (_req, res, next) => {
    try {
      const documentId = "02038ff4-6356-4ac1-95d8-0a825145493f";

      logger.info(
        { documentId },
        "Starting IS 875 embedding repair"
      );

      void embedDocument(documentId).catch((err) => {
        logger.error(
          { err, documentId },
          "IS 875 embedding repair failed"
        );
      });

      res.status(202).json({
        success: true,
        message: "IS 875 embedding repair started",
        documentId,
      });
    } catch (err) {
      next(err);
    }
  }
);

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
  }
);
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
});
      export default documentsRouter;