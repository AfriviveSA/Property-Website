import { Router } from "express";
import Stripe from "stripe";
import { db } from "../config/db.js";
import { authRequired, AuthRequest } from "../middleware/auth.js";
import { env } from "../config/env.js";

export const subscriptionRoutes = Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

subscriptionRoutes.post("/checkout", authRequired, async (req: AuthRequest, res) => {
  if (!stripe) {
    return res.json({ provider: "mock", checkoutUrl: `${env.FRONTEND_URL}/subscription/success?mock=true` });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "zar",
        recurring: { interval: "month" },
        product_data: { name: "The Property Guy Monthly Subscription" },
        unit_amount: 9900
      },
      quantity: 1
    }],
    success_url: `${env.FRONTEND_URL}/subscription/success`,
    cancel_url: `${env.FRONTEND_URL}/subscription/cancel`,
    metadata: { userId: String(req.userId) }
  });
  res.json({ provider: "stripe", sessionId: session.id, checkoutUrl: session.url });
});

subscriptionRoutes.post("/webhook", async (req, res) => {
  const userId = Number(req.body.userId);
  if (!userId) return res.status(400).json({ message: "Missing userId" });
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  await db.subscription.create({
    data: { user_id: userId, start_date: start, end_date: end, status: "ACTIVE", payment_provider_id: req.body.providerId ?? "mock-provider" }
  });
  await db.user.update({
    where: { id: userId },
    data: { subscription_status: "SUBSCRIBED", subscription_start: start, subscription_end: end, free_uses_remaining: null }
  });
  res.json({ message: "Subscription updated" });
});

subscriptionRoutes.post("/cancel", authRequired, async (req: AuthRequest, res) => {
  await db.user.update({ where: { id: req.userId! }, data: { subscription_status: "FREE", free_uses_remaining: 0 } });
  res.json({ message: "Subscription cancelled." });
});
