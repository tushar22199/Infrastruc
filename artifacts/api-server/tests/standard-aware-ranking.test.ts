import { describe, expect, it } from "vitest";
import { rankStandardAwareChunks } from "../src/lib/ai/standard-aware-ranking";

describe("standard-aware ranking", () => {
  it("prioritizes the explicitly requested IS standard", () => {
    const result = rankStandardAwareChunks(
      [
        {
          id: "is800",
          documentTitle: "IS 800:2007 General Construction in Steel",
          content: "Steel design provisions.",
        },
        {
          id: "is456",
          documentTitle: "IS 456:2000 Plain and Reinforced Concrete",
          content: "Concrete cover provisions.",
        },
      ],
      [],
      [],
      [],
      "According to IS 456, what is the minimum concrete cover?",
    );

    expect(result[0].documentTitle).toContain("IS 456");
  });

  it("prioritizes Table 5 for a minimum-grade question", () => {
    const result = rankStandardAwareChunks(
      [
        {
          id: "unrelated",
          documentTitle: "IS 456:2000 Plain and Reinforced Concrete",
          content: "Reinforcement and storage of materials.",
        },
        {
          id: "table-5",
          documentTitle: "IS 456:2000 Plain and Reinforced Concrete",
          content:
            "Table 5 Minimum Cement Content, Maximum Water-Cement Ratio and Minimum Grade of Concrete for Different Exposures. Mild reinforced concrete M20.",
        },
      ],
      [
        {
          id: "table-5",
          documentTitle: "IS 456:2000 Plain and Reinforced Concrete",
          content:
            "Table 5 Minimum Cement Content, Maximum Water-Cement Ratio and Minimum Grade of Concrete for Different Exposures. Mild reinforced concrete M20.",
        },
      ],
      ["minimum", "grade", "concrete"],
      ["minimum grade", "grade of concrete"],
      "According to IS 456, what is the minimum grade of concrete?",
    );

    expect(result[0].id).toBe("table-5");
    expect(result[0].content).toContain("M20");
  });
  function applyQuestionIntentBoost(
    chunks: any[],
    question: string
  ) {
    const normalizedQuestion = question.toLowerCase();

    const isMinimumGradeQuestion =
      normalizedQuestion.includes("minimum grade") ||
      normalizedQuestion.includes("minimum grade of concrete");

    if (!isMinimumGradeQuestion) {
      return chunks;
    }

    for (const chunk of chunks) {
      const text = String(chunk.content ?? "").toLowerCase();

      let bonus = 0;

      if (text.includes("table 5")) {
        bonus += 0.08;
      }

      if (text.includes("minimum grade")) {
        bonus += 0.04;
      }

      if (text.includes("grade of concrete")) {
        bonus += 0.03;
      }

      if (/\bm\d+\b/i.test(text)) {
        bonus += 0.02;
      }

      chunk.score += bonus;
    }

    return chunks.sort((a: any, b: any) => b.score - a.score);
  }
});
