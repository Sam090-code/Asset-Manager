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

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  status: text("status").notNull().default("active"),
  role: text("role").notNull().default("user"),
  pdfsGenerated: integer("pdfs_generated").notNull().default(0),
  filesCompressed: integer("files_compressed").notNull().default(0),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
