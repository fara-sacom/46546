import { defineConfig } from "vitest/config";

// Salla read tools mock HTTP and do not need Prisma or a test database.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/salla-read-tools.test.ts"],
  },
});
