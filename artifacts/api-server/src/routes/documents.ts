import { upload } from "../lib/knowledge/upload";
import { createDocument } from "../lib/knowledge/repository";
import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware";
import { listDocuments } from "../lib/knowledge/repository";

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

      res.status(201).json(document);
    } catch (err) {
      next(err);
    }
  }
);

export default documentsRouter;