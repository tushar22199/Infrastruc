import {
  getLatestInspections,
  getCriticalInspections,
  getActiveInspections,
} from "../lib/ai/tools/inspection-tool";
import { db, inspectionsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
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
aiRouter.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    let inspections;

    const latestMessage =
      messages[messages.length - 1]?.content ?? "";

    const question = latestMessage.toLowerCase();

    if (question.includes("critical")) {
      inspections = await getCriticalInspections();
    } else if (question.includes("active")) {
      inspections = await getActiveInspections();
    } else {
      inspections = await getLatestInspections();
    }
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are Infrastructure Copilot, an AI assistant for civil and infrastructure engineers. Help with inspections, defects, reports, maintenance, road engineering, bridge engineering, standards, and asset management.",
        },
        {
          role: "user",
          content: `
        User Question:
        ${messages}

        Recent Inspections:
        ${JSON.stringify(inspections, null, 2)}

        Answer the user's question using the inspection data when relevant.
        If the user asks something unrelated to inspections, answer normally.
        `,
        },
      ],
    });

    res.json({
      reply: response.choices[0].message.content,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      reply: "Sorry, something went wrong.",
    });
  }
});
export default aiRouter;
