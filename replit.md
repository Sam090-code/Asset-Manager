# DocuFlow — Image-to-PDF Converter & Smart File Compressor

A web-based productivity tool for converting images to PDF and compressing files, built for students, professionals, and businesses.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/pdf-converter run dev` — run the React frontend (port 24865)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, pdf-lib (client-side PDF generation), @dnd-kit (drag-and-drop), framer-motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Compression: Sharp (image), Ghostscript (PDF)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/stats.ts` — platform stats + compression jobs tables
- `artifacts/api-server/src/routes/compress.ts` — file compression route (multer + sharp)
- `artifacts/api-server/src/routes/stats.ts` — platform statistics route
- `artifacts/pdf-converter/src/` — React frontend (pages: Home/converter, /compress, /about)

## Architecture decisions

- PDF generation is entirely client-side using `pdf-lib` — no server roundtrip, instant conversion
- Image compression uses Sharp (Node.js) server-side for reliable quality control
- PDF compression uses Ghostscript with quality presets (screen/ebook/printer) mapping to low/balanced/maximum
- Compressed files are stored in `/tmp` with 30-minute expiry — no permanent storage needed
- WEBP images are converted to PNG via canvas before pdf-lib embedding (pdf-lib doesn't support WEBP)
- Stats are tracked in a single-row `platform_stats` table, upserted on each compression job

## Product

- **Image to PDF**: Upload JPG/PNG/WEBP images, reorder via drag-and-drop, rotate, choose page size/orientation/margins, convert to PDF in-browser
- **File Compressor**: Upload JPG/PNG/PDF, choose compression level (low/balanced/maximum), server compresses, shows before/after size comparison, download optimized file
- **Stats widget**: Live counts of PDFs generated, files compressed, and total data saved

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` after changing `lib/db/src/schema/` before typechecking api-server
- After OpenAPI spec changes, run `pnpm --filter @workspace/api-spec run codegen` before using types
- pdf-lib max version is `1.17.1` (not 1.17.5 — that version doesn't exist)
- Multer is used with `memoryStorage()` — files are held in memory, not written to disk during upload
- The `CompressInput` OpenAPI schema intentionally omits the `file` binary field — it's handled via raw FormData fetch to avoid Zod lib typecheck errors with `File`/`Blob` types

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
