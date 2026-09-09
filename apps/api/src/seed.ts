import { randomBytes } from "node:crypto";
import { prisma } from "./db.js";
import { hashApiKey } from "./middleware/auth.js";
import { syncToolRegistry } from "./agent/toolRegistry.js";

async function main() {
  const toolCount = await syncToolRegistry();
  console.log(`Synced ${toolCount} tools into the tool registry.`);

  const existingAdmin = await prisma.staffUser.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) {
    console.log(`An ADMIN staff user already exists (${existingAdmin.email}). Skipping key creation.`);
    return;
  }

  const apiKey = `fara_${randomBytes(24).toString("hex")}`;
  const admin = await prisma.staffUser.create({
    data: {
      name: "FARA Store Owner",
      email: "algdhuu05@gmail.com",
      role: "ADMIN",
      apiKeyHash: hashApiKey(apiKey),
    },
  });

  console.log("\n=== FARA AI Agent: first admin created ===");
  console.log(`Name:  ${admin.name}`);
  console.log(`Email: ${admin.email}`);
  console.log(`API Key (save this now - it is not stored anywhere in plain text): ${apiKey}`);
  console.log("Use it as the X-FARA-Staff-Key header for every dashboard/API request.\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
