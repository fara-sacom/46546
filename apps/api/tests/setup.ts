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

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  stdio: "inherit",
  env: process.env,
  cwd: path.resolve(__dirname, ".."),
});
