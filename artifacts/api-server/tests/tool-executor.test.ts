import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  canHandle: vi.fn(),
}));

vi.mock("../src/lib/ai/tool-registry", () => ({
  tools: [
    {
      name: "inspection",
      description: "Inspection tool",
      canHandle: mocks.canHandle,
      execute: mocks.execute,
    },
  ],
}));

import { executeTool } from "../src/lib/ai/tool-executor";

describe("executeTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes the matching tool", async () => {
    const result = {
      tool: "inspection",
      data: [{ id: "inspection-1" }],
    };

    mocks.canHandle.mockReturnValue(true);
    mocks.execute.mockResolvedValue(result);

    const response = await executeTool(
      "Show me the latest inspections"
    );

    expect(mocks.canHandle).toHaveBeenCalledWith(
      "Show me the latest inspections"
    );

    expect(mocks.execute).toHaveBeenCalledWith(
      "Show me the latest inspections"
    );

    expect(response).toEqual(result);
  });

  it("returns null when no tool can handle the question", async () => {
    mocks.canHandle.mockReturnValue(false);

    const response = await executeTool(
      "What is the weather today?"
    );

    expect(mocks.canHandle).toHaveBeenCalledWith(
      "What is the weather today?"
    );

    expect(mocks.execute).not.toHaveBeenCalled();

    expect(response).toBeNull();
  });

  it("passes the original question to the tool", async () => {
    const result = {
      tool: "inspection",
      data: [],
    };

    mocks.canHandle.mockReturnValue(true);
    mocks.execute.mockResolvedValue(result);

    const question = "Show CRITICAL inspections";

    await executeTool(question);

    expect(mocks.execute).toHaveBeenCalledWith(question);
  });

  it("supports questions without hardcoded routing keywords", async () => {
    const result = {
      tool: "inspection",
      data: [],
    };

    mocks.canHandle.mockReturnValue(true);
    mocks.execute.mockResolvedValue(result);

    const response = await executeTool(
      "Give me the inspection summary"
    );

    expect(response).toEqual(result);
  });

  it("does not execute a tool that cannot handle the question", async () => {
    mocks.canHandle.mockReturnValue(false);

    await executeTool("Tell me a joke");

    expect(mocks.execute).not.toHaveBeenCalled();
  });
});