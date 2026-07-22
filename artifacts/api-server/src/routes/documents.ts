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

export default documentsRouter;