import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "test.db");
if (existsSync(dbPath)) unlinkSync(dbPath);

process.env.DATABASE_URL = `file:${dbPath}`;
process.env.VITEST = "true";
// Force every external integration off by default so tests exercise the
// permission engine's real, honest failure path instead of hitting the network.
delete process.env.SALLA_ACCESS_TOKEN;
delete process.env.WHATSAPP_ACCESS_TOKEN;
delete process.env.ANTHROPIC_API_KEY;

// No --skip-generate: the schema has grown across many commits (OrderDraft,
// CustomerContext, Conversation.escalated, ...), and `db push` regenerating
// the Prisma Client here means the test suite is self-sufficient even if
// `npx prisma generate` was never re-run after the last `npm install` -
// a stale generated client against a newer schema otherwise fails with
// confusing "Prisma SQLite schema" errors that have nothing to do with the
// schema file itself being wrong.
execSync("npx prisma db push --accept-data-loss", {
  stdio: "inherit",
  env: process.env,
  cwd: path.resolve(__dirname, ".."),
});
