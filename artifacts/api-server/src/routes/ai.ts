import { Router } from "express";
import OpenAI from "openai";

const aiRouter = Router();

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
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
You are an infrastructure auditing expert.

Dashboard Data:
Total inspections: ${totalInspections}
Active issues: ${activeIssues}
Regional health: ${regionalHealth}
Overdue inspections: ${overdueInspections}

Severity:
${JSON.stringify(severityBreakdown)}

Generate:
- Infrastructure Health
- Key Insights
- Recommendation
`;

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    res.json({
      success: true,
      insight: response.choices[0].message.content,
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
