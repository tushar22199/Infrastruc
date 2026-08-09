import { describe, expect, it } from "vitest";
import { rrf, rankChunks } from "../src/lib/ai/ranking";

describe("rrf", () => {
  it("gives higher scores to better ranks", () => {
    expect(rrf(1)).toBeGreaterThan(rrf(2));
    expect(rrf(2)).toBeGreaterThan(rrf(3));
  });

  it("returns the expected score", () => {
    expect(rrf(1)).toBeCloseTo(1 / 61);
    expect(rrf(10)).toBeCloseTo(1 / 70);
  });
});

describe("rankChunks", () => {
  it("prefers chunks appearing in both semantic and keyword search", () => {
    const semantic = [
      {
        id: "a",
        chunk_index: 1,
        content: "M20 concrete",
      },
      {
        id: "b",
        chunk_index: 2,
        content: "Random text",
      },
    ];

    const keyword = [
      {
        id: "a",
        chunk_index: 1,
        content: "M20 concrete",
      },
    ];

    const ranked = rankChunks(
      semantic,
      keyword,
      ["m20", "concrete"],
      ["m20 concrete"]
    );

    expect(ranked[0].id).toBe("a");
  });

  it("keeps semantic-only chunks", () => {
    const semantic = [
      {
        id: "only",
        chunk_index: 1,
        content: "Beam design",
      },
    ];

    const ranked = rankChunks(
      semantic,
      [],
      ["beam"],
      []
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].id).toBe("only");
  });

  it("keeps keyword-only chunks", () => {
    const keyword = [
      {
        id: "only",
        chunk_index: 1,
        content: "Beam design",
      },
    ];

    const ranked = rankChunks(
      [],
      keyword,
      ["beam"],
      []
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].id).toBe("only");
  });

  it("applies lexical bonus for exact phrase matches", () => {
    const ranked = rankChunks(
      [
        {
          id: "a",
          chunk_index: 1,
          content: "M20 concrete is commonly used.",
        },
      ],
      [],
      ["m20", "concrete"],
      ["m20 concrete"]
    );

    expect(ranked[0].score).toBeGreaterThan(rrf(1) * 0.7);
  });
});