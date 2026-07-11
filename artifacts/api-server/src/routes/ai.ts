import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

const aiRouter = Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

aiRouter.post("/insights", async (_req, res) => {
  try {
    console.log("Starting Gemini request...");

    const response = await ai.models.generateContent({
      model: "models/gemini-2.0-flash",
      contents: "Say hello in one sentence.",
    });

    console.log("Gemini replied!");

    res.json({
      success: true,
      text: response.text,
    });
  } catch (err: any) {
    console.error("Gemini Error:", err);

    res.status(500).json({
      success: false,
      message: err?.message,
    });
  }
});

export default aiRouter;
