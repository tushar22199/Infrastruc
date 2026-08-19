import { describe, expect, it } from "vitest";
import { rankStandardAwareChunks } from "../src/lib/ai/standard-aware-ranking";

describe("standard-aware ranking", () => {
  it("prioritizes the explicitly requested IS standard", () => {
    const semanticChunks = [
      {
        id: "is800",
        document_id: "doc-800",
        documentTitle: "IS 800:2007 General Construction in Steel",
        chunk_index: 1,
        content: "Steel design provisions.",
      },
      {
        id: "is456",
        document_id: "doc-456",
        documentTitle: "IS 456:2000 Plain and Reinforced Concrete",
        chunk_index: 1,
        content: "Concrete cover provisions.",
      },
    ];

    const result = rankStandardAwareChunks(
      semanticChunks,
      [],
      [],
      [],
      "According to IS 456, what is the minimum concrete cover?"
    );

    expect(result[0].documentTitle).toContain("IS 456");
  });

  it("prioritizes the relevant Table 5 chunk", () => {
    const semanticChunks = [
      {
        id: "unrelated",
        document_id: "doc-456",
        documentTitle: "IS 456:2000 Plain and Reinforced Concrete",
        chunk_index: 68,
        content: "Reinforcement and storage of materials.",
      },
      {
        id: "table-5",
        document_id: "doc-456",
        documentTitle: "IS 456:2000 Plain and Reinforced Concrete",
        chunk_index: 96,
        content:
          "Table 5 Minimum Cement Content, Maximum Water-Cement Ratio and Minimum Grade of Concrete for Different Exposures. Mild reinforced concrete M20.",
      },
    ];

    const keywordChunks = [
      {
        id: "table-5",
        document_id: "doc-456",
        documentTitle: "IS 456:2000 Plain and Reinforced Concrete",
        chunk_index: 96,
        content:
          "Table 5 Minimum Cement Content, Maximum Water-Cement Ratio and Minimum Grade of Concrete for Different Exposures. Mild reinforced concrete M20.",
      },
    ];

    const result = rankStandardAwareChunks(
      semanticChunks,
      keywordChunks,
      ["minimum", "grade", "concrete"],
      ["minimum grade", "grade of concrete"],
      "According to IS 456, what is the minimum grade of concrete?"
    );

    expect(result[0].id).toBe("table-5");
    expect(result[0].content).toContain("M20");
  });
});
