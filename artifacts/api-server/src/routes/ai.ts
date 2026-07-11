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
      model: "gemini-2.5-flash-lite",
      contents: "Say hello in one sentence.",
    });

    console.log("Gemini replied!");

    res.json({
      success: true,
      text: response.text,
    });
  } catch (err: any) {
    console.error("Gemini Error:", err);
    console.error("Message:", err?.message);
    console.error("Status:", err?.status);
    console.error("Response:", err?.response);

    res.status(500).json({
      success: false,
      message: err?.message,
      error: err,
    });
  }
});

export default aiRouter;
