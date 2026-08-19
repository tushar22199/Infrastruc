import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

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
  default: class {
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

vi.mock("../src/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import aiRouter from "../src/routes/ai";

describe("POST /chat integration", () => {
  const app = express();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.retrieveContext.mockResolvedValue([]);
    app.use(express.json());
    app.use("/ai", aiRouter);

    mocks.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: "There are 2 critical bridge inspections.",
          },
        },
      ],
    });
  });

  it("passes inspection tool results into the LLM context", async () => {
    const inspections = [
      {
        id: "inspection-1",
        title: "Bridge Deck Crack",
        issueType: "Bridge Deterioration",
        severity: "Critical",
        status: "Active",
        location: "Delhi",
        latitude: 28.6139,
        longitude: 77.209,
        inspector: "Engineer A",
        createdAt: "2026-08-19T10:00:00.000Z",
        description: "Major cracking observed on bridge deck.",
      },
      {
        id: "inspection-2",
        title: "Bridge Joint Damage",
        issueType: "Bridge Deterioration",
        severity: "Critical",
        status: "Active",
        location: "Delhi",
        latitude: 28.61,
        longitude: 77.21,
        inspector: "Engineer B",
        createdAt: "2026-08-19T09:00:00.000Z",
        description: "Deterioration around expansion joint.",
      },
    ];

    mocks.executeTool.mockResolvedValue({
      tool: "inspection",
      data: inspections,
    });

    const response = await request(app)
      .post("/ai/chat")
      .send({
        messages: [
          {
            role: "user",
            content: "Show me critical bridge inspections",
          },
        ],
      });

    expect(response.status).toBe(200);

    expect(mocks.executeTool).toHaveBeenCalledTimes(1);

    expect(mocks.executeTool).toHaveBeenCalledWith(
      "show me critical bridge inspections"
    );
    expect(mocks.create).toHaveBeenCalledOnce();

    const requestBody = mocks.create.mock.calls[0][0];

    const inspectionMessage = requestBody.messages.find(
      (message: any) =>
        message.role === "system" &&
        message.content.includes("Current inspection data")
    );

    expect(inspectionMessage).toBeDefined();

    expect(inspectionMessage.content).toContain(
      "Bridge Deck Crack"
    );

    expect(inspectionMessage.content).toContain(
      "Bridge Deterioration"
    );

    expect(inspectionMessage.content).toContain(
      "Critical"
    );

    expect(inspectionMessage.content).toContain(
      "Major cracking observed on bridge deck."
    );

    expect(response.body.reply).toBe(
      "There are 2 critical bridge inspections."
    );
  });

  it("does not call the inspection tool for unrelated questions", async () => {
    mocks.executeTool.mockResolvedValue(null);

    const response = await request(app)
      .post("/ai/chat")
      .send({
        messages: [
          {
            role: "user",
            content: "Explain Newton's laws",
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(mocks.executeTool).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("returns a 500 response when RAG retrieval fails", async () => {
    mocks.retrieveContext.mockRejectedValueOnce(
      new Error("RAG retrieval unavailable")
    );

    const response = await request(app)
      .post("/ai/chat")
      .send({
        messages: [
          {
            role: "user",
            content: "What IRC clause applies to bridge deck cracking?",
          },
        ],
      });

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      reply: "Sorry, something went wrong.",
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });
});
