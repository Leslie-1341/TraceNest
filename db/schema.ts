import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const memoryItems = sqliteTable("memory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  summary: text("summary").notNull().default(""),
  source: text("source").notNull().default("手动记录"),
  kind: text("kind").notNull().default("笔记"),
  reason: text("reason").notNull().default(""),
  tags: text("tags").notNull().default("[]"),
  project: text("project"),
  color: text("color").notNull().default("sage"),
  glyph: text("glyph").notNull().default("记"),
  status: text("status").notNull().default("inbox"),
  processingStatus: text("processing_status").notNull().default("ready"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
