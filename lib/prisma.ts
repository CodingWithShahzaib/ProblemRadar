import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getSqliteDbPath() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) {
    throw new Error("Only file: SQLite DATABASE_URL is supported in this MVP.");
  }
  const rawPath = url.replace(/^file:/, "");
  return path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: getSqliteDbPath() }),
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

