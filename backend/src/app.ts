import express from "express";
import cors from "cors";
import { authRoutes } from "./routes/authRoutes.js";
import { calculatorRoutes } from "./routes/calculatorRoutes.js";
import { subscriptionRoutes } from "./routes/subscriptionRoutes.js";
import { reportRoutes } from "./routes/reportRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { ownedPropertiesRoutes } from "./routes/ownedPropertiesRoutes.js";
import { env } from "./config/env.js";

export const app = express();
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());

app.use((req, _res, next) => {
  const startedAt = Date.now();
  console.log(`[req] ${req.method} ${req.path}`);
  _res.on("finish", () => {
    const ms = Date.now() - startedAt;
    console.log(`[res] ${req.method} ${req.path} -> ${_res.statusCode} (${ms}ms)`);
  });
  next();
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/calculations", calculatorRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", ownedPropertiesRoutes);

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[error] ${req.method} ${req.path}`, err?.stack ?? err);
  const message = typeof err?.message === "string" ? err.message : "Internal server error";
  res.status(500).json({ message });
});
