import { Router } from "express";
import { generateEmbedding } from "../lib/knowledge/embeddings";

const router = Router();

router.get("/embedding", async (_req, res, next) => {
  try {
    const embedding = await generateEmbedding(
      "This is a test document."
    );

    res.json({
      dimensions: embedding.length,
      firstFive: embedding.slice(0, 5),
    });
  } catch (error) {
    next(error);
  }
});

export default router;