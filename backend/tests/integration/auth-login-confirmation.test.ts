import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../../src/config/env";

const dbMock = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn()
  }
};

jest.mock("../../src/config/db", () => ({ db: dbMock }));

import { app } from "../../src/app";

describe("Auth confirmation + admin login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("seeded admin user (confirmed) can login", async () => {
    const password_hash = await bcrypt.hash("Tiaan123", 10);
    dbMock.user.findUnique.mockResolvedValue({
      id: 100,
      email: "delangetiaan13@gmail.com",
      name: "Admin",
      password_hash,
      role: "ADMIN",
      subscription_status: "SUBSCRIBED",
      free_uses_remaining: null,
      email_confirmed: true
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "delangetiaan13@gmail.com",
      password: "Tiaan123"
    });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("ADMIN");
  });

  test("seeded admin receives JWT with ADMIN role", async () => {
    const password_hash = await bcrypt.hash("Tiaan123", 10);
    dbMock.user.findUnique.mockResolvedValue({
      id: 101,
      email: "delangetiaan13@gmail.com",
      name: "Admin",
      password_hash,
      role: "ADMIN",
      subscription_status: "SUBSCRIBED",
      free_uses_remaining: null,
      email_confirmed: true
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "delangetiaan13@gmail.com",
      password: "Tiaan123"
    });

    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.token, env.JWT_SECRET) as any;
    expect(payload.role).toBe("ADMIN");
  });

  test("normal unconfirmed users are blocked", async () => {
    const password_hash = await bcrypt.hash("User12345", 10);
    dbMock.user.findUnique.mockResolvedValue({
      id: 102,
      email: "normal@example.com",
      password_hash,
      role: "USER",
      subscription_status: "FREE",
      free_uses_remaining: 3,
      email_confirmed: false
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "normal@example.com",
      password: "User12345"
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Email address not confirmed. Please confirm your email first.");
  });

  test("normal confirmed users can login", async () => {
    const password_hash = await bcrypt.hash("User12345", 10);
    dbMock.user.findUnique.mockResolvedValue({
      id: 103,
      email: "normal2@example.com",
      password_hash,
      role: "USER",
      subscription_status: "FREE",
      free_uses_remaining: 3,
      email_confirmed: true
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "normal2@example.com",
      password: "User12345"
    });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("USER");
  });
});
