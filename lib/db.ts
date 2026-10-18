import "server-only";

import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "@/generated/prisma/client";

// Singleton so hot reload in development does not exhaust the connection pool.
// Convention: always `import { db } from "@/lib/db"`.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in the SQL Server connection string.",
    );
  }

  // PrismaMssql accepts the `sqlserver://` form and normalizes it internally.
  return new PrismaClient({ adapter: new PrismaMssql(connectionString) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
