import { prisma } from "../db.js";

/** Always returns the single settings row, creating it with defaults on first use. */
export async function getPlatformSettings() {
  return prisma.platformSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}
