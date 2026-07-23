import {
  db,
  documentsTable,
  documentChunksTable,
} from "@workspace/db";

import { eq } from "drizzle-orm";
export async function createDocument(
  document: typeof documentsTable.$inferInsert
) {
  const [created] = await db
    .insert(documentsTable)
    .values(document)
    .returning();

  return created;
}
export async function listDocuments() {
  return db
    .select()
    .from(documentsTable);
}
