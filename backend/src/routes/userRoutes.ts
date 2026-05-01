import { Router } from "express";
import { authRequired, AuthRequest } from "../middleware/auth.js";
import { db } from "../config/db.js";

export const userRoutes = Router();

userRoutes.get("/reports", authRequired, async (req: AuthRequest, res) => {
  const reports = await db.calculation.findMany({
    where: { user_id: req.userId! },
    orderBy: { created_at: "desc" },
    select: { id: true, type: true, created_at: true, pdf_path: true, result_json: true, input_json: true }
  });
  res.json(
    reports.map((r) => ({
      id: r.id,
      type: r.type,
      created_at: r.created_at,
      hasPdf: Boolean(r.pdf_path),
      downloadUrl: r.pdf_path ? `/api/reports/${r.id}` : null,
      input: JSON.parse(r.input_json),
      result: JSON.parse(r.result_json)
    }))
  );
});

userRoutes.delete("/reports/:id", authRequired, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.calculation.findFirst({ where: { id, user_id: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  await db.calculation.delete({ where: { id } });
  res.json({ message: "Deleted" });
});
