import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/knowledge/embeddings", () => ({
  generateEmbedding: vi.fn(),
}));

vi.mock("../src/lib/knowledge/repository", () => ({
  searchSimilarChunks: vi.fn(),
  searchKeywordChunks: vi.fn(),
  getNeighborChunks: vi.fn(),
}));

import { generateEmbedding } from "../src/lib/knowledge/embeddings";
import {
  searchSimilarChunks,
  searchKeywordChunks,
  getNeighborChunks,
} from "../src/lib/knowledge/repository";
import { retrieveContext } from "../src/lib/knowledge/retriever";

describe("retrieveContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateEmbedding).mockResolvedValue(
      Array(1536).fill(0)
    );

    vi.mocked(getNeighborChunks).mockImplementation(
      async (documentId, chunkIndex) => [
        {
          id: `${documentId}-${chunkIndex}`,
          document_id: documentId,
          chunk_index: chunkIndex,
          content: `Neighbor content ${documentId}:${chunkIndex}`,
        },
      ]
    );
  });

  it("combines semantic and keyword retrieval results", async () => {
    vi.mocked(searchSimilarChunks).mockResolvedValue([
      {
        id: "semantic-1",
        document_id: "doc-1",
        chunk_index: 5,
        content: "M20 concrete compressive strength",
      },
    ]);

    vi.mocked(searchKeywordChunks).mockResolvedValue([
      {
        id: "keyword-1",
        document_id: "doc-1",
        chunk_index: 8,
        content: "Concrete strength requirements",
      },
    ]);

    const result = await retrieveContext(
      "What is the M20 concrete compressive strength?"
    );

    expect(generateEmbedding).toHaveBeenCalledWith(
      "What is the M20 concrete compressive strength?"
    );

    expect(searchSimilarChunks).toHaveBeenCalledWith(
      expect.any(Array),
      40
    );

    expect(searchKeywordChunks).toHaveBeenCalledWith(
      expect.arrayContaining(["m20", "concrete", "compressive", "strength"]),
      expect.any(Array),
      40
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it("expands selected chunks with neighboring chunks", async () => {
    vi.mocked(searchSimilarChunks).mockResolvedValue([
      {
        id: "chunk-1",
        document_id: "doc-1",
        chunk_index: 10,
        content: "Target engineering content",
      },
    ]);

    vi.mocked(searchKeywordChunks).mockResolvedValue([]);

    vi.mocked(getNeighborChunks).mockResolvedValue([
      {
        id: "chunk-9",
        document_id: "doc-1",
        chunk_index: 9,
        content: "Previous context",
      },
      {
        id: "chunk-10",
        document_id: "doc-1",
        chunk_index: 10,
        content: "Target engineering content",
      },
      {
        id: "chunk-11",
        document_id: "doc-1",
        chunk_index: 11,
        content: "Following context",
      },
    ]);

    const result = await retrieveContext("engineering content");

    expect(getNeighborChunks).toHaveBeenCalledWith(
      "doc-1",
      10,
      1
    );

    expect(result.map((chunk) => chunk.chunk_index)).toEqual([
      9,
      10,
      11,
    ]);
  });

  it("removes duplicate expanded chunks", async () => {
    vi.mocked(searchSimilarChunks).mockResolvedValue([
      {
        id: "chunk-1",
        document_id: "doc-1",
        chunk_index: 10,
        content: "Target content",
      },
      {
        id: "chunk-2",
        document_id: "doc-1",
        chunk_index: 11,
        content: "Another target",
      },
    ]);

    vi.mocked(searchKeywordChunks).mockResolvedValue([]);

    vi.mocked(getNeighborChunks).mockResolvedValue([
      {
        id: "shared",
        document_id: "doc-1",
        chunk_index: 10,
        content: "Target content",
      },
      {
        id: "neighbor",
        document_id: "doc-1",
        chunk_index: 12,
        content: "Neighbor content",
      },
    ]);

    const result = await retrieveContext("target content");

    const keys = result.map(
      (chunk) => `${chunk.document_id}:${chunk.chunk_index}`
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not call OpenAI directly when embedding is mocked", async () => {
    vi.mocked(searchSimilarChunks).mockResolvedValue([]);
    vi.mocked(searchKeywordChunks).mockResolvedValue([]);

    const result = await retrieveContext("no matching documents");

    expect(generateEmbedding).toHaveBeenCalledOnce();
    expect(result).toEqual([]);
  });

  it("limits the final context to 12000 characters", async () => {
    vi.mocked(searchSimilarChunks).mockResolvedValue([
      {
        id: "large-1",
        document_id: "doc-1",
        chunk_index: 1,
        content: "seed",
      },
    ]);

    vi.mocked(searchKeywordChunks).mockResolvedValue([]);

    vi.mocked(getNeighborChunks).mockResolvedValue([
      {
        id: "large-1",
        document_id: "doc-1",
        chunk_index: 1,
        content: "A".repeat(5000),
      },
      {
        id: "large-2",
        document_id: "doc-1",
        chunk_index: 2,
        content: "B".repeat(5000),
      },
      {
        id: "large-3",
        document_id: "doc-1",
        chunk_index: 3,
        content: "C".repeat(5000),
      },
    ]);

    const result = await retrieveContext("large engineering document");

    const totalChars = result.reduce(
      (total, chunk) => total + chunk.content.length,
      0
    );

    expect(totalChars).toBeLessThanOrEqual(12000);
    expect(result).toHaveLength(2);
  });
  it("handles neighbor expansion at the start of a document", async () => {
    vi.mocked(searchSimilarChunks).mockResolvedValue([
      {
        id: "first",
        document_id: "doc-1",
        chunk_index: 0,
        content: "First chunk",
      },
    ]);

    vi.mocked(searchKeywordChunks).mockResolvedValue([]);

    vi.mocked(getNeighborChunks).mockResolvedValue([
      {
        id: "first",
        document_id: "doc-1",
        chunk_index: 0,
        content: "First chunk",
      },
      {
        id: "second",
        document_id: "doc-1",
        chunk_index: 1,
        content: "Second chunk",
      },
    ]);

    const result = await retrieveContext("first chunk");

    expect(getNeighborChunks).toHaveBeenCalledWith(
      "doc-1",
      0,
      1
    );

    expect(result.map((chunk) => chunk.chunk_index)).toEqual([
      0,
      1,
    ]);
  });

  it("handles neighbor expansion at the end of a document", async () => {
    vi.mocked(searchSimilarChunks).mockResolvedValue([
      {
        id: "last",
        document_id: "doc-1",
        chunk_index: 99,
        content: "Last chunk",
      },
    ]);

    vi.mocked(searchKeywordChunks).mockResolvedValue([]);

    vi.mocked(getNeighborChunks).mockResolvedValue([
      {
        id: "previous",
        document_id: "doc-1",
        chunk_index: 98,
        content: "Previous chunk",
      },
      {
        id: "last",
        document_id: "doc-1",
        chunk_index: 99,
        content: "Last chunk",
      },
    ]);

    const result = await retrieveContext("last chunk");

    expect(getNeighborChunks).toHaveBeenCalledWith(
      "doc-1",
      99,
      1
    );

    expect(result.map((chunk) => chunk.chunk_index)).toEqual([
      98,
      99,
    ]);
  });
});
