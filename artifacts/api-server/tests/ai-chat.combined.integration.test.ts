import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";

const mocks = vi.hoisted(() => ({
  executeTool: vi.fn(),
  retrieveContext: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../src/lib/ai/tool-executor", () => ({
  executeTool: mocks.executeTool,
}));

vi.mock("../src/lib/knowledge/retriever", () => ({
  retrieveContext: mocks.retrieveContext,
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: mocks.create,
      },
    };
  },
}));

vi.mock("../src/middlewares/authMiddleware", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../src/middlewares/rateLimiter", () => ({
  aiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../src/middlewares/validate", () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("@workspace/api-zod", () => ({
  InsightsSchema: {},
  ChatSchema: {},
}));

vi.mock("../src/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
  },
}));

vi.mock("multer", () => {
  const multer = () => ({
    single: () => (_req: any, _res: any, next: any) => next(),
  });

  multer.memoryStorage = () => ({});

  return {
    default: multer,
  };
});

import aiRouter from "../src/routes/ai";

const app = express();
app.use(express.json());
app.use("/ai", aiRouter);

describe("POST /chat - combined inspection + RAG", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.executeTool.mockResolvedValue({
      tool: "inspection",
      data: [
        {
          id: "inspection-critical-1",
          title: "Bridge Deck Crack",
          issueType: "Structural Defect",
          severity: "Critical",
          status: "Active",
          location: "Delhi",
          description: "Major cracking observed on bridge deck.",
        },
      ],
    });

    mocks.retrieveContext.mockResolvedValue([
      {
        id: "chunk-1",
        document_id: "standard-1",
        documentTitle: "Bridge Inspection Standard",
        page_number: 42,
        chunk_index: 10,
        content:
          "Critical structural defects require immediate assessment and appropriate safety measures.",
      },
    ]);

    mocks.create.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "The critical bridge defect requires immediate assessment and safety measures.",
          },
        },
      ],
    });
  });

  it("passes both inspection data and engineering references to the LLM", async () => {
    const response = await request(app)
      .post("/ai/chat")
      .send({
        messages: [
          {
            role: "user",
            content:
              "What IRC clause applies to these critical bridge defects?",
          },
        ],
      });

    expect(response.status).toBe(200);

    expect(mocks.executeTool).toHaveBeenCalledOnce();

    expect(mocks.executeTool).toHaveBeenCalledWith(
      "what irc clause applies to these critical bridge defects?"
    );

    expect(mocks.retrieveContext).toHaveBeenCalledOnce();

    expect(mocks.retrieveContext).toHaveBeenCalledWith(
      "what irc clause applies to these critical bridge defects?"
    );

    expect(mocks.create).toHaveBeenCalledOnce();

    const call = mocks.create.mock.calls[0][0];
    const messages = call.messages;
    const serializedMessages = JSON.stringify(messages);

    expect(serializedMessages).toContain("Bridge Deck Crack");
    expect(serializedMessages).toContain("Critical");
    expect(serializedMessages).toContain(
      "Major cracking observed on bridge deck."
    );

    expect(serializedMessages).toContain(
      "Bridge Inspection Standard"
    );

    expect(serializedMessages).toContain(
      "Critical structural defects require immediate assessment and appropriate safety measures."
    );

    expect(response.body).toEqual({
      reply:
        "The critical bridge defect requires immediate assessment and safety measures.",
      sources: [
        {
          documentId: "standard-1",
          document: "Bridge Inspection Standard",
          page: 42,
          chunkIndex: 10,
        },
      ],
    });
  });

  it("does not call RAG for a non-engineering inspection question", async () => {
    const response = await request(app)
      .post("/ai/chat")
      .send({
        messages: [
          {
            role: "user",
            content: "Show me the critical bridge inspections",
          },
        ],
      });

    expect(response.status).toBe(200);

    expect(mocks.executeTool).toHaveBeenCalledOnce();

    expect(mocks.retrieveContext).not.toHaveBeenCalled();
  });
});
