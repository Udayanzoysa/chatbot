import express, { type Request, type Response } from "express";
import { config } from "./config";
import { pingDb, pool } from "./db/pool";
import { webhookRouter } from "./routes/webhook";

const app = express();

// Capture raw body for Meta signature verification on the webhook path
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

app.get("/health", async (_req: Request, res: Response) => {
  try {
    const ok = await pingDb();
    res.status(200).json({
      status: "ok",
      db: ok ? "up" : "down",
      channels: ["whatsapp", "messenger", "instagram"],
    });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

app.use(config.WEBHOOK_PATH, webhookRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

async function boot(): Promise<void> {
  try {
    await pingDb();
    console.log("PostgreSQL connection OK");
  } catch (err) {
    console.error("Cannot connect to PostgreSQL. Is Docker/Postgres running?", err);
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    console.log(`Sales agent listening on http://localhost:${config.PORT}`);
    console.log(`Webhook: GET/POST http://localhost:${config.PORT}${config.WEBHOOK_PATH}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down…`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void boot();
