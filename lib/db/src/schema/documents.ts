import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { usersTable } from "./auth";
export const documentCategoryEnum = pgEnum("document_category", [
  "Standard",
  "Project Document",
  "Report",
  "Manual",
  "Drawing",
  "Other",
]);
export const documentsTable = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),

  title: varchar("title", { length: 255 }).notNull(),

  fileName: varchar("file_name", { length: 255 }).notNull(),

  fileType: varchar("file_type", { length: 50 }).notNull(),

  category: documentCategoryEnum("category")
    .default("Other")
    .notNull(),
  uploadedBy: varchar("uploaded_by")
    .notNull()
    .references(() => usersTable.id),

  fileSize: integer("file_size").notNull(),

  storagePath: text("storage_path").notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  });
export const documentChunksTable = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    documentId: uuid("document_id")
      .notNull()
      .references(() => documentsTable.id, {
        onDelete: "cascade",
      }),

    chunkIndex: integer("chunk_index").notNull(),

    pageNumber: integer("page_number"),

    content: text("content").notNull(),
    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
    },
    (table) => ({
    documentIdx: index("document_chunks_document_idx").on(
      table.documentId
    ),
    })
    );