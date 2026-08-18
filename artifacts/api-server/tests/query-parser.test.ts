import { describe, expect, it } from "vitest";
import { parseQuery } from "../src/lib/ai/retriever/query-parser";

describe("parseQuery", () => {
  it("detects issue type from synonyms", () => {
    expect(parseQuery("Find bridge damage")).toMatchObject({
      issueType: "Bridge Deterioration",
    });

    expect(parseQuery("Find blocked drains")).toMatchObject({
      issueType: "Drainage",
    });

    expect(parseQuery("Show structural damage to columns")).toMatchObject({
      issueType: "Structural Damage",
    });

    expect(parseQuery("Find bridge deck cracks")).toMatchObject({
      issueType: "Bridge Deterioration",
    });
  });

  it("detects status", () => {
    expect(parseQuery("Show active inspections")).toMatchObject({
      status: "Active",
    });
  });

  it("detects severity", () => {
    expect(parseQuery("Show critical inspections")).toMatchObject({
      severity: "Critical",
    });

    expect(parseQuery("Show high severity issues")).toMatchObject({
      severity: "High",
    });

    expect(parseQuery("Show medium severity issues")).toMatchObject({
      severity: "Medium",
    });

    expect(parseQuery("Show low severity issues")).toMatchObject({
      severity: "Low",
    });
  });

  it("detects latest and recent requests", () => {
    expect(parseQuery("Show the latest inspections")).toMatchObject({
      latest: true,
    });

    expect(parseQuery("Show recent bridge inspections")).toMatchObject({
      latest: true,
    });
  });

  it("detects report requests", () => {
    expect(parseQuery("Generate an inspection report")).toMatchObject({
      report: true,
    });

    expect(parseQuery("Give me a summary")).toMatchObject({
      report: true,
    });

    expect(parseQuery("Show the audit")).toMatchObject({
      report: true,
    });
  });

  it("combines multiple filters", () => {
    expect(
      parseQuery(
        "Show the latest critical active pavement inspections"
      )
    ).toEqual({
      issueType: "Pavement Distress",
      status: "Active",
      severity: "Critical",
      latest: true,
      report: undefined,
    });
  });

  it("returns empty filters for an unrelated question", () => {
    expect(parseQuery("What is the weather today?")).toEqual({});
  });

  it("is case insensitive", () => {
    expect(
      parseQuery("SHOW CRITICAL BRIDGE INSPECTIONS")
    ).toMatchObject({
      issueType: "Bridge Deterioration",
      severity: "Critical",
    });
  });
});
