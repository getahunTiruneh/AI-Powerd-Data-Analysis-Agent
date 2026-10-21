import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import authRouter from "./src/routes/auth.js";
import profilesRouter from "./src/routes/profiles.js";
import dataMartsRouter from "./src/routes/dataMarts.js";
import conversationsRouter from "./src/routes/conversations.js";
import messagesRouter from "./src/routes/messages.js";
import assignmentsRouter from "./src/routes/assignments.js";
import adminRouter from "./src/routes/admin.js";
import notificationsRouter from "./src/routes/notifications.js";
import chatRouter from "./src/routes/chat.js";
import auditLogsRouter from "./src/routes/auditLogs.js";
import { rateLimit } from "express-rate-limit";
import compression from "compression";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(compression());
app.use(helmet({ bodyParser: { limit: '100mb' } }));
app.use(express.json({ limit: '100mb' }));

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is running 🚀" });
});

// Debug endpoint to check request
app.post("/api/debug/connection", (req, res) => {
  console.log("[DEBUG] Body:", req.body);
  console.log("[DEBUG] Headers:", req.headers.authorization?.substring(0, 30) + "...");
  res.json({ received: req.body });
});

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is missing.');
  process.exit(1);
}

// Simple test connection without db write
app.post("/api/admin/data-marts/connection/test", async (req, res) => {
  const { host, port, database, username, password } = req.body;
  try {
    const { Pool: PgPool } = await import('pg');
    const testPool = new PgPool({
      host, port: port || 5432, database, user: username, password,
      connectionTimeoutMillis: 5000
    });
    await testPool.query('SELECT 1');
    await testPool.end();
    res.json({ success: true, message: "Connection OK" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat requests. Please slow down.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.post("/api/auth/login", loginLimiter);
app.use("/api/auth", authRouter);
app.use("/api/admin/profiles", profilesRouter);
app.use("/api/admin/data-marts", dataMartsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/admin/assignments", assignmentsRouter);
app.use("/api/my", assignmentsRouter);
app.use("/api/admin/roles", profilesRouter);
app.use("/api/admin", apiLimiter, adminRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/chat", chatLimiter, chatRouter);
app.use("/api/admin/audit-logs", auditLogsRouter);

const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

async function gracefulShutdown(signal) {
  console.log(`[SERVER] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log("[SERVER] HTTP server closed.");
    try {
      const { pool } = await import("./src/services/db.js");
      if (pool && typeof pool.end === "function") {
        await pool.end();
        console.log("[SERVER] Database connection pool closed.");
      }
    } catch (err) {
      console.error("[SERVER] Error closing database connection pool:", err.message);
    }
    console.log("[SERVER] Graceful shutdown completed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[SERVER] Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
