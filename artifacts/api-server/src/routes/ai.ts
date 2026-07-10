import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

const aiRouter = Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

aiRouter.get("/api/ai/models", async (_req, res) => {
  try {
    const models = await ai.models.list();
    res.json(models);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

export default aiRouter;
