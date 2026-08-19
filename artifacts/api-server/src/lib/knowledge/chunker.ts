import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 300,
});

export type DocumentChunk = {
  content: string;
  pageNumber: number;
};

export async function chunkText(
  text: string,
  pageNumber: number
): Promise<DocumentChunk[]> {
  const chunks = await splitter.splitText(text);

  return chunks.map((content) => ({
    content,
    pageNumber,
  }));
}