import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retrieveRelevantInspections: vi.fn(),
}));

vi.mock("../src/lib/ai/retriever/inspection-retriever", () => ({
  retrieveRelevantInspections: mocks.retrieveRelevantInspections,
}));

import inspectionTool from "../src/lib/ai/tools/inspection-tool";

describe("inspection tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("canHandle", () => {
    it("handles inspection questions", () => {
      expect(
        inspectionTool.canHandle("Show latest inspections")
      ).toBe(true);
    });

    it("handles critical questions", () => {
      expect(
        inspectionTool.canHandle("Show critical issues")
      ).toBe(true);
    });

    it("handles active questions", () => {
      expect(
        inspectionTool.canHandle("Show active inspections")
      ).toBe(true);
    });

    it("handles report requests", () => {
      expect(
        inspectionTool.canHandle("Generate an inspection report")
      ).toBe(true);
    });

    it("handles bridge questions", () => {
      expect(
        inspectionTool.canHandle("Show bridge defects")
      ).toBe(true);
    });

    it("handles road questions", () => {
      expect(
        inspectionTool.canHandle("Show road damage")
      ).toBe(true);
    });

    it("handles maintenance questions", () => {
      expect(
        inspectionTool.canHandle("Show maintenance issues")
      ).toBe(true);
    });

    it("rejects unrelated questions", () => {
      expect(
        inspectionTool.canHandle("What is the weather today?")
      ).toBe(false);
    });
  });

  describe("execute", () => {
    it("executes inspection retrieval", async () => {
      const data = [{ id: "inspection-1" }];

      mocks.retrieveRelevantInspections.mockResolvedValue(data);

      const result = await inspectionTool.execute(
        "Show critical inspections"
      );

      expect(
        mocks.retrieveRelevantInspections
      ).toHaveBeenCalledOnce();

      expect(
        mocks.retrieveRelevantInspections
      ).toHaveBeenCalledWith(
        "Show critical inspections"
      );

      expect(result).toEqual({
        tool: "inspection",
        data,
      });
    });

    it("executes report retrieval", async () => {
      const data = [
        { id: "inspection-1" },
        { id: "inspection-2" },
      ];

      mocks.retrieveRelevantInspections.mockResolvedValue(data);

      const result = await inspectionTool.execute(
        "Generate inspection report"
      );

      expect(
        mocks.retrieveRelevantInspections
      ).toHaveBeenCalledWith(
        "Generate inspection report"
      );

      expect(result).toEqual({
        tool: "inspection",
        data,
      });
    });

    it("executes recent inspection retrieval", async () => {
      const data = [{ id: "latest-1" }];

      mocks.retrieveRelevantInspections.mockResolvedValue(data);

      const result = await inspectionTool.execute(
        "Show recent inspections"
      );

      expect(
        mocks.retrieveRelevantInspections
      ).toHaveBeenCalledWith(
        "Show recent inspections"
      );

      expect(result).toEqual({
        tool: "inspection",
        data,
      });
    });

    it("executes bridge inspection retrieval", async () => {
      const data = [
        {
          id: "bridge-1",
          issueType: "Bridge Deterioration",
        },
      ];

      mocks.retrieveRelevantInspections.mockResolvedValue(data);

      const result = await inspectionTool.execute(
        "Show bridge defects"
      );

      expect(
        mocks.retrieveRelevantInspections
      ).toHaveBeenCalledWith(
        "Show bridge defects"
      );

      expect(result).toEqual({
        tool: "inspection",
        data,
      });
    });

    it("propagates retrieval errors", async () => {
      mocks.retrieveRelevantInspections.mockRejectedValue(
        new Error("Database failure")
      );

      await expect(
        inspectionTool.execute("Show inspections")
      ).rejects.toThrow("Database failure");
    });
  });
});