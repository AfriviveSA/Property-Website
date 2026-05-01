import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export const adminRoutes = Router();

adminRoutes.get("/status", requireAuth, requireAdmin, (_req, res) => {
  return res.json({ message: "Admin access granted" });
});
