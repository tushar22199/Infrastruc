import { retrieveContext } from "../lib/knowledge/retriever";
import { retrieveRelevantInspections } from "../lib/ai/retriever/inspection-retriever";
import { validate } from "../middlewares/validate";
import { InsightsSchema } from "@workspace/api-zod";
import { aiLimiter } from "../middlewares/rateLimiter";
import multer from "multer";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  getLatestInspections,
  getCriticalInspections,
  getActiveInspections,
  getAllInspections,
} from "../lib/ai/tools/inspection-tool";

import { Router } from "express";
import OpenAI from "openai";

const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.use(aiLimiter);
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },

  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed."));
    }

    cb(null, true);
  },
});

aiRouter.post(
  "/insights",
  validate(InsightsSchema),
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
  },
);
aiRouter.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    const latestMessage = messages[messages.length - 1]?.content ?? "";

    const question = latestMessage.toLowerCase();

    const isReportRequest = [
      "report",
      "generate report",
      "inspection report",
      "maintenance report",
      "summary report",
      "assessment report",
      "audit",
      "audit report",
      "executive summary",
      "assessment",
    ].some((keyword) => question.includes(keyword));

    const inspections = await retrieveRelevantInspections(question);
    const documentChunks = await retrieveContext(question);
    console.log("=== Retrieved Chunks ===");

    documentChunks.forEach((chunk: any, index: number) => {
      console.log(`Chunk ${index + 1}`);
      console.log(chunk.content);
      console.log("--------------------");
    });
    const documentContext = documentChunks
      .map(
        (chunk: any, index: number) => `
    ## Document Chunk ${index + 1}

    ${chunk.content}

    ----------------------------------------
    `
      )
      .join("\n");
    const reportInspections = isReportRequest
    ? inspections.slice(0, 100)
    : inspections.slice(0, 10);
    const inspectionContext = reportInspections
      .map(
        (inspection: any, index: number) => `
    ## Inspection ${index + 1}

    ID: ${inspection.id ?? "N/A"}

    Title: ${inspection.title ?? "Untitled Inspection"}

    Issue Type: ${inspection.issueType ?? "Unknown"}

    Severity: ${inspection.severity ?? "Unknown"}

    Status: ${inspection.status ?? "Unknown"}

    Location: ${
      inspection.location ??
      `${inspection.latitude ?? "N/A"}, ${inspection.longitude ?? "N/A"}`
    }

    Coordinates:
    Latitude: ${inspection.latitude ?? "N/A"}
    Longitude: ${inspection.longitude ?? "N/A"}

    Inspector:
    ${inspection.inspector ?? "Unknown"}

    Created:
    ${inspection.createdAt ?? "Unknown"}

    Description:
    ${inspection.description ?? "No description provided."}

    ----------------------------------------
    `,
      )
      .join("\n");

    const reportInstruction = isReportRequest
      ? `
The user requested a professional engineering inspection report.

Return a complete markdown report using EXACTLY the following structure.

# Infrastructure Inspection Report

## Executive Summary

Provide a concise executive overview.

## Inspection Overview

Include:
- Total inspections
- Open issues
- Closed issues
- Severity distribution

## Severity Analysis

Discuss trends.

## Critical Findings

List major defects.

## Risk Assessment

Evaluate operational and structural risks.

## Engineering Recommendations

Provide actionable repair recommendations.

## Maintenance Timeline

Separate into:
- Immediate
- Short Term
- Long Term

## Compliance Notes

Mention applicable engineering practices.

## Conclusion

Provide a final engineering assessment.

## Executive Action Items

List the five highest-priority actions.

For each action include:

- Priority
- Issue
- Recommended Action
- Target Timeframe

Requirements:

- Professional engineering language.
- Markdown headings.
- Bullet points where appropriate.
- Never invent inspection data.
- Mention assumptions if necessary.
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
When preparing inspection reports:

- Prioritize human safety.
- Rank findings by engineering risk.
- Reference evidence from the inspection data.
- Avoid repeating the same issue.
- Write concise executive summaries.
- Recommend practical engineering actions.
- If multiple critical defects exist, prioritize them.
- Think like a senior civil engineering consultant preparing a report for management.

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
Total inspections supplied: ${reportInspections.length}
${inspectionContext}
`,
        },
        {
          role: "system",
          content: `
        Relevant engineering documents:

        ${documentContext}

        Use this document context whenever it is relevant to answer the user's question.

        If the inspection data and document context are both useful, combine them.

        Never invent information that is not present.
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
        model: "qwen/qwen3.6-27b",
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
  },
);
aiRouter.get("/models", async (_req, res) => {
  try {
    const models = await client.models.list();
    res.json(models);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});
export default aiRouter;
