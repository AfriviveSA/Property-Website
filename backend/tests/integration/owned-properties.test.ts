import request from "supertest";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env";

const sendInvoiceEmailMock = jest.fn();
jest.mock("../../src/services/emailService", () => ({
  sendInvoiceEmail: (...args: any[]) => sendInvoiceEmailMock(...args)
}));

jest.mock("pdfmake", () => {
  return function PdfPrinterMock() {
    return {
      createPdfKitDocument: () => {
        let stream: any;
        return {
          pipe: (s: any) => {
            stream = s;
          },
          end: () => {
            if (stream?.emit) stream.emit("finish");
          }
        };
      }
    };
  };
});

const dbMock = {
  $transaction: async (fn: any) => fn(dbMock),
  property: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  tenant: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  lease: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn()
  },
  propertyIncome: {
    create: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn()
  },
  propertyExpense: {
    create: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn()
  },
  invoice: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn()
  },
  recurringInvoiceRule: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn()
  },
  invoiceLineItem: {},
  propertyDocument: {
    findMany: jest.fn()
  },
  calculation: {
    findFirst: jest.fn(),
    update: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  }
};

jest.mock("../../src/config/db", () => ({ db: dbMock }));
import { app } from "../../src/app";

function signToken() {
  return jwt.sign({ sub: "1", email: "user@example.com", role: "USER", subscription_status: "FREE" }, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("Owned properties phase 5", () => {
  const token = signToken();
  beforeEach(() => {
    jest.clearAllMocks();
    sendInvoiceEmailMock.mockResolvedValue({ ok: true, message: "sent" });
  });

  test("creating a property", async () => {
    dbMock.property.create.mockResolvedValue({ id: 10, name: "Test Property" });
    const res = await request(app).post("/api/properties").set("Authorization", `Bearer ${token}`).send({
      name: "Test Property",
      propertyType: "HOUSE",
      addressLine1: "1 Main",
      city: "Cape Town",
      province: "Western Cape",
      purchasePrice: 1000000
    });
    expect(res.status).toBe(201);
  });

  test("GET /api/properties returns expected shape", async () => {
    dbMock.property.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/properties").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("properties");
    expect(Array.isArray(res.body.properties)).toBe(true);
    expect(res.body).toHaveProperty("summary");
  });

  test("user cannot access another user's property", async () => {
    dbMock.property.findFirst.mockResolvedValue(null);
    const res = await request(app).get("/api/properties/999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("adding tenant", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: 11, userId: 1 });
    dbMock.tenant.create.mockResolvedValue({ id: 200 });
    const res = await request(app).post("/api/properties/11/tenants").set("Authorization", `Bearer ${token}`).send({
      firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: "0820000000"
    });
    expect(res.status).toBe(201);
  });

  test("adding lease", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: 11, userId: 1 });
    dbMock.tenant.findFirst.mockResolvedValue({ id: 200, propertyId: null });
    dbMock.tenant.update.mockResolvedValue({ id: 200, propertyId: 11 });
    dbMock.lease.create.mockResolvedValue({ id: 300 });
    const res = await request(app).post("/api/properties/11/leases").set("Authorization", `Bearer ${token}`).send({
      tenantId: 200, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: 12000, depositAmount: 12000
    });
    expect(res.status).toBe(201);
  });

  test("link existing tenant to property", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: 11, userId: 1 });
    dbMock.tenant.findFirst.mockResolvedValue({ id: 200, userId: 1, propertyId: null });
    dbMock.lease.findFirst.mockResolvedValue(null);
    dbMock.tenant.update.mockResolvedValue({ id: 200, propertyId: 11, status: "ACTIVE" });
    const res = await request(app).patch("/api/properties/11/tenants/200/link").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(200);
  });

  test("cannot unlink tenant while current lease exists", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: 11, userId: 1 });
    dbMock.tenant.findFirst.mockResolvedValue({ id: 200, userId: 1, propertyId: 11 });
    dbMock.lease.findFirst.mockResolvedValue({ id: 300, status: "ACTIVE" });
    const res = await request(app).patch("/api/properties/11/tenants/200/unlink").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  test("tenant cannot be moved while active lease exists", async () => {
    dbMock.tenant.findFirst.mockResolvedValue({ id: 200, userId: 1, propertyId: 11, firstName: "A", lastName: "B", leases: [] });
    dbMock.lease.findFirst.mockResolvedValue({ id: 300, propertyId: 11, status: "ACTIVE" });
    const res = await request(app).put("/api/tenants/200").set("Authorization", `Bearer ${token}`).send({ propertyId: 99 });
    expect(res.status).toBe(400);
  });

  test("dashboard summary works with no properties", async () => {
    dbMock.property.findMany.mockResolvedValue([]);
    dbMock.propertyIncome.findMany.mockResolvedValue([]);
    dbMock.propertyExpense.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/properties/dashboard-summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalProperties).toBe(0);
  });

  test("dashboard summary excludes vacant land from occupancy denominator", async () => {
    dbMock.property.findMany.mockResolvedValue([
      { id: 1, name: "Land", investmentType: "VACANT_LAND", currentEstimatedValue: 100, outstandingBondBalance: 50, purchasePrice: 100, monthlyBondPayment: 0, leases: [], tenants: [], invoices: [], documents: [] },
      { id: 2, name: "Rental", investmentType: "LONG_TERM_RENTAL", currentEstimatedValue: 100, outstandingBondBalance: 0, purchasePrice: 100, monthlyBondPayment: 0, leases: [], tenants: [], invoices: [], documents: [] }
    ]);
    // month and 12-month ranges
    dbMock.propertyIncome.findMany.mockResolvedValue([]); // used twice
    dbMock.propertyExpense.findMany.mockResolvedValue([]); // used twice
    const res = await request(app).get("/api/properties/dashboard-summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tenantRequiredProperties).toBe(1);
    expect(res.body.occupiedProperties).toBe(0);
    expect(res.body.occupancyRate).toBe(0);
  });

  test("dashboard summary includes vacant land in total value and equity", async () => {
    dbMock.property.findMany.mockResolvedValue([
      { id: 1, name: "Land", investmentType: "VACANT_LAND", currentEstimatedValue: 200, outstandingBondBalance: 50, purchasePrice: 100, monthlyBondPayment: 0, leases: [], tenants: [], invoices: [], documents: [] }
    ]);
    dbMock.propertyIncome.findMany.mockResolvedValue([]);
    dbMock.propertyExpense.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/properties/dashboard-summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalCurrentEstimatedValue).toBe(200);
    expect(res.body.totalOutstandingBondBalance).toBe(50);
    expect(res.body.portfolioEquity).toBe(150);
  });

  test("dashboard summary NOI excludes debt service (bond payments)", async () => {
    dbMock.property.findMany.mockResolvedValue([
      { id: 1, name: "Rental", investmentType: "LONG_TERM_RENTAL", currentEstimatedValue: 1000, outstandingBondBalance: 0, purchasePrice: 1000, monthlyBondPayment: 500, leases: [], tenants: [], invoices: [], documents: [] }
    ]);
    // For the endpoint we call income.findMany twice and expense.findMany twice. Return 12-month data where:
    // income = 12000, operating expenses = 2400, bond expense entries = 6000, plus monthlyBondPayment estimate is ignored for NOI.
    dbMock.propertyIncome.findMany
      .mockResolvedValueOnce([]) // month
      .mockResolvedValueOnce([{ amount: 12000, incomeDate: new Date(), propertyId: 1 }]); // 12 months
    dbMock.propertyExpense.findMany
      .mockResolvedValueOnce([]) // month
      .mockResolvedValueOnce([
        { amount: 2400, category: "RATES_TAXES", expenseDate: new Date(), propertyId: 1 },
        { amount: 6000, category: "BOND_PAYMENT", expenseDate: new Date(), propertyId: 1 }
      ]); // 12 months

    const res = await request(app).get("/api/properties/dashboard-summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.annualNOI).toBe(12000 - 2400);
  });

  test("dashboard summary handles short-term rental metrics", async () => {
    dbMock.property.findMany.mockResolvedValue([
      {
        id: 1,
        name: "STR",
        investmentType: "SHORT_TERM_RENTAL",
        currentEstimatedValue: 1000,
        outstandingBondBalance: 0,
        purchasePrice: 1000,
        monthlyBondPayment: 0,
        averageDailyRate: 1000,
        occupancyRate: 0.5,
        availableNightsPerMonth: 20,
        platformFeePercent: 10,
        managementFeePercent: 0,
        cleaningFeesMonthly: 0,
        leases: [],
        tenants: [],
        invoices: [],
        documents: []
      }
    ]);
    dbMock.propertyIncome.findMany.mockResolvedValue([]);
    dbMock.propertyExpense.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/properties/dashboard-summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.shortTermRentalProperties).toBe(1);
    expect(res.body.monthlyShortTermRentalRevenue).toBeGreaterThan(0);
  });

  test("dashboard summary returns all properties when no filter selected", async () => {
    dbMock.property.findMany.mockResolvedValue([
      { id: 1, name: "A", investmentType: "LONG_TERM_RENTAL", currentEstimatedValue: 100, outstandingBondBalance: 0, purchasePrice: 100, monthlyBondPayment: 0, leases: [], tenants: [], invoices: [], documents: [] },
      { id: 2, name: "B", investmentType: "VACANT_LAND", currentEstimatedValue: 100, outstandingBondBalance: 0, purchasePrice: 100, monthlyBondPayment: 0, leases: [], tenants: [], invoices: [], documents: [] }
    ]);
    dbMock.propertyIncome.findMany.mockResolvedValue([]);
    dbMock.propertyExpense.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/properties/dashboard-summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.kpis.totalProperties.value).toBe(2);
  });

  test("dashboard summary filters multiple property types", async () => {
    dbMock.property.findMany.mockResolvedValue([
      { id: 1, name: "A", investmentType: "LONG_TERM_RENTAL", currentEstimatedValue: 100, outstandingBondBalance: 0, purchasePrice: 100, monthlyBondPayment: 0, leases: [], tenants: [], invoices: [], documents: [] }
    ]);
    dbMock.propertyIncome.findMany.mockResolvedValue([]);
    dbMock.propertyExpense.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/properties/dashboard-summary?propertyTypes=LONG_TERM_RENTAL,SHORT_TERM_RENTAL").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.filters.propertyTypes).toEqual(["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL"]);
  });

  test("past fixed term end date becomes month-to-month (summary)", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    dbMock.property.findMany.mockResolvedValue([
      {
        id: 1,
        name: "P1",
        currentEstimatedValue: null,
        outstandingBondBalance: null,
        monthlyBondPayment: null,
        leases: [{ id: 10, status: "ACTIVE", fixedTermEndDate: yesterday, monthlyRent: 1000, depositAmount: 1000, tenant: {} }],
        tenants: [],
        invoices: [],
        documents: []
      }
    ]);
    dbMock.propertyIncome.findMany.mockResolvedValue([]);
    dbMock.propertyExpense.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/properties/dashboard-summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.leases.monthToMonth).toBe(1);
    expect(res.body.occupiedProperties).toBe(1);
  });

  test("cancel lease endpoint changes status to CANCELLED", async () => {
    dbMock.lease.update.mockResolvedValue({ id: 10, status: "CANCELLED", tenantId: 200 });
    dbMock.lease.findFirst
      .mockResolvedValueOnce({ id: 10, userId: 1, tenantId: 200, status: "ACTIVE" })
      .mockResolvedValueOnce(null);
    dbMock.tenant.update.mockResolvedValue({ id: 200 });
    const res = await request(app)
      .post("/api/leases/10/cancel")
      .set("Authorization", `Bearer ${token}`)
      .send({ cancellationDate: "2026-04-01", cancelledBy: "LANDLORD" });
    expect(res.status).toBe(200);
    expect(dbMock.lease.update).toHaveBeenCalled();
  });

  test("equity metrics update overwrites property values", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: 1, userId: 1 });
    dbMock.property.update.mockResolvedValue({ id: 1 });
    const res = await request(app)
      .patch("/api/properties/metrics/equity")
      .set("Authorization", `Bearer ${token}`)
      .send({ updates: [{ propertyId: 1, currentEstimatedValue: 2000000, outstandingBondBalance: 1000000 }] });
    expect(res.status).toBe(200);
    expect(dbMock.property.update).toHaveBeenCalled();
  });

  test("report generation failure returns 500 but does not affect /api/properties", async () => {
    dbMock.calculation.findFirst.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const reportRes = await request(app).post("/api/reports/1/generate").set("Authorization", `Bearer ${token}`).send({});
    expect(reportRes.status).toBe(500);

    dbMock.property.findMany.mockResolvedValue([]);
    const propsRes = await request(app).get("/api/properties").set("Authorization", `Bearer ${token}`);
    expect(propsRes.status).toBe(200);
  });

  test("adding income", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: 11, userId: 1 });
    dbMock.propertyIncome.create.mockResolvedValue({ id: 1 });
    const res = await request(app).post("/api/properties/11/income").set("Authorization", `Bearer ${token}`).send({
      category: "RENT", description: "Rent", amount: 12000, incomeDate: "2026-04-01"
    });
    expect(res.status).toBe(201);
  });

  test("adding expense", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: 11, userId: 1 });
    dbMock.propertyExpense.create.mockResolvedValue({ id: 1 });
    const res = await request(app).post("/api/properties/11/expenses").set("Authorization", `Bearer ${token}`).send({
      category: "RATES_TAXES", description: "Rates", amount: 1000, expenseDate: "2026-04-01"
    });
    expect(res.status).toBe(201);
  });

  test("financial summary calculation", async () => {
    dbMock.property.findFirst.mockResolvedValueOnce({ id: 11, userId: 1, purchasePrice: 1000000, currentEstimatedValue: 1200000, leases: [{ status: "ACTIVE" }] });
    dbMock.propertyExpense.findMany.mockResolvedValueOnce([{ amount: 1000, category: "RATES_TAXES" }]).mockResolvedValueOnce([{ amount: 1000, category: "RATES_TAXES" }]);
    dbMock.propertyIncome.findMany.mockResolvedValueOnce([{ amount: 12000, category: "RENT" }]).mockResolvedValueOnce([{ amount: 12000, category: "RENT" }]);
    dbMock.propertyIncome.groupBy.mockResolvedValue([]);
    dbMock.propertyExpense.groupBy.mockResolvedValue([]);
    const res = await request(app).get("/api/properties/11/financials/summary").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.monthly.netMonthlyCashFlow).toBe(11000);
  });

  test("invoice creation", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: 11, userId: 1 });
    dbMock.tenant.findFirst.mockResolvedValue({ id: 200 });
    dbMock.invoice.create.mockResolvedValue({ id: 500, invoiceNumber: "INV-1" });
    const res = await request(app).post("/api/properties/11/invoices").set("Authorization", `Bearer ${token}`).send({
      tenantId: 200,
      invoiceDate: "2026-04-01",
      dueDate: "2026-04-07",
      lineItems: [{ description: "Rent", quantity: 1, unitPrice: 12000, total: 12000 }]
    });
    expect(res.status).toBe(201);
  });

  test("invoice PDF generation", async () => {
    dbMock.invoice.findFirst.mockResolvedValue({
      id: 501,
      invoiceNumber: "INV-2",
      invoiceDate: new Date(),
      dueDate: new Date(),
      subtotal: 12000,
      total: 12000,
      notes: "ok",
      property: { name: "House", addressLine1: "1 Main", city: "Cape Town" },
      tenant: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
      lineItems: [{ description: "Rent", quantity: 1, unitPrice: 12000, total: 12000 }]
    });
    dbMock.invoice.update.mockResolvedValue({ id: 501 });
    const res = await request(app).post("/api/invoices/501/generate-pdf").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test("recurring invoice rule creation", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: 11, userId: 1 });
    dbMock.recurringInvoiceRule.create.mockResolvedValue({ id: 800 });
    const res = await request(app).post("/api/properties/11/recurring-invoices").set("Authorization", `Bearer ${token}`).send({
      tenantId: 200, nextRunDate: "2026-05-01", rentAmount: 12000
    });
    expect(res.status).toBe(201);
  });

  test("recurring invoice does not email unless permission confirmed", async () => {
    dbMock.recurringInvoiceRule.findMany.mockResolvedValue([
      {
        id: 1,
        propertyId: 11,
        tenantId: 200,
        leaseId: null,
        enabled: true,
        dayOfMonth: 1,
        nextRunDate: new Date("2026-04-01"),
        invoiceDescription: "Monthly Rent",
        rentAmount: 12000,
        emailTenant: true,
        tenantPermissionConfirmed: false,
        tenant: { email: "tenant@example.com" }
      }
    ]);
    dbMock.invoice.create.mockResolvedValue({ id: 910, invoiceNumber: "AUTO-1" });
    dbMock.recurringInvoiceRule.update.mockResolvedValue({ id: 1 });
    const res = await request(app).post("/api/recurring-invoices/run-due").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(200);
    expect(sendInvoiceEmailMock).not.toHaveBeenCalled();
  });
});
