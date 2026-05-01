import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { SubscriptionStatus, UserRole } from "@prisma/client";
import { env } from "../config/env.js";

export interface AuthJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  subscription_status: SubscriptionStatus;
}

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
  userRole?: UserRole;
  userSubscriptionStatus?: SubscriptionStatus;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthJwtPayload;
    req.userId = Number(payload.sub);
    req.userEmail = payload.email;
    req.userRole = payload.role;
    req.userSubscriptionStatus = payload.subscription_status;
    console.log(`[auth] userId=${req.userId} ${req.method} ${req.path}`);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden: admin access required" });
  }
  next();
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthJwtPayload;
    req.userId = Number(payload.sub);
    req.userEmail = payload.email;
    req.userRole = payload.role;
    req.userSubscriptionStatus = payload.subscription_status;
  } catch {
    req.userId = undefined;
    req.userEmail = undefined;
    req.userRole = undefined;
    req.userSubscriptionStatus = undefined;
  }
  next();
}

export const authRequired = requireAuth;
