import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/knowledge/embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]),
}));

vi.mock("../src/lib/knowledge/repository", () => ({
  searchSimilarChunks: vi.fn(),
  searchKeywordChunks: vi.fn(),
  getNeighborChunks: vi.fn(),
}));

import {
  searchSimilarChunks,
  searchKeywordChunks,
  getNeighborChunks,
} from "../src/lib/knowledge/repository";
import { retrieveContext } from "../src/lib/knowledge/retriever";

describe("standard-aware retrieval", () => {
  it("prioritizes the explicitly requested IS standard", async () => {
    vi.mocked(searchSimilarChunks).mockResolvedValue([
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
    ] as any);

    vi.mocked(searchKeywordChunks).mockResolvedValue([]);

    vi.mocked(getNeighborChunks).mockImplementation(
      async (documentId: string) => {
        if (documentId === "doc-456") {
          return [
            {
              id: "is456",
              document_id: "doc-456",
              documentTitle:
                "IS 456:2000 Plain and Reinforced Concrete",
              chunk_index: 1,
              content: "Concrete cover provisions.",
            },
          ];
        }

        return [];
      },
    );

    const result = await retrieveContext(
      "According to IS 456, what is the minimum concrete cover?"
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].documentTitle).toContain("IS 456");
  });
});
