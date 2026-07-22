import {
  db,
  documentsTable,
  documentChunksTable,
} from "@workspace/db";

import { eq } from "drizzle-orm";
export async function createDocument(
  document: typeof documentsTable.$inferInsert
) {
  const [createdDocument] = await db
    .insert(documentsTable)
    .values(document)
    .returning();

  return createdDocument;
}
export async function listDocuments() {
  return db
    .select()
    .from(documentsTable);
}