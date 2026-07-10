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

Analyze the following dashboard statistics and generate a concise operational summary.

Dashboard Data:
- Total Inspections: ${totalInspections}
- Active Issues: ${activeIssues}
- Regional Health Score: ${regionalHealth}/100
- Overdue Re-inspections: ${overdueInspections}
- Severity Breakdown:
${JSON.stringify(severityBreakdown, null, 2)}

Respond ONLY in this format:

Infrastructure Health:
- ...

Key Insights:
- ...
- ...
- ...

Recommendation:
- ...
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      insight: response.text,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to generate AI insights",
    });
  }
});

export default aiRouter;
