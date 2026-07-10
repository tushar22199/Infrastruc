import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

const aiRouter = Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

aiRouter.post("/insights", async (req, res) => {
  try {
    const {
      totalInspections,
      activeIssues,
      regionalHealth,
      overdueInspections,
      severityBreakdown,
    } = req.body;

    const prompt = `
You are an expert infrastructure auditor.

Analyze the following inspection dashboard.

Dashboard Statistics:
- Total Inspections: ${totalInspections}
- Active Issues: ${activeIssues}
- Regional Health Score: ${regionalHealth}/100
- Overdue Re-inspections: ${overdueInspections}

Severity Breakdown:
${JSON.stringify(severityBreakdown, null, 2)}

Return ONLY the following sections.

Infrastructure Health:
...

Key Insights:
- ...
- ...
- ...

Recommendation:
- ...
`;

    const response = await ai.models.generateContent({
      model: "models/gemini-flash-latest",
      contents: prompt,
    });

    res.json({
      success: true,
      insight: response.text,
    });
  } catch (err: any) {
    console.error("Gemini Error:", err);

    res.status(500).json({
      success: false,
      message: err?.message ?? "Gemini request failed",
    });
  }
});

export default aiRouter;
