import multer from "multer";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  getLatestInspections,
  getCriticalInspections,
  getActiveInspections,
} from "../lib/ai/tools/inspection-tool";

import { Router } from "express";
import OpenAI from "openai";

const aiRouter = Router();

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});
const upload = multer({
  storage: multer.memoryStorage(),
});

aiRouter.post(
  "/insights",
  requireAuth,
  async (req, res) => {
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
aiRouter.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages } = req.body;

    const latestMessage =
      messages[messages.length - 1]?.content ?? "";

    const question = latestMessage.toLowerCase();

    const isReportRequest = [
      "report",
      "generate report",
      "inspection report",
      "maintenance report",
      "summary report",
      "assessment report",
    ].some((keyword) => question.includes(keyword));

    let inspections;

    if (question.includes("critical")) {
      inspections = await getCriticalInspections();
    } else if (question.includes("active")) {
      inspections = await getActiveInspections();
    } else {
      inspections = await getLatestInspections();
    }

    const inspectionContext = inspections
      .map(
        (inspection: any, index: number) => `
Inspection ${index + 1}

ID: ${inspection.id}
Location: ${inspection.location}
Status: ${inspection.status}
Severity: ${inspection.severity}
Inspector: ${inspection.inspector}
Date: ${inspection.createdAt}
Description: ${inspection.description}
`
      )
      .join("\n----------------------------------------\n");

    const reportInstruction = isReportRequest
      ? `
The user has requested a professional infrastructure inspection report.

Return the response using EXACTLY this structure:

# Infrastructure Inspection Report

## Executive Summary

## Inspection Overview

## Key Findings

## Risk Assessment

## Recommended Repairs

## Maintenance Priority

## Preventive Maintenance

## Conclusion

Requirements:
- Use Markdown.
- Do not skip any section.
- Base everything on the provided inspection data.
- If data is missing, clearly mention assumptions.
- Write as if submitting the report to a municipal authority or engineering manager.
`
      : "";

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `
You are Infrastructure Copilot, an expert civil and infrastructure engineering assistant.

You specialize in:

- Infrastructure inspections
- Structural engineering
- Roads, bridges, buildings
- Asset management
- Risk assessment
- Preventive maintenance
- Engineering standards

Rules:

- Always answer in Markdown.
- Use headings and bullet points.
- Explain engineering reasoning.
- Never invent inspection data.
- If information is unavailable, clearly state assumptions.
- Prioritize public safety.
- Provide practical recommendations.
- Use professional engineering language.

When discussing inspections, include where appropriate:

- Executive Summary
- Key Findings
- Risk Assessment
- Recommended Actions
- Maintenance Priority
- Preventive Maintenance
- Conclusion
`,
        },

        {
          role: "system",
          content: `
Current inspection data:

${inspectionContext}
`,
        },

        ...(reportInstruction
          ? [
              {
                role: "system" as const,
                content: reportInstruction,
              },
            ]
          : []),

        ...(messages as {
          role: "user" | "assistant";
          content: string;
        }[]),
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
aiRouter.post(
  "/analyze-image",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No image uploaded.",
        });
        return;
      }

      const imageBase64 = req.file.buffer.toString("base64");
      const imageUrl = `data:${req.file.mimetype};base64,${imageBase64}`;

      const response = await client.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this infrastructure inspection image.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
      });
      res.json({
        success: true,
        analysis: response.choices[0].message.content,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        success: false,
        message: "Image upload failed.",
      });
    }
  }
);
aiRouter.get("/models", async (req, res) => {
  try {
    const models = await client.models.list();
    res.json(models);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});
export default aiRouter;
