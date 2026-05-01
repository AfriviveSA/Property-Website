import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  JWT_SECRET: process.env.JWT_SECRET ?? "unsafe-dev-secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "1d",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173"
};
