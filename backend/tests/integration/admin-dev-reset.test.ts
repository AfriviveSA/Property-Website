import request from "supertest";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env";

const dbMock: any = {};
jest.mock("../../src/config/db", () => ({ db: dbMock }));

const exportPortfolioBackupMock = jest.fn();
const resetPortfolioDataMock = jest.fn();
jest.mock("../../src/services/portfolioResetService", () => ({
  exportPortfolioBackup: (...args: any[]) => exportPortfolioBackupMock(...args),
  resetPortfolioData: (...args: any[]) => resetPortfolioDataMock(...args)
}));

jest.mock("node:fs/promises", () => ({
  mkdir: jest.fn(async () => {}),
  writeFile: jest.fn(async () => {})
}));

import { app } from "../../src/app";

function signToken(input: { sub: string; email: string; role: "USER" | "ADMIN"; subscription_status: "FREE" | "SUBSCRIBED" }) {
  return jwt.sign(input, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("admin dev reset endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
    exportPortfolioBackupMock.mockResolvedValue({ meta: { user: { id: 1, email: "u@example.com" } }, counts: {} });
    resetPortfolioDataMock.mockResolvedValue({ dryRun: true, deleted: {} });
  });

  test("blocks non-admin", async () => {
    const token = signToken({ sub: "1", email: "user@example.com", role: "USER", subscription_status: "SUBSCRIBED" });
    const res = await request(app)
      .post("/api/admin/dev/reset-portfolio-data")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "u@example.com", confirm: "RESET", dryRun: true });
    expect(res.status).toBe(403);
  });

  test("blocks in production", async () => {
    process.env.NODE_ENV = "production";
    const token = signToken({ sub: "2", email: "admin@example.com", role: "ADMIN", subscription_status: "SUBSCRIBED" });
    const res = await request(app)
      .post("/api/admin/dev/reset-portfolio-data")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "u@example.com", confirm: "RESET", dryRun: true });
    expect(res.status).toBe(403);
  });

  test("allows admin in dev/test with confirm token", async () => {
    const token = signToken({ sub: "2", email: "admin@example.com", role: "ADMIN", subscription_status: "SUBSCRIBED" });
    const res = await request(app)
      .post("/api/admin/dev/reset-portfolio-data")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "u@example.com", confirm: "RESET", dryRun: true });
    expect(res.status).toBe(200);
    expect(exportPortfolioBackupMock).toHaveBeenCalled();
    expect(resetPortfolioDataMock).toHaveBeenCalled();
  });
});

