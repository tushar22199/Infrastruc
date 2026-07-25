import { embedDocument } from "../lib/knowledge/embedder";
import {
  createDocument,
  createDocumentChunks,
  listDocuments,
} from "../lib/knowledge/repository";
import { extractPdfText } from "../lib/knowledge/extractor";
import { chunkText } from "../lib/knowledge/chunker";
import { upload } from "../lib/knowledge/upload";

import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware";

const documentsRouter = Router();

documentsRouter.use(requireAuth);

documentsRouter.get("/", async (_req, res, next) => {
  try {
    const documents = await listDocuments();
    res.json(documents);
  } catch (error) {
    next(error);
  }
});
documentsRouter.post(
  "/upload",
  upload.single("file"),
  async (req, res, next): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          message: "No PDF uploaded",
        });
        return;
      }

      const userId = req.user!.id;

      const document = await createDocument({
        title: req.body.title,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        category: req.body.category,
        uploadedBy: userId,
        fileSize: req.file.size,
        storagePath: req.file.path,
      });
      const text = await extractPdfText(req.file.path);

      const chunks = await chunkText(text);

      await createDocumentChunks(document.id, chunks);

      // Run embedding in the background
      void embedDocument(document.id).catch((err) => {
        console.error("Embedding failed:", err);
      });

      console.log("Saved chunks:", chunks.length);
      console.log("Extracted characters:", text.length);
      console.log("Chunks created:", chunks.length);
      console.log("First chunk:");
            console.log(chunks[0]);

            res.status(201).json(document);
          } catch (err) {
            next(err);
          }
        },
      );

      export default documentsRouter;