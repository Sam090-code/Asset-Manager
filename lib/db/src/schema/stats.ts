import {
  pgTable,
  serial,
  integer,
  bigint,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const platformStatsTable = pgTable("platform_stats", {
  id: serial("id").primaryKey(),
  pdfsGenerated: integer("pdfs_generated").notNull().default(0),
  filesCompressed: integer("files_compressed").notNull().default(0),
  totalBytesCompressed: bigint("total_bytes_compressed", { mode: "number" }).notNull().default(0),
});

export const compressionJobsTable = pgTable("compression_jobs", {
  id: serial("id").primaryKey(),
  fileId: text("file_id").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  originalSize: integer("original_size").notNull(),
  compressedSize: integer("compressed_size").notNull(),
  compressionRatio: integer("compression_ratio").notNull(),
  level: text("level").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversionHistoryTable = pgTable("conversion_history", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  type: text("type").notNull(), // 'pdf' | 'compression'
  fileName: text("file_name").notNull(),
  originalSize: integer("original_size"),
  compressedSize: integer("compressed_size"),
  compressionRatio: integer("compression_ratio"),
  pageCount: integer("page_count"),
  mimeType: text("mime_type"),
  level: text("level"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  status: text("status").notNull().default("active"),
  role: text("role").notNull().default("user"),
  pdfsGenerated: integer("pdfs_generated").notNull().default(0),
  filesCompressed: integer("files_compressed").notNull().default(0),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
