import { assertPortfolioResetAllowed } from "../../src/utils/portfolioResetGuards";
import { exportPortfolioBackup, resetPortfolioData } from "../../src/services/portfolioResetService";

function makePrismaMock(overrides: any = {}) {
  const tx: any = {};
  Object.assign(tx, {
    invoiceLineItem: { deleteMany: jest.fn(), count: jest.fn() },
    invoice: { deleteMany: jest.fn(), findMany: jest.fn() },
    recurringInvoiceRule: { deleteMany: jest.fn(), findMany: jest.fn() },
    recurringIncomeRule: { deleteMany: jest.fn(), findMany: jest.fn() },
    propertyIncome: { deleteMany: jest.fn(), findMany: jest.fn() },
    propertyExpense: { deleteMany: jest.fn(), findMany: jest.fn() },
    propertyDocument: { deleteMany: jest.fn(), findMany: jest.fn() },
    lease: { deleteMany: jest.fn(), findMany: jest.fn() },
    tenant: { deleteMany: jest.fn(), findMany: jest.fn() },
    property: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: any): Promise<any> => fn(tx))
  });
  return Object.assign(tx, overrides);
}

describe("portfolio reset guards", () => {
  test("blocks production", () => {
    expect(() => assertPortfolioResetAllowed({ nodeEnv: "production", confirm: "RESET" })).toThrow(/production/i);
  });

  test("requires confirm token", () => {
    expect(() => assertPortfolioResetAllowed({ nodeEnv: "development", confirm: "nope" })).toThrow(/confirm/i);
  });
});

describe("portfolio backup + reset service", () => {
  test("backup returns expected counts (including invoice line items)", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: "u@example.com" });
    prisma.property.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    prisma.tenant.findMany.mockResolvedValue([{ id: 20 }]);
    prisma.lease.findMany.mockResolvedValue([{ id: 30 }]);
    prisma.propertyIncome.findMany.mockResolvedValue([{ id: 40 }]);
    prisma.propertyExpense.findMany.mockResolvedValue([{ id: 50 }, { id: 51 }]);
    prisma.recurringIncomeRule.findMany.mockResolvedValue([{ id: 60 }]);
    prisma.recurringInvoiceRule.findMany.mockResolvedValue([{ id: 70 }]);
    prisma.invoice.findMany.mockResolvedValue([{ id: 80 }, { id: 81 }]);
    prisma.invoiceLineItem.findMany = jest.fn().mockResolvedValue([{ id: 90 }, { id: 91 }, { id: 92 }]);
    prisma.propertyDocument.findMany.mockResolvedValue([{ id: 100, leaseId: 30 }, { id: 101, leaseId: null }]);

    const payload = await exportPortfolioBackup(prisma as any, { email: "u@example.com" });

    expect(payload.counts.properties).toBe(2);
    expect(payload.counts.tenants).toBe(1);
    expect(payload.counts.leases).toBe(1);
    expect(payload.counts.propertyIncome).toBe(1);
    expect(payload.counts.propertyExpense).toBe(2);
    expect(payload.counts.invoices).toBe(2);
    expect(payload.counts.invoiceLineItems).toBe(3);
    expect(payload.counts.propertyDocuments).toBe(2);
    expect(payload.counts.leaseDocuments).toBe(1);
  });

  test("dry-run reset prints counts and changes nothing", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: "u@example.com" });
    prisma.property.findMany.mockResolvedValue([{ id: 10 }]);
    prisma.tenant.findMany.mockResolvedValue([{ id: 20 }]);
    prisma.lease.findMany.mockResolvedValue([{ id: 30 }]);
    prisma.invoice.findMany.mockResolvedValue([{ id: 80 }]);
    prisma.invoiceLineItem.count.mockResolvedValue(2);
    prisma.recurringIncomeRule.findMany.mockResolvedValue([{ id: 60 }]);
    prisma.recurringInvoiceRule.findMany.mockResolvedValue([{ id: 70 }]);
    prisma.propertyIncome.findMany.mockResolvedValue([{ id: 40 }]);
    prisma.propertyExpense.findMany.mockResolvedValue([{ id: 50 }]);
    prisma.propertyDocument.findMany.mockResolvedValue([{ id: 100, leaseId: 30 }]);

    const result = await resetPortfolioData(prisma as any, { email: "u@example.com" }, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.invoice.deleteMany).not.toHaveBeenCalled();
  });

  test("actual reset deletes children but keeps properties", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: "u@example.com" });
    prisma.property.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    prisma.tenant.findMany.mockResolvedValue([{ id: 20 }]);
    prisma.lease.findMany.mockResolvedValue([{ id: 30 }]);
    prisma.invoice.findMany.mockResolvedValue([{ id: 80 }]);
    prisma.invoiceLineItem.count.mockResolvedValue(2);
    prisma.recurringIncomeRule.findMany.mockResolvedValue([{ id: 60 }]);
    prisma.recurringInvoiceRule.findMany.mockResolvedValue([{ id: 70 }]);
    prisma.propertyIncome.findMany.mockResolvedValue([{ id: 40 }]);
    prisma.propertyExpense.findMany.mockResolvedValue([{ id: 50 }]);
    prisma.propertyDocument.findMany.mockResolvedValue([{ id: 100, leaseId: 30 }]);

    const result = await resetPortfolioData(prisma as any, { email: "u@example.com" }, { dryRun: false });
    expect(result.dryRun).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.invoiceLineItem.deleteMany).toHaveBeenCalled();
    expect(prisma.invoice.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(prisma.propertyDocument.deleteMany).toHaveBeenCalledWith({ where: { userId: 1, leaseId: { not: null } } });

    // Properties are never deleted by the reset.
    expect(prisma.property.deleteMany).toBeUndefined();
  });
});

