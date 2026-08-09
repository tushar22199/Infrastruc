import { describe, expect, it } from "vitest";
import { normalizePdfText } from "../src/lib/knowledge/normalize.ts";

describe("normalizePdfText", () => {
  it("normalizes duplicated M grades", () => {
    expect(normalizePdfText("M2020")).toBe("M20");
  });

  it("normalizes spaced M grades", () => {
    expect(normalizePdfText("M 20 20")).toBe("M20");
  });

  it("normalizes duplicated Fe grades", () => {
    expect(normalizePdfText("Fe500500")).toBe("Fe500");
  });

  it("normalizes spaced Fe grades", () => {
    expect(normalizePdfText("Fe 500 500")).toBe("Fe500");
  });

  it("collapses multiple spaces", () => {
    expect(normalizePdfText("Hello     World")).toBe("Hello World");
  });

  it("removes spaces before punctuation", () => {
    expect(normalizePdfText("Hello . World")).toBe("Hello. World");
  });

  it("normalizes Windows line endings", () => {
    expect(normalizePdfText("A\r\nB")).toBe("A\nB");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizePdfText("   Hello World   ")).toBe("Hello World");
  });
});