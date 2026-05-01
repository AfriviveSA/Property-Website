import request from "supertest";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env";

const dbMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  calculation: {
    create: jest.fn()
  }
};

jest.mock("../../src/config/db", () => ({
  db: dbMock
}));

import { app } from "../../src/app";

function signToken(input: { sub: string; email: string; role: "USER" | "ADMIN"; subscription_status: "FREE" | "SUBSCRIBED" }) {
  return jwt.sign(input, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("admin access + usage limits", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("admin user can calculate without usage decrement", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: 1,
      role: "ADMIN",
      subscription_status: "FREE",
      free_uses_remaining: 0
    });
    dbMock.calculation.create.mockResolvedValue({
      id: 20
    });

    const token = signToken({
      sub: "1",
      email: "admin@example.com",
      role: "ADMIN",
      subscription_status: "FREE"
    });

    const res = await request(app)
      .post("/api/calculations/noi")
      .set("Authorization", `Bearer ${token}`)
      .send({
        grossMonthlyRent: 10000,
        otherMonthlyIncome: 0,
        vacancyRatePercent: 5,
        ratesAndTaxes: 500,
        levies: 500,
        insurance: 200,
        maintenance: 300,
        propertyManagement: 0,
        utilities: 0,
        admin: 0,
        otherOperatingExpenses: 0
      });

    expect(res.status).toBe(200);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  test("normal free user decrements usage", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: 2,
      role: "USER",
      subscription_status: "FREE",
      free_uses_remaining: 3
    });
    dbMock.user.update.mockResolvedValue({
      id: 2,
      free_uses_remaining: 2
    });
    dbMock.calculation.create.mockResolvedValue({ id: 30 });

    const token = signToken({
      sub: "2",
      email: "user@example.com",
      role: "USER",
      subscription_status: "FREE"
    });

    const res = await request(app)
      .post("/api/calculations/noi")
      .set("Authorization", `Bearer ${token}`)
      .send({
        grossMonthlyRent: 10000,
        otherMonthlyIncome: 0,
        vacancyRatePercent: 5,
        ratesAndTaxes: 500,
        levies: 500,
        insurance: 200,
        maintenance: 300,
        propertyManagement: 0,
        utilities: 0,
        admin: 0,
        otherOperatingExpenses: 0
      });

    expect(res.status).toBe(200);
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { free_uses_remaining: 2 }
    });
  });

  test("normal free user is blocked when uses are exhausted", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: 3,
      role: "USER",
      subscription_status: "FREE",
      free_uses_remaining: 0
    });

    const token = signToken({
      sub: "3",
      email: "user2@example.com",
      role: "USER",
      subscription_status: "FREE"
    });

    const res = await request(app)
      .post("/api/calculations/noi")
      .set("Authorization", `Bearer ${token}`)
      .send({
        grossMonthlyRent: 10000,
        otherMonthlyIncome: 0,
        vacancyRatePercent: 5,
        ratesAndTaxes: 500,
        levies: 500,
        insurance: 200,
        maintenance: 300,
        propertyManagement: 0,
        utilities: 0,
        admin: 0,
        otherOperatingExpenses: 0
      });

    expect(res.status).toBe(402);
    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(dbMock.calculation.create).not.toHaveBeenCalled();
  });

  test("requireAdmin blocks normal users", async () => {
    const token = signToken({
      sub: "4",
      email: "normal@example.com",
      role: "USER",
      subscription_status: "SUBSCRIBED"
    });

    const res = await request(app).get("/api/admin/status").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test("requireAdmin allows admin users", async () => {
    const token = signToken({
      sub: "5",
      email: "admin2@example.com",
      role: "ADMIN",
      subscription_status: "SUBSCRIBED"
    });

    const res = await request(app).get("/api/admin/status").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Admin access granted/i);
  });
});
