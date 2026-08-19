import { executeTool } from "../lib/ai/tool-executor";
import { retrieveContext } from "../lib/knowledge/retriever";
import { validate } from "../middlewares/validate";
import { ChatSchema, InsightsSchema } from "@workspace/api-zod";
import { aiLimiter } from "../middlewares/rateLimiter";
import multer from "multer";
import { requireAuth } from "../middlewares/authMiddleware";


import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

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

aiRouter.post("/insights", validate(InsightsSchema), async (req, res) => {
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
      model: "openai/gpt-oss-120b",
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
aiRouter.post("/chat", validate(ChatSchema), async (req, res) => {
  try {
    const { messages } = req.body;

    const latestMessage =
      messages.at(-1)?.content?.trim() ?? "";

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

    const isEngineeringQuestion =
      /(is\s?\d+|clause|table|figure|annex|beam|column|slab|footing|foundation|pile|steel|cement|concrete|reinforcement|aggregate|mix|water.?cement|cover|development length|lap splice|shear|moment|torsion|durability|grade|m\d+|irc|morth|cpheeo)/i.test(
        question
      );

    const isInspectionQuestion =
      /(inspection|issue|report|audit|maintenance|asset|severity|defect|bridge|road|building)/i.test(
        question
      );

    const toolResult = isInspectionQuestion
      ? await executeTool(question)
      : null;

    const inspections =
      toolResult?.tool === "inspection"
        ? (toolResult.data as any[])
        : [];

    const documentChunks = isEngineeringQuestion
      ? await retrieveContext(question)
      : [];
    const sources = Array.from(
      new Map(
        documentChunks.map((chunk: any) => [
          `${chunk.document_id}:${chunk.page_number}:${chunk.chunk_index}`,
          {
            documentId: chunk.document_id,
            document: chunk.documentTitle,
            page: chunk.page_number,
            chunkIndex: chunk.chunk_index,
          },
        ])
      ).values()
    );
    const DEBUG_RAG = process.env.DEBUG_RAG === "true";

    if (DEBUG_RAG) {
      documentChunks.forEach((chunk, index) => {
        logger.debug(
          {
            rank: index + 1,
            id: chunk.id,
            documentId: chunk.document_id,
            chunkIndex: chunk.chunk_index,
            page: chunk.page_number,
            document: chunk.documentTitle,
          },
          "Retrieved RAG chunk"
        );
      });
    }
    const documentContext = documentChunks
      .map(
        (chunk: any) => `
    ========================================

    Document: ${chunk.documentTitle}

    Page: ${chunk.page_number ?? "Unknown"}

    ${chunk.content}

    ========================================
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

  
    // Build prompt messages
    const chatHistory = messages
      .slice(-8, -1)
      .filter(
        (message: any) =>
          message.role === "user" ||
          message.role === "assistant"
      ) as {
      role: "user" | "assistant";
      content: string;
    }[];

    const promptMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `
    You are Infrastructure Copilot, an expert civil and infrastructure engineering assistant.

    You specialize in:

    - Infrastructure inspections
    - Structural engineering
    - Roads, bridges and buildings
    - Asset management
    - Risk assessment
    - Preventive maintenance
    - Engineering standards

    General Rules:

    - Always answer in Markdown.
    - Use headings and bullet points.
    - Explain engineering reasoning.
    - Never fabricate engineering values.
    - Never invent inspection data.
    - If information is unavailable, clearly state it.
    - Prioritize public safety.
    - Recommend practical engineering actions.
    - Use professional engineering language.

    Engineering Standards Rules:

    - If engineering references are supplied, use ONLY those references.
    - Never invent clauses, tables, values or code provisions.
    - If the answer is not present in the supplied references, explicitly state that.
    - Never mention internal chunk IDs or database identifiers.

    When answering engineering questions always finish with:

    ### Sources

    • Document:
    • Page:
    `,
      },
    ];

    // ----------------------------
    // Inspection Context
    // ----------------------------
    if (isInspectionQuestion && reportInspections.length) {
      promptMessages.push({
        role: "system",
        content: `
    Current inspection data

    Total inspections: ${reportInspections.length}

    ${inspectionContext}
    `,
      });
    }

    // ----------------------------
    // Report Instructions
    // ----------------------------
    if (reportInstruction) {
      promptMessages.push({
        role: "system",
        content: reportInstruction,
      });
    }

    // ----------------------------
    // Previous Conversation
    // ----------------------------
    promptMessages.push(...chatHistory);

    // ----------------------------
    // Current User Message
    // ----------------------------
    if (documentChunks.length) {
      promptMessages.push({
        role: "user",
        content: `
    Engineering References

    ${documentContext}

    ----------------------------------------

    Question

    ${latestMessage}
    `,
      });
    } else {
      promptMessages.push({
        role: "user",
        content: latestMessage,
      });
    }

    // ----------------------------
    // LLM Call
    // ----------------------------
    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      messages: promptMessages,
    });

    res.json({
      reply: response.choices[0].message.content,
      sources,
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
  