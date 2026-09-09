import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { syncToolRegistry } from "./agent/toolRegistry.js";
import { healthRouter } from "./routes/health.js";
import { toolsRouter } from "./routes/tools.js";
import { conversationsRouter } from "./routes/conversations.js";
import { chatRouter } from "./routes/chat.js";
import { actionsRouter } from "./routes/actions.js";
import { auditLogRouter } from "./routes/auditlog.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { aiServicesRouter } from "./routes/aiServices.js";
import { assetsRouter } from "./routes/assets.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.use("/api", healthRouter);
  app.use("/api", toolsRouter);
  app.use("/api", conversationsRouter);
  app.use("/api", chatRouter);
  app.use("/api", actionsRouter);
  app.use("/api", auditLogRouter);
  app.use("/api", aiServicesRouter);
  app.use("/api", assetsRouter);
  app.use(webhooksRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "خطأ غير متوقع" });
  });

  return app;
}

async function main() {
  await syncToolRegistry();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`FARA AI Agent API listening on :${env.port}`);
  });
}

if (process.env.VITEST !== "true") {
  main().catch((err) => {
    console.error("Failed to start FARA AI Agent API", err);
    process.exit(1);
  });
}
