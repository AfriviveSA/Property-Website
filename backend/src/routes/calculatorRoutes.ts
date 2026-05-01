import { Router } from "express";
import { db } from "../config/db.js";
import { calculate } from "../utils/calculatorEngine.js";
import { optionalAuth, AuthRequest } from "../middleware/auth.js";
import { ZodError } from "zod";

export const calculatorRoutes = Router();

calculatorRoutes.post("/:type", optionalAuth, async (req: AuthRequest, res) => {
  const { type } = req.params;
  const input = req.body as Record<string, unknown>;
  let result;
  try {
    result = calculate(type, input);
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: "Invalid calculator inputs",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
      });
    }
    return res.status(400).json({ message: err?.message ?? "Invalid calculator request" });
  }

  if (req.userId) {
    const user = await db.user.findUnique({ where: { id: req.userId } });
    const userRole = req.userRole ?? user?.role;
    const subscriptionStatus = req.userSubscriptionStatus ?? user?.subscription_status;
    const isAdmin = userRole === "ADMIN";
    const hasUnlimitedUsage = isAdmin || subscriptionStatus === "SUBSCRIBED";

    if (user && !hasUnlimitedUsage && (user.free_uses_remaining ?? 0) <= 0) {
      return res.status(402).json({ message: "Free usage exhausted. Subscribe for R99/month." });
    }

    let freeUsesRemaining: number | null | undefined = user?.free_uses_remaining;
    if (user && !hasUnlimitedUsage) {
      freeUsesRemaining = Math.max((user.free_uses_remaining ?? 0) - 1, 0);
      await db.user.update({ where: { id: req.userId }, data: { free_uses_remaining: freeUsesRemaining } });
    }
    const saved = await db.calculation.create({
      data: { user_id: req.userId, type, input_json: JSON.stringify(input), result_json: JSON.stringify(result) }
    });
    return res.json({ id: saved.id, type, input, result, freeUsesRemaining });
  }
  return res.json({ type, input, result });
});
