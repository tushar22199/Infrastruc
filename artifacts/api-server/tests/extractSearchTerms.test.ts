import { describe, expect, it } from "vitest";
import { extractSearchTerms } from "../src/lib/knowledge/retriever.ts";

describe("extractSearchTerms", () => {
  it("extracts keywords from a normal engineering query", () => {
    const result = extractSearchTerms(
      "According to IS 456, what is M20 concrete?"
    );

    expect(result.keywords).toContain("m20");
    expect(result.keywords).toContain("concrete");

    // Pure numeric tokens are intentionally ignored.
    expect(result.keywords).not.toContain("456");

    expect(result.keywords).not.toContain("what");
    expect(result.keywords).not.toContain("according");
  });

  it("extracts useful phrases", () => {
    const result = extractSearchTerms(
      "According to IS 456 what is M20 concrete"
    );

    expect(result.phrases).toContain("m20 concrete");
  });

  it("removes duplicate keywords", () => {
    const result = extractSearchTerms(
      "M20 M20 M20 concrete concrete"
    );

    expect(result.keywords).toEqual(["m20", "concrete"]);
  });

  it("ignores punctuation", () => {
    const result = extractSearchTerms(
      "Fe500, concrete; M20."
    );

    expect(result.keywords).toContain("fe500");
    expect(result.keywords).toContain("concrete");
    expect(result.keywords).toContain("m20");
  });

  it("does not keep pure numeric keywords", () => {
    const result = extractSearchTerms(
      "123 456 789"
    );

    expect(result.keywords).toEqual([]);
  });

  it("returns empty arrays for an empty string", () => {
    expect(extractSearchTerms("")).toEqual({
      keywords: [],
      phrases: [],
    });
  });

  it("filters phrases beginning with stop words", () => {
    const result = extractSearchTerms(
      "What is concrete strength"
    );

    expect(result.phrases).not.toContain("what is");
    expect(result.phrases).not.toContain("is concrete");
  });

  it("keeps meaningful engineering phrases", () => {
    const result = extractSearchTerms(
      "permissible shear stress in concrete"
    );

    expect(result.phrases).toContain("shear stress");
    expect(result.phrases).toContain("stress in concrete");
  });
});