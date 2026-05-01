import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { db } from "../config/db.js";
import { env } from "../config/env.js";
import type { AuthJwtPayload } from "../middleware/auth.js";

export const authRoutes = Router();

authRoutes.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: "Email already in use" });
  const password_hash = await bcrypt.hash(password, 10);
  const confirmation_token = crypto.randomUUID();
  const user = await db.user.create({ data: { email, name, password_hash, confirmation_token } });
  console.log(`Confirm email for ${email}: ${env.FRONTEND_URL}/confirm-email/${confirmation_token}`);
  return res.status(201).json({ id: user.id, email: user.email, message: "Registered. Please confirm your email." });
});

authRoutes.get("/confirm-email/:token", async (req, res) => {
  const { token } = req.params;
  const user = await db.user.findFirst({ where: { confirmation_token: token } });
  if (!user) return res.status(400).json({ message: "Invalid token" });
  await db.user.update({ where: { id: user.id }, data: { email_confirmed: true, confirmation_token: null } });
  return res.json({ message: "Email confirmed" });
});

authRoutes.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  if (!user.email_confirmed) {
    return res.status(403).json({ message: "Email address not confirmed. Please confirm your email first." });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });
  const payload: AuthJwtPayload = {
    sub: String(user.id),
    email: user.email,
    role: user.role,
    subscription_status: user.subscription_status
  };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionStatus: user.subscription_status,
      freeUsesRemaining: user.free_uses_remaining
    }
  });
});

authRoutes.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthJwtPayload;
    const user = await db.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionStatus: user.subscription_status,
      freeUsesRemaining: user.free_uses_remaining,
      emailConfirmed: user.email_confirmed
    });
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
});
