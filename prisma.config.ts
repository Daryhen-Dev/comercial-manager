import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 moved datasource configuration out of schema.prisma. Introspection
// (`prisma db pull`) and any other CLI command that reaches the database read
// the URL from here.
//
// DATABASE_URL keeps the mssql-style form used by comercial-web:
//   sqlserver://HOST;port=1433;database=BDComercial;user=USER;password=PASS;encrypt=false;trustServerCertificate=true
// @prisma/adapter-mssql strips the `sqlserver://` prefix itself, so this string
// works unchanged at runtime.
//
// Deliberately `process.env` instead of Prisma's `env()` helper: `env()` throws
// when the variable is missing, which would make `prisma generate` — and
// therefore `next build`, since lib/db.ts imports the generated client —
// impossible on a fresh clone or in CI without production credentials.
// Commands that actually connect (db pull, db studio) still fail, but at
// connection time with a clear message.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
