import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import multer from "multer";
import { db } from "../config/db.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";
import { sendInvoiceEmail } from "../services/emailService.js";

export const ownedPropertiesRoutes = Router();

const propertyDocDir = path.join(process.cwd(), "uploads/property-documents");
const invoicePdfDir = path.join(process.cwd(), "uploads/invoice-pdfs");
void fs.mkdir(propertyDocDir, { recursive: true });
void fs.mkdir(invoicePdfDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, propertyDocDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`)
});
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png"
]);
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedMimeTypes.has(file.mimetype));
  }
});

function monthBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

function asNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isValidDayOfMonth(v: unknown) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

function parseCsvParam(v: unknown) {
  if (typeof v !== "string") return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function monthLabel(monthIndex1to12: number) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthIndex1to12 - 1] ?? "";
}

function irrBisection(cashFlows: number[], opts?: { low?: number; high?: number; tol?: number; maxIter?: number }) {
  const low = opts?.low ?? -0.99;
  const high = opts?.high ?? 1.0;
  const tol = opts?.tol ?? 1e-6;
  const maxIter = opts?.maxIter ?? 200;

  const npv = (r: number) => cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  let a = low;
  let b = high;
  let fa = npv(a);
  let fb = npv(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return null; // no sign change => cannot guarantee a root

  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2;
    const fm = npv(m);
    if (!Number.isFinite(fm)) return null;
    if (Math.abs(fm) < tol) return m;
    if (fa * fm < 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

async function assertPropertyOwner(userId: number, propertyId: number) {
  const property = await db.property.findFirst({ where: { id: propertyId, userId } });
  return property;
}

function sumByCategory<T extends { category: string; amount: number }>(rows: T[], category: string) {
  return rows.filter((r) => r.category === category).reduce((acc, r) => acc + r.amount, 0);
}

async function computeFinancialSummary(userId: number, propertyId: number) {
  const property = await db.property.findFirst({
    where: { id: propertyId, userId },
    include: { leases: true }
  });
  if (!property) return null;

  const now = new Date();
  const { start, end } = monthBounds(now);
  const [expensesMonth, incomeMonthReceived, incomeMonthExpected, incomeAllReceived, expensesAll] = await Promise.all([
    db.propertyExpense.findMany({ where: { userId, propertyId, status: "ACTIVE", expenseDate: { gte: start, lt: end } } }),
    db.propertyIncome.findMany({ where: { userId, propertyId, status: "RECEIVED", incomeDate: { gte: start, lt: end } } }),
    db.propertyIncome.findMany({ where: { userId, propertyId, status: "EXPECTED", incomeDate: { gte: start, lt: end } } }),
    db.propertyIncome.findMany({ where: { userId, propertyId, status: "RECEIVED" } }),
    db.propertyExpense.findMany({ where: { userId, propertyId, status: "ACTIVE" } })
  ]);

  const totalRentIncome = sumByCategory(incomeMonthReceived as any, "RENT");
  const totalIncome = incomeMonthReceived.reduce((a, b) => a + b.amount, 0);
  const totalOtherIncome = totalIncome - totalRentIncome;
  const expectedIncome = incomeMonthExpected.reduce((a, b) => a + b.amount, 0);

  const totalRatesTaxes = sumByCategory(expensesMonth as any, "RATES_TAXES");
  const totalWater = sumByCategory(expensesMonth as any, "WATER");
  const totalElectricity = sumByCategory(expensesMonth as any, "ELECTRICITY");
  const totalLevies = sumByCategory(expensesMonth as any, "LEVIES");
  const totalInsurance = sumByCategory(expensesMonth as any, "INSURANCE");
  const totalMaintenance = sumByCategory(expensesMonth as any, "MAINTENANCE") + sumByCategory(expensesMonth as any, "REPAIRS");
  const totalBondPayment = sumByCategory(expensesMonth as any, "BOND_PAYMENT");
  const totalExpenses = expensesMonth.reduce((a, b) => a + b.amount, 0);
  const totalOtherExpenses =
    totalExpenses -
    (totalRatesTaxes + totalWater + totalElectricity + totalLevies + totalInsurance + totalMaintenance + totalBondPayment);
  const netMonthlyCashFlow = totalIncome - totalExpenses;

  const annualIncome = incomeAllReceived.reduce((a, b) => a + b.amount, 0);
  const annualExpenses = expensesAll.reduce((a, b) => a + b.amount, 0);
  const annualNetCashFlow = annualIncome - annualExpenses;
  const annualRent = incomeAllReceived.filter((i) => i.category === "RENT").reduce((a, b) => a + b.amount, 0);
  const grossYield = property.purchasePrice > 0 ? annualRent / property.purchasePrice : 0;
  const netYield = property.purchasePrice > 0 ? annualNetCashFlow / property.purchasePrice : 0;
  const outstandingLoanAmount = property.outstandingBondBalance ?? 0;
  const estimatedEquity = property.currentEstimatedValue != null ? property.currentEstimatedValue - outstandingLoanAmount : null;
  const hasActiveLease = property.leases.some((l) => l.status === "ACTIVE" || l.status === "MONTH_TO_MONTH");
  const occupancyStatus = hasActiveLease ? "Occupied" : "Vacant";

  return {
    monthly: {
      totalRentIncome,
      totalOtherIncome,
      totalIncome,
      expectedIncome,
      totalRatesTaxes,
      totalWater,
      totalElectricity,
      totalLevies,
      totalInsurance,
      totalMaintenance,
      totalBondPayment,
      totalOtherExpenses,
      totalExpenses,
      netMonthlyCashFlow
    },
    annual: {
      annualIncome,
      annualExpenses,
      annualNetCashFlow
    },
    investorMetrics: {
      grossYield,
      netYield,
      estimatedEquity,
      occupancyStatus
    }
  };
}

ownedPropertiesRoutes.use(requireAuth);

function leaseDisplayStatus(lease: { status: string; fixedTermEndDate: Date | null }) {
  if (lease.status === "CANCELLED" || lease.status === "TERMINATED" || lease.status === "EXPIRED" || lease.status === "DRAFT") return lease.status;
  if (lease.fixedTermEndDate && lease.fixedTermEndDate.getTime() < Date.now() && lease.status === "ACTIVE") return "MONTH_TO_MONTH";
  return lease.status;
}

function isCurrentLeaseStatus(status: string) {
  return status === "ACTIVE" || status === "MONTH_TO_MONTH";
}

async function getCurrentLeaseForProperty(userId: number, propertyId: number) {
  const lease = await db.lease.findFirst({
    where: { userId, propertyId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } },
    include: { tenant: true },
    orderBy: { createdAt: "desc" }
  });
  if (!lease) return null;
  return { ...lease, displayStatus: leaseDisplayStatus({ status: lease.status, fixedTermEndDate: lease.fixedTermEndDate }) };
}

ownedPropertiesRoutes.get("/properties", async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const monthParam = typeof req.query.month === "string" ? req.query.month : null; // YYYY-MM
    const base =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? new Date(Number(monthParam.slice(0, 4)), Number(monthParam.slice(5, 7)) - 1, 1)
        : now;
    const { start: monthStart, end: monthEnd } = monthBounds(base);
    const properties = await db.property.findMany({
      where: { userId: req.userId! },
      include: {
        leases: { where: { status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } }, include: { tenant: true }, orderBy: { createdAt: "desc" } },
        tenants: true,
        incomeEntries: { where: { status: "RECEIVED", incomeDate: { gte: monthStart, lt: monthEnd } } },
        expenses: { where: { status: "ACTIVE", expenseDate: { gte: monthStart, lt: monthEnd } } },
        invoices: { where: { status: { notIn: ["PAID", "CANCELLED"] } } }
      },
      orderBy: { createdAt: "desc" }
    });

    const payload = properties.map((p) => {
      const activeLease = p.leases[0] ?? null; // most recent current lease for display
      const monthlyIncomeActual = p.incomeEntries.reduce((a, b) => a + b.amount, 0);
      // If user isn't capturing received income entries yet, fall back to lease rent so KPIs don't show nonsense.
      const monthlyIncome = monthlyIncomeActual > 0 ? monthlyIncomeActual : p.leases.reduce((a: number, l: any) => a + (l.monthlyRent ?? 0), 0);
      const monthlyOperatingExpenses = (p.expenses as any[]).filter((e: any) => e.category !== "BOND_PAYMENT").reduce((a, b: any) => a + b.amount, 0);
      const monthlyDebtService = (p.expenses as any[]).filter((e: any) => e.category === "BOND_PAYMENT").reduce((a, b: any) => a + b.amount, 0);
      const monthlyExpenses = monthlyOperatingExpenses + monthlyDebtService;
      const monthlyNOI = monthlyIncome - monthlyOperatingExpenses;
      const monthlyCashFlowAfterDebtService = monthlyIncome - monthlyOperatingExpenses - monthlyDebtService;
      const displayStatus = activeLease ? leaseDisplayStatus({ status: activeLease.status, fixedTermEndDate: activeLease.fixedTermEndDate }) : "VACANT";
      const directTenant = p.tenants.find((t) => t.status === "ACTIVE") ?? null;
      const currentTenant = (activeLease?.tenant as any) ?? directTenant;
      const occupancyStatus = activeLease || directTenant ? "OCCUPIED" : "VACANT";

      const in7 = new Date(now);
      in7.setDate(in7.getDate() + 7);
      const in90 = new Date(now);
      in90.setDate(in90.getDate() + 90);
      const openInvoices = p.invoices as any[];
      const rentOverdue = openInvoices.some((inv: any) => inv.dueDate && new Date(inv.dueDate) < now);
      const rentDueSoon = openInvoices.some((inv: any) => inv.dueDate && new Date(inv.dueDate) >= now && new Date(inv.dueDate) <= in7);

      const leaseEnd = activeLease?.fixedTermEndDate ? new Date(activeLease.fixedTermEndDate) : null;
      const leaseExpiringSoon = Boolean(leaseEnd && leaseEnd >= now && leaseEnd <= in90);
      const leaseMonthToMonth = displayStatus === "MONTH_TO_MONTH";
      return {
        ...p,
        tenantStatus: activeLease ? "Occupied" : "Vacant",
        occupancyStatus,
        leaseDisplayStatus: displayStatus,
        currentTenant: currentTenant
          ? { id: currentTenant.id, firstName: currentTenant.firstName, lastName: currentTenant.lastName, email: currentTenant.email, phone: currentTenant.phone }
          : null,
        currentLease: activeLease
          ? {
              id: activeLease.id,
              leaseType: activeLease.leaseType,
              status: activeLease.status,
              displayStatus,
              startDate: activeLease.startDate,
              fixedTermEndDate: activeLease.fixedTermEndDate,
              monthlyRent: activeLease.monthlyRent,
              depositAmount: activeLease.depositAmount,
              rentDueDay: activeLease.rentDueDay
            }
          : null,
        allTenantsCount: p.tenants.length,
        monthlyRent: activeLease?.monthlyRent ?? 0,
        monthlyIncome,
        monthlyOperatingExpenses,
        monthlyDebtService,
        monthlyExpenses,
        monthlyNOI,
        monthlyCashFlowAfterDebtService,
        netCashFlow: monthlyCashFlowAfterDebtService,
        rentOverdue,
        rentDueSoon,
        leaseExpiringSoon,
        leaseMonthToMonth
      };
    });

    const summary = {
      totalProperties: payload.length
    };

    return res.json({ properties: payload, summary });
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not load properties." });
  }
});

ownedPropertiesRoutes.post("/properties", async (req: AuthRequest, res) => {
  try {
    const result = await db.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          userId: req.userId!,
          name: req.body.name,
          propertyType: req.body.propertyType,
          investmentType: req.body.investmentType ?? "LONG_TERM_RENTAL",
          addressLine1: req.body.addressLine1,
          addressLine2: req.body.addressLine2 ?? null,
          suburb: req.body.suburb ?? null,
          city: req.body.city,
          province: req.body.province,
          postalCode: req.body.postalCode ?? null,
          country: req.body.country ?? "South Africa",
          erfNumber: req.body.erfNumber ?? null,
          sizeSqm: req.body.sizeSqm != null ? asNumber(req.body.sizeSqm) : null,
          bedrooms: req.body.bedrooms != null ? Number(req.body.bedrooms) : null,
          bathrooms: req.body.bathrooms != null ? Number(req.body.bathrooms) : null,
          parkingBays: req.body.parkingBays != null ? Number(req.body.parkingBays) : null,
          purchasePrice: asNumber(req.body.purchasePrice),
          purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : null,
          currentEstimatedValue: req.body.currentEstimatedValue != null ? asNumber(req.body.currentEstimatedValue) : null,
          outstandingBondBalance: req.body.outstandingBondBalance != null ? asNumber(req.body.outstandingBondBalance) : null,
          monthlyBondPayment: req.body.monthlyBondPayment != null ? asNumber(req.body.monthlyBondPayment) : null,
          totalCashInvested: req.body.totalCashInvested != null ? asNumber(req.body.totalCashInvested) : null,
          bondCosts: req.body.bondCosts != null ? asNumber(req.body.bondCosts) : null,
          transferCosts: req.body.transferCosts != null ? asNumber(req.body.transferCosts) : null,
          holdingPeriodYears: req.body.holdingPeriodYears != null ? Number(req.body.holdingPeriodYears) : null,
          estimatedSellingCostPercent: req.body.estimatedSellingCostPercent != null ? asNumber(req.body.estimatedSellingCostPercent) : null,
          expectedMonthlyIncome: req.body.expectedMonthlyIncome != null ? asNumber(req.body.expectedMonthlyIncome) : null,
          expectedMonthlyExpenses: req.body.expectedMonthlyExpenses != null ? asNumber(req.body.expectedMonthlyExpenses) : null,
          status: req.body.status ?? null,
          notes: req.body.notes ?? null,

          landUse: req.body.landUse ?? null,
          zoning: req.body.zoning ?? null,
          ratesAndTaxesMonthly: req.body.ratesAndTaxesMonthly != null ? asNumber(req.body.ratesAndTaxesMonthly) : null,
          leviesMonthly: req.body.leviesMonthly != null ? asNumber(req.body.leviesMonthly) : null,
          securityMonthly: req.body.securityMonthly != null ? asNumber(req.body.securityMonthly) : null,
          maintenanceMonthly: req.body.maintenanceMonthly != null ? asNumber(req.body.maintenanceMonthly) : null,
          expectedAnnualAppreciationPercent:
            req.body.expectedAnnualAppreciationPercent != null ? asNumber(req.body.expectedAnnualAppreciationPercent) : null,

          averageDailyRate: req.body.averageDailyRate != null ? asNumber(req.body.averageDailyRate) : null,
          occupancyRate: req.body.occupancyRate != null ? asNumber(req.body.occupancyRate) : null,
          availableNightsPerMonth: req.body.availableNightsPerMonth != null ? Number(req.body.availableNightsPerMonth) : null,
          platformFeePercent: req.body.platformFeePercent != null ? asNumber(req.body.platformFeePercent) : null,
          cleaningFeesMonthly: req.body.cleaningFeesMonthly != null ? asNumber(req.body.cleaningFeesMonthly) : null,
          managementFeePercent: req.body.managementFeePercent != null ? asNumber(req.body.managementFeePercent) : null,
          furnishingValue: req.body.furnishingValue != null ? asNumber(req.body.furnishingValue) : null,
          monthlyUtilities: req.body.monthlyUtilities != null ? asNumber(req.body.monthlyUtilities) : null,

          rehabBudget: req.body.rehabBudget != null ? asNumber(req.body.rehabBudget) : null,
          holdingCostsMonthly: req.body.holdingCostsMonthly != null ? asNumber(req.body.holdingCostsMonthly) : null,
          expectedSalePrice: req.body.expectedSalePrice != null ? asNumber(req.body.expectedSalePrice) : null,
          targetSaleDate: req.body.targetSaleDate ? new Date(req.body.targetSaleDate) : null,
          projectStage: req.body.projectStage ?? null,

          afterRepairValue: req.body.afterRepairValue != null ? asNumber(req.body.afterRepairValue) : null,
          refinanceAmount: req.body.refinanceAmount != null ? asNumber(req.body.refinanceAmount) : null,
          brrrrStage: req.body.brrrrStage ?? null
        }
      });

      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const upsertSetupRecurringExpense = async (category: any, description: string, amountRaw: any) => {
        const amount = amountRaw != null ? asNumber(amountRaw) : 0;
        const existingSetup = await tx.propertyExpense.findFirst({
          where: {
            userId: req.userId!,
            propertyId: created.id,
            category,
            description,
            isRecurring: true,
            recurringFrequency: "MONTHLY"
          },
          orderBy: { createdAt: "asc" }
        });

        if (!amount || amount <= 0) {
          if (existingSetup) {
            await tx.propertyExpense.update({ where: { id: existingSetup.id }, data: { status: "ARCHIVED" } });
          }
          return;
        }

        if (existingSetup) {
          await tx.propertyExpense.update({
            where: { id: existingSetup.id },
            data: { amount, source: "PROPERTY_SETUP", status: "ACTIVE" }
          });
          return;
        }

        await tx.propertyExpense.create({
          data: {
            userId: req.userId!,
            propertyId: created.id,
            category,
            description,
            amount,
            expenseDate: firstOfMonth,
            isRecurring: true,
            recurringFrequency: "MONTHLY",
            source: "PROPERTY_SETUP",
            status: "ACTIVE"
          }
        });
      };

      // Single source of truth: setup monthly fields become recurring PropertyExpense records
      await upsertSetupRecurringExpense("RATES_TAXES", "Rates & taxes (setup)", req.body.ratesAndTaxesMonthly);
      await upsertSetupRecurringExpense("LEVIES", "Levies (setup)", req.body.leviesMonthly);
      await upsertSetupRecurringExpense("MAINTENANCE", "Maintenance (setup)", req.body.maintenanceMonthly);
      await upsertSetupRecurringExpense("OTHER", "Security (setup)", req.body.securityMonthly);
      await upsertSetupRecurringExpense("OTHER", "Other monthly expenses (setup)", req.body.expectedMonthlyExpenses);
      await upsertSetupRecurringExpense("BOND_PAYMENT", "Bond payment (setup)", req.body.monthlyBondPayment);

      const tenantId = req.body.tenantId != null ? Number(req.body.tenantId) : null;
      const newTenant = req.body.newTenant ?? null;

      let tenant = null as any;
      if (tenantId) {
        tenant = await tx.tenant.findFirst({ where: { id: tenantId, userId: req.userId! } });
        if (!tenant) throw new Error("Invalid tenant");
        tenant = await tx.tenant.update({ where: { id: tenantId }, data: { propertyId: created.id, status: "ACTIVE" } });
      } else if (newTenant?.firstName && newTenant?.lastName && newTenant?.email && newTenant?.phone) {
        tenant = await tx.tenant.create({
          data: {
            userId: req.userId!,
            propertyId: created.id,
            firstName: newTenant.firstName,
            lastName: newTenant.lastName,
            email: newTenant.email,
            phone: newTenant.phone,
            idNumber: newTenant.idNumber ?? null,
            status: "ACTIVE"
          }
        });
      }

      const lease = req.body.lease ?? null;
      if (tenant && lease?.startDate) {
        await tx.lease.create({
          data: {
            userId: req.userId!,
            propertyId: created.id,
            tenantId: tenant.id,
            startDate: new Date(lease.startDate),
            fixedTermEndDate: lease.fixedTermEndDate ? new Date(lease.fixedTermEndDate) : null,
            leaseType: lease.leaseType ?? (lease.fixedTermEndDate ? "FIXED_TERM" : "MONTH_TO_MONTH"),
            monthlyRent: asNumber(lease.monthlyRent),
            depositAmount: asNumber(lease.depositAmount),
            rentDueDay: lease.rentDueDay != null ? Number(lease.rentDueDay) : 1,
            status: lease.status ?? (lease.leaseType === "MONTH_TO_MONTH" ? "MONTH_TO_MONTH" : "ACTIVE")
          }
        });
      }

      return created;
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.error("[ownedProperties] POST /properties failed", err?.stack ?? err);
    return res.status(400).json({ message: err?.message ?? "Failed to create property." });
  }
});

ownedPropertiesRoutes.get("/properties/metrics/equity", async (req: AuthRequest, res) => {
  try {
    const properties = await db.property.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" }
    });
    const rows = properties.map((p) => {
      const v = p.currentEstimatedValue ?? null;
      const b = p.outstandingBondBalance ?? null;
      return {
        id: p.id,
        name: p.name,
        addressLine1: p.addressLine1,
        city: p.city,
        province: p.province,
        purchasePrice: p.purchasePrice,
        currentEstimatedValue: v,
        outstandingBondBalance: b,
        equity: v != null && b != null ? v - b : null,
        updatedAt: p.updatedAt
      };
    });
    return res.json({ properties: rows });
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties/metrics/equity failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to load equity metrics." });
  }
});

ownedPropertiesRoutes.patch("/properties/metrics/equity", async (req: AuthRequest, res) => {
  try {
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : null;
    if (!updates) return res.status(400).json({ message: "updates[] is required" });

    const updated: any[] = [];
    for (const u of updates) {
      const propertyId = Number(u.propertyId);
      if (!propertyId) continue;
      const currentEstimatedValue = u.currentEstimatedValue != null ? asNumber(u.currentEstimatedValue) : null;
      const outstandingBondBalance = u.outstandingBondBalance != null ? asNumber(u.outstandingBondBalance) : null;
      if (currentEstimatedValue != null && currentEstimatedValue < 0) return res.status(400).json({ message: "currentEstimatedValue must be non-negative" });
      if (outstandingBondBalance != null && outstandingBondBalance < 0) return res.status(400).json({ message: "outstandingBondBalance must be non-negative" });

      const exists = await db.property.findFirst({ where: { id: propertyId, userId: req.userId! } });
      if (!exists) return res.status(403).json({ message: "Cannot update another user's property" });

      updated.push(
        await db.property.update({
          where: { id: propertyId },
          data: { currentEstimatedValue, outstandingBondBalance }
        })
      );
    }

    return res.json({ updatedCount: updated.length });
  } catch (err: any) {
    console.error("[ownedProperties] PATCH /properties/metrics/equity failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to update equity values." });
  }
});

ownedPropertiesRoutes.get("/properties/dashboard-summary", async (req: AuthRequest, res) => {
  try {
    const propertyTypes = parseCsvParam(req.query.propertyTypes);
    const now = new Date();
    const monthParam = typeof req.query.month === "string" ? req.query.month : null; // YYYY-MM
    const base =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? new Date(Number(monthParam.slice(0, 4)), Number(monthParam.slice(5, 7)) - 1, 1)
        : now;
    const { start: monthStart, end: monthEnd } = monthBounds(base);
    const propertyId = req.query.propertyId != null ? Number(req.query.propertyId) : null;
    if (propertyId != null && Number.isNaN(propertyId)) return res.status(400).json({ message: "Invalid propertyId" });

    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    const twelveStart = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth(), 1);
    const twelveEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const whereProperty: any = {
      userId: req.userId!
    };
    if (propertyTypes.length) {
      whereProperty.investmentType = { in: propertyTypes };
    }
    if (propertyId != null) {
      whereProperty.id = propertyId;
    }

    const properties = await db.property.findMany({
      where: whereProperty,
      include: {
        leases: { include: { tenant: true } },
        tenants: true,
        invoices: true,
        documents: true
      },
      orderBy: { createdAt: "desc" }
    });

    const [incomeMonth, expensesMonth, income12, expenses12] = await Promise.all([
      db.propertyIncome.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "RECEIVED",
          incomeDate: { gte: monthStart, lt: monthEnd }
        }
      }),
      db.propertyExpense.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "ACTIVE",
          expenseDate: { gte: monthStart, lt: monthEnd }
        }
      }),
      db.propertyIncome.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "RECEIVED",
          incomeDate: { gte: twelveStart, lt: twelveEnd }
        }
      }),
      db.propertyExpense.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "ACTIVE",
          expenseDate: { gte: twelveStart, lt: twelveEnd }
        }
      })
    ]);

    const typeLabel: Record<string, string> = {
      LONG_TERM_RENTAL: "Long-Term Rental",
      SHORT_TERM_RENTAL: "Short-Term Rental",
      PRIMARY_RESIDENCE: "Primary Residence",
      HOUSE_HACK: "House Hack",
      BRRRR: "BRRRR",
      FLIP: "Flip",
      VACANT_LAND: "Vacant Land",
      COMMERCIAL: "Commercial",
      MIXED_USE: "Mixed Use",
      OTHER: "Other"
    };

    const tenantRequired = (p: any) => {
      const t = p.investmentType ?? "OTHER";
      if (t === "VACANT_LAND" || t === "SHORT_TERM_RENTAL" || t === "FLIP" || t === "PRIMARY_RESIDENCE") return false;
      if (t === "BRRRR") return ["RENTED", "REFINANCED"].includes(p.brrrrStage ?? "");
      return true;
    };

    const byProperty = <T extends { propertyId: number }>(rows: T[]) => {
      const m = new Map<number, T[]>();
      for (const r of rows) m.set(r.propertyId, [...(m.get(r.propertyId) ?? []), r]);
      return m;
    };
    const incomeMonthByProperty = byProperty(incomeMonth as any);
    const expenseMonthByProperty = byProperty(expensesMonth as any);

    const totalProperties = properties.length;
    const propertiesByType: Record<string, number> = {};
    let tenantRequiredProperties = 0;
    let occupiedProperties = 0;
    let vacantRentalProperties = 0;
    let landProperties = 0;
    let shortTermRentalProperties = 0;

    let totalCurrentEstimatedValue = 0;
    let totalOutstandingBondBalance = 0;
    let portfolioEquity = 0;
    let totalPurchasePrice = 0;

    let missingCurrentEstimatedValue = 0;
    let missingOutstandingBondBalance = 0;
    let missingPurchasePrice = 0;
    let missingLeaseDocuments = 0;
    let missingExpenseData = 0;

    let depositsHeld = 0;
    let monthlyRentRoll = 0;
    let monthlyShortTermRentalRevenue = 0;

    const in90 = new Date(now);
    in90.setDate(in90.getDate() + 90);
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);

    let leasesExpiringSoon = 0;
    let leasesMonthToMonth = 0;
    let leasesActiveFixedTerm = 0;
    let leasesCancelledOrTerminated = 0;

    const rentOverdueKeys = new Set<string>();
    const rentDueSoonKeys = new Set<string>();

    const cashFlowByProperty: any[] = [];
    const equityByProperty: any[] = [];
    const leaseTimeline: any[] = [];
    const vacantLandHoldingCosts: any[] = [];
    const shortTermRentalPerformance: any[] = [];

    const warnings: string[] = [];

    // Monthly totals
    const debtServiceFromExpenses = (expensesMonth as any[]).filter((e) => e.category === "BOND_PAYMENT").reduce((a, b) => a + b.amount, 0);
    const totalMonthlyDebtService = debtServiceFromExpenses;
    const totalMonthlyOperatingExpenses = (expensesMonth as any[]).filter((e) => e.category !== "BOND_PAYMENT").reduce((a, b) => a + b.amount, 0);
    const totalMonthlyIncomeActual = (incomeMonth as any[]).reduce((a, b) => a + b.amount, 0);

    // STR estimated monthly revenue (net) based on property fields
    const strRows = properties.filter((p: any) => p.investmentType === "SHORT_TERM_RENTAL");
    const strNet = strRows.reduce((acc: number, p: any) => {
      const adr = p.averageDailyRate ?? 0;
      const occ = p.occupancyRate ?? 0;
      const nights = p.availableNightsPerMonth ?? 0;
      const gross = adr * occ * nights;
      const platformFee = (p.platformFeePercent ?? 0) / 100;
      const mgmtFee = (p.managementFeePercent ?? 0) / 100;
      const net = gross * (1 - platformFee) - gross * mgmtFee + (p.cleaningFeesMonthly ?? 0);
      return acc + net;
    }, 0);

    // If the user isn't capturing received income entries yet, project rent from current leases (multi-tenant friendly).
    const totalMonthlyLeaseRent = properties.reduce((a: number, p: any) => {
      const currentLeasesForProperty = (p.leases ?? []).filter((l: any) =>
        isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))
      );
      return a + currentLeasesForProperty.reduce((s: number, l: any) => s + (l.monthlyRent ?? 0), 0);
    }, 0);
    const projectedRentalIncome = totalMonthlyIncomeActual > 0 ? totalMonthlyIncomeActual : totalMonthlyLeaseRent;
    const totalMonthlyIncome = projectedRentalIncome + strNet;
    const monthlyNOI = totalMonthlyIncome - totalMonthlyOperatingExpenses;
    const monthlyExpensesTotal = totalMonthlyOperatingExpenses + totalMonthlyDebtService;
    const monthlyNetCashFlow = totalMonthlyIncome - totalMonthlyOperatingExpenses - totalMonthlyDebtService;

    for (const p of properties as any[]) {
      const t = p.investmentType ?? "OTHER";
      propertiesByType[t] = (propertiesByType[t] ?? 0) + 1;
      if (t === "VACANT_LAND") landProperties += 1;
      if (t === "SHORT_TERM_RENTAL") shortTermRentalProperties += 1;

      if (p.purchasePrice == null || p.purchasePrice <= 0) missingPurchasePrice += 1;
      else totalPurchasePrice += p.purchasePrice;

      if (p.currentEstimatedValue == null) missingCurrentEstimatedValue += 1;
      else totalCurrentEstimatedValue += p.currentEstimatedValue;

      if (p.outstandingBondBalance == null) missingOutstandingBondBalance += 1;
      else totalOutstandingBondBalance += p.outstandingBondBalance;

      if (p.currentEstimatedValue != null && p.outstandingBondBalance != null) {
        portfolioEquity += p.currentEstimatedValue - p.outstandingBondBalance;
      }

      const directTenant = (p.tenants ?? []).find((tt: any) => tt.status === "ACTIVE") ?? null;
      const currentLease = (p.leases ?? []).find((l: any) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))) ?? null;
      const leaseDisplay = currentLease ? leaseDisplayStatus({ status: currentLease.status, fixedTermEndDate: currentLease.fixedTermEndDate }) : null;

      const isTenantRequired = tenantRequired(p);
      if (isTenantRequired) {
        tenantRequiredProperties += 1;
        const occupied = Boolean(directTenant || currentLease);
        if (occupied) occupiedProperties += 1;
        else vacantRentalProperties += 1;
      }

      if (currentLease) {
        // For display counts we keep a single "currentLease" per property,
        // but the portfolio rent roll & deposits should reflect multi-tenant scenarios.
        const currentLeasesForProperty = (p.leases ?? []).filter((l: any) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })));
        depositsHeld += currentLeasesForProperty.reduce((a: number, l: any) => a + (l.depositAmount ?? 0), 0);
        monthlyRentRoll += currentLeasesForProperty.reduce((a: number, l: any) => a + (l.monthlyRent ?? 0), 0);

        if (leaseDisplay === "MONTH_TO_MONTH") leasesMonthToMonth += 1;
        if (currentLease.fixedTermEndDate && currentLease.fixedTermEndDate >= now && currentLease.fixedTermEndDate <= in90) leasesExpiringSoon += 1;
        if (currentLease.leaseType === "FIXED_TERM" && leaseDisplay === "ACTIVE") leasesActiveFixedTerm += 1;
        if (!(p.documents ?? []).length) missingLeaseDocuments += 1;

        leaseTimeline.push({
          propertyId: p.id,
          propertyName: p.name,
          tenantName: currentLease.tenant?.firstName ? `${currentLease.tenant.firstName} ${currentLease.tenant.lastName}` : null,
          fixedTermEndDate: currentLease.fixedTermEndDate,
          displayStatus: leaseDisplay
        });
      }

      leasesCancelledOrTerminated += (p.leases ?? []).filter((l: any) => ["CANCELLED", "TERMINATED"].includes(l.status)).length;

      // Rent due / overdue (invoices)
      const unpaid = (p.invoices ?? []).filter((i: any) => !["PAID", "CANCELLED"].includes(i.status));
      unpaid.forEach((i: any) => {
        const due = new Date(i.dueDate);
        const key = `${i.tenantId}-${due.getFullYear()}-${due.getMonth() + 1}`;
        if (due < now) rentOverdueKeys.add(key);
        else if (due >= now && due <= in7) rentDueSoonKeys.add(key);
      });

      // Per-property cash flow for the current month (best-effort)
      const inc = (incomeMonthByProperty.get(p.id) ?? []).reduce((a: number, r: any) => a + r.amount, 0);
      const expRows = expenseMonthByProperty.get(p.id) ?? [];
      const opEx = expRows.filter((e: any) => e.category !== "BOND_PAYMENT").reduce((a: number, r: any) => a + r.amount, 0);
      const debt = expRows.filter((e: any) => e.category === "BOND_PAYMENT").reduce((a: number, r: any) => a + r.amount, 0);
      cashFlowByProperty.push({ propertyId: p.id, propertyName: p.name, netCashFlow: inc - opEx - debt });

      const eq = p.currentEstimatedValue != null && p.outstandingBondBalance != null ? p.currentEstimatedValue - p.outstandingBondBalance : null;
      equityByProperty.push({ propertyId: p.id, propertyName: p.name, equity: eq });

      // Land holding costs
      if (t === "VACANT_LAND") {
        const holdingFromRecords = opEx;
        vacantLandHoldingCosts.push({ propertyId: p.id, propertyName: p.name, holdingCostsMonthly: holdingFromRecords });
      }

      // STR performance
      if (t === "SHORT_TERM_RENTAL") {
        const adr = p.averageDailyRate ?? 0;
        const occ = p.occupancyRate ?? 0;
        const nights = p.availableNightsPerMonth ?? 0;
        const gross = adr * occ * nights;
        const platformFee = (p.platformFeePercent ?? 0) / 100;
        const mgmtFee = (p.managementFeePercent ?? 0) / 100;
        const net = gross * (1 - platformFee) - gross * mgmtFee + (p.cleaningFeesMonthly ?? 0);
        monthlyShortTermRentalRevenue += net;
        shortTermRentalPerformance.push({
          propertyId: p.id,
          propertyName: p.name,
          adr,
          occupancyRate: occ,
          availableNightsPerMonth: nights,
          grossRevenue: gross,
          netRevenue: net,
          revpar: nights ? gross / nights : 0
        });
      }

      // Missing expense data heuristic
      if (!(expenseMonthByProperty.get(p.id) ?? []).length && !(incomeMonthByProperty.get(p.id) ?? []).length) {
        missingExpenseData += 1;
      }
    }

    const occupancyRate = tenantRequiredProperties ? occupiedProperties / tenantRequiredProperties : 0;

    // Annual NOI / cap rate (best-effort from 12 months actuals, excluding debt service)
    const annualEffectiveIncome = (income12 as any[]).reduce((a, b) => a + b.amount, 0);
    const annualOperatingExpenses = (expenses12 as any[]).filter((e) => e.category !== "BOND_PAYMENT").reduce((a, b) => a + b.amount, 0);
    const annualNOI = annualEffectiveIncome - annualOperatingExpenses;

    const incomeProducingValue = properties
      .filter((p: any) => !["PRIMARY_RESIDENCE", "VACANT_LAND", "FLIP"].includes(p.investmentType ?? "OTHER"))
      .reduce((a: number, p: any) => a + (p.currentEstimatedValue ?? 0), 0);
    const averageCapRate = incomeProducingValue > 0 ? annualNOI / incomeProducingValue : 0;

    const operatingExpenseRatio = annualEffectiveIncome > 0 ? annualOperatingExpenses / annualEffectiveIncome : 0;

    const rentDue = {
      dueSoon: rentDueSoonKeys.size,
      overdue: rentOverdueKeys.size,
      totalAttention: rentDueSoonKeys.size + rentOverdueKeys.size
    };

    const leases = {
      expiringSoon: leasesExpiringSoon,
      monthToMonth: leasesMonthToMonth,
      activeFixedTerm: leasesActiveFixedTerm,
      cancelledOrTerminated: leasesCancelledOrTerminated
    };

    // Charts: monthlyIncomeExpenses (12 months)
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const months: string[] = [];
    const cursor = new Date(twelveStart);
    while (cursor < twelveEnd) {
      months.push(monthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const incomeByMonth = new Map<string, number>();
    const opExByMonth = new Map<string, number>();
    const debtByMonth = new Map<string, number>();
    (income12 as any[]).forEach((r) => incomeByMonth.set(monthKey(new Date(r.incomeDate)), (incomeByMonth.get(monthKey(new Date(r.incomeDate))) ?? 0) + r.amount));
    (expenses12 as any[]).forEach((r) => {
      const k = monthKey(new Date(r.expenseDate));
      if (r.category === "BOND_PAYMENT") debtByMonth.set(k, (debtByMonth.get(k) ?? 0) + r.amount);
      else opExByMonth.set(k, (opExByMonth.get(k) ?? 0) + r.amount);
    });
    // Debt service comes from PropertyExpense(BOND_PAYMENT) records
    const estDebtService = 0;
    months.forEach((m) => debtByMonth.set(m, (debtByMonth.get(m) ?? 0) + estDebtService));

    const monthlyIncomeExpenses = months.map((m) => {
      const income = incomeByMonth.get(m) ?? 0;
      const operatingExpenses = opExByMonth.get(m) ?? 0;
      const debtService = debtByMonth.get(m) ?? 0;
      return { month: m, income, operatingExpenses, debtService, netCashFlow: income - operatingExpenses - debtService };
    });

    // Expense breakdown (current month)
    const expenseBreakdownMap = new Map<string, number>();
    (expensesMonth as any[]).forEach((e) => expenseBreakdownMap.set(e.category, (expenseBreakdownMap.get(e.category) ?? 0) + e.amount));
    if (estDebtService) expenseBreakdownMap.set("BOND_PAYMENT", (expenseBreakdownMap.get("BOND_PAYMENT") ?? 0) + estDebtService);
    const expenseBreakdown = Array.from(expenseBreakdownMap.entries()).map(([category, amount]) => ({ category, amount }));

    const propertyTypeAllocation = Object.entries(propertiesByType).map(([type, count]) => ({
      type,
      typeLabel: typeLabel[type] ?? type,
      count
    }));

    // --- Phase 9 specific charts ---
    // last 5 months NOI trend
    const last5Start = new Date(now.getFullYear(), now.getMonth() - 4, 1);
    const last5End = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [income5, expense5] = await Promise.all([
      db.propertyIncome.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "RECEIVED",
          incomeDate: { gte: last5Start, lt: last5End }
        }
      }),
      db.propertyExpense.findMany({
        where: {
          userId: req.userId!,
          propertyId: { in: properties.map((p) => p.id) },
          status: "ACTIVE",
          expenseDate: { gte: last5Start, lt: last5End }
        }
      })
    ]);

    const keyYM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const income5ByYM = new Map<string, number>();
    income5.forEach((r: any) => income5ByYM.set(keyYM(new Date(r.incomeDate)), (income5ByYM.get(keyYM(new Date(r.incomeDate))) ?? 0) + r.amount));
    const opEx5ByYM = new Map<string, number>();
    expense5
      .filter((r: any) => r.category !== "BOND_PAYMENT")
      .forEach((r: any) => opEx5ByYM.set(keyYM(new Date(r.expenseDate)), (opEx5ByYM.get(keyYM(new Date(r.expenseDate))) ?? 0) + r.amount));

    const strNetByMonth = (ym: string) => {
      // assume same monthly STR net each month (until STR has time-series entries)
      return strNet;
    };

    const leaseRentEstimatedMonthly = properties.reduce((acc: number, p: any) => {
      const lease = (p.leases ?? []).find((l: any) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })));
      return acc + (lease?.monthlyRent ?? 0);
    }, 0);

    const months5: { ym: string; label: string }[] = [];
    const cur = new Date(last5Start);
    while (cur < last5End) {
      months5.push({ ym: keyYM(cur), label: monthLabel(cur.getMonth() + 1) });
      cur.setMonth(cur.getMonth() + 1);
    }

    const opExValues = months5.map((m) => opEx5ByYM.get(m.ym)).filter((v): v is number => typeof v === "number");
    const avgOpEx = opExValues.length ? opExValues.reduce((a, b) => a + b, 0) / opExValues.length : 0;
    if (!opExValues.length) warnings.push("No expenses captured yet. NOI may be overstated.");

    const monthlyNOITrend = months5.map((m) => {
      const incomeActual = income5ByYM.get(m.ym) ?? 0;
      const expensesActual = opEx5ByYM.get(m.ym);
      const estimatedExpenses = expensesActual == null;
      const operatingExpenses = expensesActual == null ? avgOpEx : expensesActual;

      // income estimation: if no actual income, use lease rent + STR net estimate
      const estimatedIncome = incomeActual === 0;
      const income = incomeActual || (leaseRentEstimatedMonthly + strNetByMonth(m.ym));

      const noi = income - operatingExpenses;
      return {
        month: m.ym,
        label: m.label,
        income,
        operatingExpenses,
        noi,
        estimatedIncome,
        estimatedExpenses
      };
    });

    // composition chart (current month)
    const compositionMap = new Map<string, { category: string; type: "income" | "expense"; amount: number }>();
    const addComp = (category: string, type: "income" | "expense", amount: number) => {
      if (!amount || amount <= 0) return;
      const key = `${type}:${category}`;
      const existing = compositionMap.get(key);
      if (existing) existing.amount += amount;
      else compositionMap.set(key, { category, type, amount });
    };

    // income categories mapping
    (incomeMonth as any[]).forEach((r) => {
      if (r.category === "RENT") addComp("Rental Income", "income", r.amount);
      else if (r.category === "UTILITIES_RECOVERY") addComp("Utility Recoveries", "income", r.amount);
      else if (r.category === "DEPOSIT") addComp("Other Income", "income", r.amount);
      else addComp("Other Income", "income", r.amount);
    });
    if (strNet > 0) addComp("Short-Term Rental Income", "income", strNet);

    // expense categories mapping
    (expensesMonth as any[]).forEach((e) => {
      const amt = e.amount;
      const cat = e.category;
      if (cat === "RATES_TAXES") addComp("Rates & Taxes", "expense", amt);
      else if (cat === "WATER") addComp("Water", "expense", amt);
      else if (cat === "ELECTRICITY") addComp("Electricity", "expense", amt);
      else if (cat === "LEVIES") addComp("Levies", "expense", amt);
      else if (cat === "INSURANCE") addComp("Insurance", "expense", amt);
      else if (cat === "MAINTENANCE") addComp("Maintenance", "expense", amt);
      else if (cat === "REPAIRS") addComp("Repairs", "expense", amt);
      else if (cat === "MANAGEMENT_FEES") addComp("Management Fees", "expense", amt);
      else if (cat === "BOND_PAYMENT") addComp("Debt Service / Bond Payments", "expense", amt);
      else addComp("Other Expenses", "expense", amt);
    });

    // STR expense estimates from property fields (platform/mgmt/utilities) – shown as composition even if not in expenses table
    strRows.forEach((p: any) => {
      const adr = p.averageDailyRate ?? 0;
      const occ = p.occupancyRate ?? 0;
      const nights = p.availableNightsPerMonth ?? 0;
      const gross = adr * occ * nights;
      const platformFee = gross * ((p.platformFeePercent ?? 0) / 100);
      const mgmtFee = gross * ((p.managementFeePercent ?? 0) / 100);
      addComp("Platform Fees", "expense", platformFee);
      addComp("Management Fees", "expense", mgmtFee);
      addComp("Cleaning", "expense", p.cleaningFeesMonthly ?? 0);
      addComp("Utilities", "expense", p.monthlyUtilities ?? 0);
    });

    const incomeExpenseComposition = Array.from(compositionMap.values()).filter((r) => r.amount > 0);

    // --- KPI: true cash-on-cash ROI ---
    const annualPreTaxCashFlow = monthlyNOI * 12 - totalMonthlyDebtService * 12;

    const estimateCashInvested = (p: any): number | null => {
      const purchasePrice = typeof p.purchasePrice === "number" ? p.purchasePrice : null;
      if (purchasePrice == null || purchasePrice <= 0) return null;

      const bondBal = typeof p.outstandingBondBalance === "number" ? p.outstandingBondBalance : 0;
      const financed = Math.min(Math.max(0, bondBal), purchasePrice);
      const deposit = Math.max(0, purchasePrice - financed);

      const transferCosts = typeof p.transferCosts === "number" ? p.transferCosts : 0;
      const bondCosts = typeof p.bondCosts === "number" ? p.bondCosts : 0;
      const renovations = typeof p.rehabBudget === "number" ? p.rehabBudget : 0;
      const furnishings = typeof p.furnishingValue === "number" ? p.furnishingValue : 0;

      return deposit + transferCosts + bondCosts + renovations + furnishings;
    };

    let estimatedCashInvestedCount = 0;
    let missingCashInvestedCount = 0;
    const totalCashInvested = (properties as any[]).reduce((sum, p) => {
      const explicit = typeof p.totalCashInvested === "number" ? p.totalCashInvested : null;
      if (explicit != null && explicit > 0) return sum + explicit;

      const est = estimateCashInvested(p);
      if (est != null && est > 0) {
        estimatedCashInvestedCount += 1;
        return sum + est;
      }

      missingCashInvestedCount += 1;
      return sum;
    }, 0);

    if (missingCashInvestedCount) warnings.push(`Missing cash invested for ${missingCashInvestedCount} properties`);
    if (estimatedCashInvestedCount) {
      warnings.push(
        `Estimated cash invested for ${estimatedCashInvestedCount} properties using purchase price − bond + (transfer + bond + renovation + furnishing costs where available). Add “Total cash invested” for exact ROI/IRR.`
      );
    }

    const cashOnCash = totalCashInvested > 0 ? annualPreTaxCashFlow / totalCashInvested : null;
    const classification =
      cashOnCash == null
        ? "Insufficient data"
        : cashOnCash < 0
          ? "Deficit"
          : cashOnCash < 0.05
            ? "Weak"
            : cashOnCash < 0.08
              ? "Acceptable"
              : cashOnCash < 0.12
                ? "Strong"
                : "Very strong, check assumptions";

    // --- KPI: portfolio IRR ---
    const holdingYears = Math.max(1, ...properties.map((p: any) => p.holdingPeriodYears ?? 10));
    const sellCostDefault = 5;
    const appreciationDefault = 5;
    const irrAssumptions: string[] = [];
    let canIrr = true;
    let year0 = 0;
    let annual = 0;
    let finalSale = 0;

    for (const p of properties as any[]) {
      const invested =
        typeof p.totalCashInvested === "number" && p.totalCashInvested > 0 ? p.totalCashInvested : estimateCashInvested(p);
      const value = typeof p.currentEstimatedValue === "number" && p.currentEstimatedValue > 0 ? p.currentEstimatedValue : p.purchasePrice;

      if (invested == null || invested <= 0 || value == null || value <= 0) {
        canIrr = false;
        continue;
      }
      year0 -= invested;
      // use same annual pretax cashflow split by property proportionally to NOI; fallback: 0
      // for now: allocate by current lease rent + STR net
      annual += annualPreTaxCashFlow / Math.max(1, properties.length);

      const app = p.expectedAnnualAppreciationPercent ?? appreciationDefault;
      const sellCost = p.estimatedSellingCostPercent ?? sellCostDefault;
      const futureValue = value * Math.pow(1 + app / 100, p.holdingPeriodYears ?? holdingYears);
      const sellingCosts = futureValue * (sellCost / 100);
      const bond = p.outstandingBondBalance ?? 0;
      if (p.outstandingBondBalance == null) irrAssumptions.push("IRR uses current bond balance as conservative sale balance assumption.");
      const netSale = futureValue - sellingCosts - bond;
      finalSale += netSale;
    }

    const irrCashFlows = canIrr ? Array.from({ length: holdingYears + 1 }, (_, t) => (t === 0 ? year0 : t === holdingYears ? annual + finalSale : annual)) : [];
    const irr = canIrr ? irrBisection(irrCashFlows) : null;
    if (canIrr && irr == null) warnings.push("Insufficient data to calculate IRR (cash flows do not produce a solvable IRR).");

    const charts = {
      valueDebtEquity: {
        totalCurrentEstimatedValue,
        totalOutstandingBondBalance,
        portfolioEquity
      },
      monthlyIncomeExpenses,
      expenseBreakdown,
      propertyTypeAllocation,
      cashFlowByProperty: cashFlowByProperty.sort((a, b) => b.netCashFlow - a.netCashFlow),
      equityByProperty: equityByProperty.sort((a, b) => (b.equity ?? -Infinity) - (a.equity ?? -Infinity)),
      leaseTimeline: leaseTimeline.sort((a, b) => (a.fixedTermEndDate ? new Date(a.fixedTermEndDate).getTime() : Infinity) - (b.fixedTermEndDate ? new Date(b.fixedTermEndDate).getTime() : Infinity)),
      shortTermRentalPerformance,
      vacantLandHoldingCosts,

      monthlyNOITrend,
      incomeExpenseComposition
    };

    const kpiStatus = (value: number) => (value < 0 ? "negative" : "positive");

    const response = {
      filters: { propertyTypes, propertyId, month: monthParam ?? null },
      kpis: {
        monthlyNOI: {
          value: monthlyNOI,
          status: kpiStatus(monthlyNOI),
          operatingIncome: totalMonthlyIncome,
          operatingIncomeActualReceived: totalMonthlyIncomeActual + strNet,
          operatingIncomeProjectedFromLeases: totalMonthlyLeaseRent + strNet,
          operatingExpenses: totalMonthlyOperatingExpenses,
          explanation: "Income less operating expenses, before debt service."
        },
        monthlyExpenses: {
          value: monthlyExpensesTotal,
          operatingExpenses: totalMonthlyOperatingExpenses,
          debtService: totalMonthlyDebtService,
          explanation: "Operating costs plus bond repayments."
        },
        trueCashOnCashROI: {
          valuePercent: cashOnCash == null ? null : cashOnCash * 100,
          annualPreTaxCashFlow,
          totalCashInvested: totalCashInvested || null,
          classification,
          explanation: "Annual pre-tax cash flow divided by actual cash invested."
        },
        portfolioIRR: {
          valuePercent: irr == null ? null : irr * 100,
          cashFlows: irrCashFlows,
          holdingPeriodYears: holdingYears,
          assumptions: irrAssumptions,
          canCalculate: Boolean(canIrr && irr != null),
          explanation: "Includes cash flow and estimated property value growth."
        },
        totalProperties: {
          value: totalProperties,
          breakdown: {
            occupied: occupiedProperties,
            vacant: vacantRentalProperties,
            land: landProperties,
            shortTerm: shortTermRentalProperties
          }
        }
      },
      charts: {
        monthlyNOITrend,
        incomeExpenseComposition
      },
      warnings
    };

    // Keep legacy fields for existing pages that may still read them
    return res.json({
      ...response,
      totalProperties,
      propertiesByType,
      tenantRequiredProperties,
      occupiedProperties,
      vacantRentalProperties,
      landProperties,
      shortTermRentalProperties,
      occupancyRate,

      totalCurrentEstimatedValue,
      totalOutstandingBondBalance,
      portfolioEquity,
      totalPurchasePrice,

      monthlyRentRoll,
      monthlyShortTermRentalRevenue,
      totalMonthlyIncome,
      totalMonthlyOperatingExpenses,
      totalMonthlyDebtService,
      monthlyNetCashFlow,

      annualNOI,
      averageCapRate,
      averageGrossYield: 0,
      averageNetYield: 0,
      operatingExpenseRatio,

      depositsHeld,

      rentDue,
      leases,

      missingData: {
        missingCurrentEstimatedValue,
        missingOutstandingBondBalance,
        missingPurchasePrice,
        missingLeaseDocuments,
        missingExpenseData
      },
      charts
    });
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties/dashboard-summary failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to load dashboard summary." });
  }
});

// TENANTS (directory + profiles)
ownedPropertiesRoutes.get("/tenants", async (req: AuthRequest, res) => {
  try {
    const propertyId = req.query.propertyId != null ? Number(req.query.propertyId) : null;
    const status = typeof req.query.status === "string" ? req.query.status : null;
    if (propertyId != null && Number.isNaN(propertyId)) return res.status(400).json({ message: "Invalid propertyId" });

    const tenants = await db.tenant.findMany({
      where: {
        userId: req.userId!,
        ...(propertyId != null ? { propertyId } : {}),
        ...(status ? { status: status as any } : {})
      },
      include: { property: true },
      orderBy: { createdAt: "desc" }
    });
    return res.json({ tenants });
  } catch (err: any) {
    console.error("[ownedProperties] GET /tenants failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to load tenants." });
  }
});

ownedPropertiesRoutes.post("/tenants", async (req: AuthRequest, res) => {
  try {
    if (!req.body?.firstName || !req.body?.lastName) return res.status(400).json({ message: "firstName and lastName are required" });
    const propertyId = req.body.propertyId != null ? Number(req.body.propertyId) : null;
    if (propertyId != null) {
      const property = await assertPropertyOwner(req.userId!, propertyId);
      if (!property) return res.status(404).json({ message: "Property not found." });
    }

    const created = await db.tenant.create({
      data: {
        userId: req.userId!,
        propertyId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email ?? null,
        phone: req.body.phone ?? null,
        idNumber: req.body.idNumber ?? null,
        emergencyContactName: req.body.emergencyContactName ?? null,
        emergencyContactPhone: req.body.emergencyContactPhone ?? null,
        status: req.body.status ?? "ACTIVE"
      }
    });
    return res.status(201).json({ tenant: created });
  } catch (err: any) {
    console.error("[ownedProperties] POST /tenants failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to create tenant." });
  }
});

ownedPropertiesRoutes.get("/tenants/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const tenant = await db.tenant.findFirst({
      where: { id, userId: req.userId! },
      include: { property: true, leases: { include: { property: true }, orderBy: { createdAt: "desc" } } }
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });
    const currentLease = tenant.leases.find((l) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })));
    return res.json({
      tenant,
      currentLease: currentLease
        ? { ...currentLease, displayStatus: leaseDisplayStatus({ status: currentLease.status, fixedTermEndDate: currentLease.fixedTermEndDate }) }
        : null
    });
  } catch (err: any) {
    console.error("[ownedProperties] GET /tenants/:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to load tenant." });
  }
});

ownedPropertiesRoutes.put("/tenants/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const tenant = await db.tenant.findFirst({ where: { id, userId: req.userId! }, include: { leases: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const nextPropertyId = req.body.propertyId !== undefined ? (req.body.propertyId == null ? null : Number(req.body.propertyId)) : undefined;
    if (nextPropertyId !== undefined && nextPropertyId != null) {
      const property = await assertPropertyOwner(req.userId!, nextPropertyId);
      if (!property) return res.status(404).json({ message: "Property not found." });
    }

    if (nextPropertyId !== undefined && nextPropertyId !== tenant.propertyId) {
      const currentLease = await db.lease.findFirst({
        where: { userId: req.userId!, tenantId: tenant.id, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } }
      });
      if (currentLease && currentLease.propertyId !== nextPropertyId) {
        return res.status(400).json({ message: "Tenant has an active lease. Cancel or terminate the current lease before moving the tenant." });
      }
    }

    const updated = await db.tenant.update({
      where: { id },
      data: {
        firstName: req.body.firstName ?? tenant.firstName,
        lastName: req.body.lastName ?? tenant.lastName,
        email: req.body.email !== undefined ? req.body.email : tenant.email,
        phone: req.body.phone !== undefined ? req.body.phone : tenant.phone,
        idNumber: req.body.idNumber !== undefined ? req.body.idNumber : tenant.idNumber,
        emergencyContactName: req.body.emergencyContactName !== undefined ? req.body.emergencyContactName : tenant.emergencyContactName,
        emergencyContactPhone: req.body.emergencyContactPhone !== undefined ? req.body.emergencyContactPhone : tenant.emergencyContactPhone,
        status: req.body.status ?? tenant.status,
        propertyId: nextPropertyId === undefined ? tenant.propertyId : nextPropertyId
      }
    });
    return res.json({ tenant: updated });
  } catch (err: any) {
    console.error("[ownedProperties] PUT /tenants/:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to update tenant." });
  }
});

ownedPropertiesRoutes.delete("/tenants/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const tenant = await db.tenant.findFirst({ where: { id, userId: req.userId! }, include: { leases: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });
    if (tenant.leases.length) {
      const updated = await db.tenant.update({ where: { id }, data: { status: "PAST" } });
      return res.json({ message: "Tenant marked as past (historical leases retained).", tenant: updated });
    }
    await db.tenant.delete({ where: { id } });
    return res.json({ message: "Deleted" });
  } catch (err: any) {
    console.error("[ownedProperties] DELETE /tenants/:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to delete tenant." });
  }
});

ownedPropertiesRoutes.get("/properties/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const property = await db.property.findFirst({
      where: { id, userId: req.userId! },
      include: {
        tenants: true,
        leases: { include: { tenant: true }, orderBy: { createdAt: "desc" } },
        documents: true,
        incomeEntries: { where: { status: { not: "ARCHIVED" } }, orderBy: { incomeDate: "desc" } },
        expenses: { where: { status: { not: "ARCHIVED" } }, orderBy: { expenseDate: "desc" } },
        invoices: { include: { lineItems: true }, orderBy: { createdAt: "desc" } }
      }
    });
    if (!property) return res.status(404).json({ message: "Property not found" });
    const currentLease = property.leases.find((l) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))) ?? null;
    const currentLeaseDisplayStatus = currentLease ? leaseDisplayStatus({ status: currentLease.status, fixedTermEndDate: currentLease.fixedTermEndDate }) : "VACANT";
    const directTenant = property.tenants.find((t) => t.status === "ACTIVE") ?? null;
    const currentTenant = (currentLease?.tenant as any) ?? directTenant;
    const occupancyStatus = currentLease || directTenant ? "OCCUPIED" : "VACANT";
    return res.json({
      ...property,
      occupancyStatus,
      leaseDisplayStatus: currentLeaseDisplayStatus,
      currentTenant: currentTenant
        ? { id: currentTenant.id, firstName: currentTenant.firstName, lastName: currentTenant.lastName, email: currentTenant.email, phone: currentTenant.phone }
        : null,
      currentLease: currentLease
        ? {
            id: currentLease.id,
            leaseType: currentLease.leaseType,
            status: currentLease.status,
            displayStatus: currentLeaseDisplayStatus,
            startDate: currentLease.startDate,
            fixedTermEndDate: currentLease.fixedTermEndDate,
            monthlyRent: currentLease.monthlyRent,
            depositAmount: currentLease.depositAmount,
            rentDueDay: currentLease.rentDueDay
          }
        : null,
      allTenantsCount: property.tenants.length
    });
  } catch (err: any) {
    console.error("[ownedProperties] GET /properties/:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Could not load property details." });
  }
});

ownedPropertiesRoutes.put("/properties/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await assertPropertyOwner(req.userId!, id);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  try {
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.property.update({
        where: { id },
        data: {
          name: req.body.name,
          propertyType: req.body.propertyType,
          investmentType: req.body.investmentType ?? undefined,
          addressLine1: req.body.addressLine1,
          addressLine2: req.body.addressLine2 ?? null,
          suburb: req.body.suburb ?? null,
          city: req.body.city,
          province: req.body.province,
          postalCode: req.body.postalCode ?? null,
          country: req.body.country ?? "South Africa",
          erfNumber: req.body.erfNumber ?? null,
          sizeSqm: req.body.sizeSqm != null ? asNumber(req.body.sizeSqm) : null,
          bedrooms: req.body.bedrooms != null ? Number(req.body.bedrooms) : null,
          bathrooms: req.body.bathrooms != null ? Number(req.body.bathrooms) : null,
          parkingBays: req.body.parkingBays != null ? Number(req.body.parkingBays) : null,
          purchasePrice: req.body.purchasePrice != null ? asNumber(req.body.purchasePrice) : existing.purchasePrice,
          purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : null,
          currentEstimatedValue: req.body.currentEstimatedValue != null ? asNumber(req.body.currentEstimatedValue) : null,
          outstandingBondBalance: req.body.outstandingBondBalance != null ? asNumber(req.body.outstandingBondBalance) : null,
          monthlyBondPayment: req.body.monthlyBondPayment != null ? asNumber(req.body.monthlyBondPayment) : null,
          totalCashInvested: req.body.totalCashInvested != null ? asNumber(req.body.totalCashInvested) : null,
          bondCosts: req.body.bondCosts != null ? asNumber(req.body.bondCosts) : null,
          transferCosts: req.body.transferCosts != null ? asNumber(req.body.transferCosts) : null,
          holdingPeriodYears: req.body.holdingPeriodYears != null ? Number(req.body.holdingPeriodYears) : null,
          estimatedSellingCostPercent: req.body.estimatedSellingCostPercent != null ? asNumber(req.body.estimatedSellingCostPercent) : null,
          expectedMonthlyIncome: req.body.expectedMonthlyIncome != null ? asNumber(req.body.expectedMonthlyIncome) : null,
          expectedMonthlyExpenses: req.body.expectedMonthlyExpenses != null ? asNumber(req.body.expectedMonthlyExpenses) : null,
          status: req.body.status ?? null,
          notes: req.body.notes ?? null,

          landUse: req.body.landUse ?? null,
          zoning: req.body.zoning ?? null,
          ratesAndTaxesMonthly: req.body.ratesAndTaxesMonthly != null ? asNumber(req.body.ratesAndTaxesMonthly) : null,
          leviesMonthly: req.body.leviesMonthly != null ? asNumber(req.body.leviesMonthly) : null,
          securityMonthly: req.body.securityMonthly != null ? asNumber(req.body.securityMonthly) : null,
          maintenanceMonthly: req.body.maintenanceMonthly != null ? asNumber(req.body.maintenanceMonthly) : null,
          expectedAnnualAppreciationPercent:
            req.body.expectedAnnualAppreciationPercent != null ? asNumber(req.body.expectedAnnualAppreciationPercent) : null,

          averageDailyRate: req.body.averageDailyRate != null ? asNumber(req.body.averageDailyRate) : null,
          occupancyRate: req.body.occupancyRate != null ? asNumber(req.body.occupancyRate) : null,
          availableNightsPerMonth: req.body.availableNightsPerMonth != null ? Number(req.body.availableNightsPerMonth) : null,
          platformFeePercent: req.body.platformFeePercent != null ? asNumber(req.body.platformFeePercent) : null,
          cleaningFeesMonthly: req.body.cleaningFeesMonthly != null ? asNumber(req.body.cleaningFeesMonthly) : null,
          managementFeePercent: req.body.managementFeePercent != null ? asNumber(req.body.managementFeePercent) : null,
          furnishingValue: req.body.furnishingValue != null ? asNumber(req.body.furnishingValue) : null,
          monthlyUtilities: req.body.monthlyUtilities != null ? asNumber(req.body.monthlyUtilities) : null,

          rehabBudget: req.body.rehabBudget != null ? asNumber(req.body.rehabBudget) : null,
          holdingCostsMonthly: req.body.holdingCostsMonthly != null ? asNumber(req.body.holdingCostsMonthly) : null,
          expectedSalePrice: req.body.expectedSalePrice != null ? asNumber(req.body.expectedSalePrice) : null,
          targetSaleDate: req.body.targetSaleDate ? new Date(req.body.targetSaleDate) : null,
          projectStage: req.body.projectStage ?? null,

          afterRepairValue: req.body.afterRepairValue != null ? asNumber(req.body.afterRepairValue) : null,
          refinanceAmount: req.body.refinanceAmount != null ? asNumber(req.body.refinanceAmount) : null,
          brrrrStage: req.body.brrrrStage ?? null
        }
      });

      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const upsertSetupRecurringExpense = async (category: any, description: string, amountRaw: any) => {
        const amount = amountRaw != null ? asNumber(amountRaw) : 0;
        // Match by category + description so we don't collide on category "OTHER"
        const existingSetup = await tx.propertyExpense.findFirst({
          where: {
            userId: req.userId!,
            propertyId: id,
            category,
            description,
            isRecurring: true,
            recurringFrequency: "MONTHLY"
          },
          orderBy: { createdAt: "asc" }
        });

        if (!amount || amount <= 0) {
          if (existingSetup) {
            await tx.propertyExpense.update({ where: { id: existingSetup.id }, data: { status: "ARCHIVED" } });
          }
          return;
        }

        if (existingSetup) {
          await tx.propertyExpense.update({
            where: { id: existingSetup.id },
            data: { amount, description, recurringFrequency: "MONTHLY", source: "PROPERTY_SETUP", status: "ACTIVE" }
          });
          return;
        }

        await tx.propertyExpense.create({
          data: {
            userId: req.userId!,
            propertyId: id,
            category,
            description,
            amount,
            expenseDate: firstOfMonth,
            isRecurring: true,
            recurringFrequency: "MONTHLY",
            source: "PROPERTY_SETUP",
            status: "ACTIVE"
          }
        });
      };

      // Keep setup monthly fields in sync as PropertyExpense records (single source of truth for Financials/Dashboard)
      if (req.body.ratesAndTaxesMonthly !== undefined) await upsertSetupRecurringExpense("RATES_TAXES", "Rates & taxes (setup)", req.body.ratesAndTaxesMonthly);
      if (req.body.leviesMonthly !== undefined) await upsertSetupRecurringExpense("LEVIES", "Levies (setup)", req.body.leviesMonthly);
      if (req.body.maintenanceMonthly !== undefined) await upsertSetupRecurringExpense("MAINTENANCE", "Maintenance (setup)", req.body.maintenanceMonthly);
      if (req.body.securityMonthly !== undefined) await upsertSetupRecurringExpense("OTHER", "Security (setup)", req.body.securityMonthly);
      if (req.body.expectedMonthlyExpenses !== undefined) await upsertSetupRecurringExpense("OTHER", "Other monthly expenses (setup)", req.body.expectedMonthlyExpenses);
      if (req.body.monthlyBondPayment !== undefined) await upsertSetupRecurringExpense("BOND_PAYMENT", "Bond payment (setup)", req.body.monthlyBondPayment);

      const tenantId = req.body.tenantId != null ? Number(req.body.tenantId) : null;
      const newTenant = req.body.newTenant ?? null;
      if (tenantId || newTenant) {
        const currentLease = await tx.lease.findFirst({
          where: { userId: req.userId!, propertyId: id, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } }
        });
        if (currentLease && tenantId && currentLease.tenantId !== tenantId) {
          throw new Error("Cannot change tenant while a current lease exists. Cancel the lease first.");
        }

        if (tenantId) {
          const tenant = await tx.tenant.findFirst({ where: { id: tenantId, userId: req.userId! } });
          if (!tenant) throw new Error("Invalid tenant");
          await tx.tenant.update({ where: { id: tenantId }, data: { propertyId: id, status: "ACTIVE" } });
        } else if (newTenant?.firstName && newTenant?.lastName && newTenant?.email && newTenant?.phone) {
          await tx.tenant.create({
            data: {
              userId: req.userId!,
              propertyId: id,
              firstName: newTenant.firstName,
              lastName: newTenant.lastName,
              email: newTenant.email,
              phone: newTenant.phone,
              idNumber: newTenant.idNumber ?? null,
              status: "ACTIVE"
            }
          });
        }
      }

      return updated;
    });
    return res.json(result);
  } catch (err: any) {
    console.error("[ownedProperties] PUT /properties/:id failed", err?.stack ?? err);
    return res.status(400).json({ message: err?.message ?? "Failed to update property." });
  }
});

ownedPropertiesRoutes.delete("/properties/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await assertPropertyOwner(req.userId!, id);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  await db.property.delete({ where: { id } });
  return res.json({ message: "Deleted" });
});

ownedPropertiesRoutes.get("/properties/:propertyId/tenants", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const tenants = await db.tenant.findMany({
    where: {
      userId: req.userId!,
      OR: [
        { propertyId },
        { leases: { some: { propertyId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } } } }
      ]
    },
    include: {
      leases: {
        where: { propertyId },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const enriched = tenants.map((t) => {
    const lease = t.leases.find((l) => isCurrentLeaseStatus(leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }))) ?? null;
    const displayStatus = lease ? leaseDisplayStatus({ status: lease.status, fixedTermEndDate: lease.fixedTermEndDate }) : "VACANT";
    return {
      ...t,
      currentLease: lease
        ? {
            id: lease.id,
            status: lease.status,
            displayStatus,
            leaseType: lease.leaseType,
            startDate: lease.startDate,
            fixedTermEndDate: lease.fixedTermEndDate,
            monthlyRent: lease.monthlyRent,
            depositAmount: lease.depositAmount,
            rentDueDay: lease.rentDueDay
          }
        : null
    };
  });

  return res.json({ tenants: enriched });
});

ownedPropertiesRoutes.post("/properties/:propertyId/tenants", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  if (!req.body?.firstName || !req.body?.lastName) return res.status(400).json({ message: "firstName and lastName are required" });
  const tenant = await db.tenant.create({
    data: {
      userId: req.userId!,
      propertyId,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email ?? null,
      phone: req.body.phone ?? null,
      idNumber: req.body.idNumber ?? null,
      emergencyContactName: req.body.emergencyContactName ?? null,
      emergencyContactPhone: req.body.emergencyContactPhone ?? null,
      status: req.body.status ?? "ACTIVE"
    }
  });
  return res.status(201).json(tenant);
});

ownedPropertiesRoutes.patch("/properties/:propertyId/tenants/:tenantId/link", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const tenantId = Number(req.params.tenantId);
    const property = await assertPropertyOwner(req.userId!, propertyId);
    if (!property) return res.status(404).json({ message: "Property not found." });
    const tenant = await db.tenant.findFirst({ where: { id: tenantId, userId: req.userId! } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const currentLease = await db.lease.findFirst({ where: { userId: req.userId!, tenantId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } } });
    if (currentLease && currentLease.propertyId !== propertyId) {
      return res.status(400).json({ message: "Tenant has an active lease. Cancel or terminate the current lease before moving the tenant." });
    }

    const updated = await db.tenant.update({ where: { id: tenantId }, data: { propertyId, status: "ACTIVE" } });
    return res.json({ tenant: updated });
  } catch (err: any) {
    console.error("[ownedProperties] PATCH /properties/:propertyId/tenants/:tenantId/link failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to link tenant to property." });
  }
});

ownedPropertiesRoutes.patch("/properties/:propertyId/tenants/:tenantId/unlink", async (req: AuthRequest, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const tenantId = Number(req.params.tenantId);
    const property = await assertPropertyOwner(req.userId!, propertyId);
    if (!property) return res.status(404).json({ message: "Property not found." });
    const tenant = await db.tenant.findFirst({ where: { id: tenantId, userId: req.userId! } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const currentLease = await db.lease.findFirst({
      where: { userId: req.userId!, tenantId, propertyId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } }
    });
    if (currentLease) return res.status(400).json({ message: "Cancel the current lease before unlinking this tenant." });

    const updated = await db.tenant.update({ where: { id: tenantId }, data: { propertyId: null } });
    return res.json({ tenant: updated });
  } catch (err: any) {
    console.error("[ownedProperties] PATCH /properties/:propertyId/tenants/:tenantId/unlink failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to unlink tenant." });
  }
});

ownedPropertiesRoutes.get("/properties/:propertyId/leases", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const leases = await db.lease.findMany({
    where: { userId: req.userId!, propertyId },
    include: { tenant: true },
    orderBy: { createdAt: "desc" }
  });
  const withDisplay = leases.map((l) => ({
    ...l,
    displayStatus: leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate })
  }));
  const currentLease = withDisplay.find((l) => isCurrentLeaseStatus(l.displayStatus)) ?? null;
  const historicalLeases = withDisplay.filter((l) => !isCurrentLeaseStatus(l.displayStatus));
  return res.json({
    currentLease,
    historicalLeases,
    leases: withDisplay
  });
});

ownedPropertiesRoutes.get("/properties/:propertyId/current-lease", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const leases = await db.lease.findMany({
    where: { userId: req.userId!, propertyId },
    include: { tenant: true },
    orderBy: { createdAt: "desc" }
  });
  const current = leases
    .map((l) => ({ ...l, displayStatus: leaseDisplayStatus({ status: l.status, fixedTermEndDate: l.fixedTermEndDate }) }))
    .find((l) => isCurrentLeaseStatus(l.displayStatus)) ?? null;
  return res.json({ currentLease: current });
});

ownedPropertiesRoutes.post("/properties/:propertyId/leases", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const tenantId = Number(req.body.tenantId);
  if (!tenantId) return res.status(400).json({ message: "tenantId is required" });
  if (!req.body?.startDate) return res.status(400).json({ message: "startDate is required" });
  if (!isValidDayOfMonth(req.body.rentDueDay ?? 1)) return res.status(400).json({ message: "rentDueDay must be between 1 and 31" });

  const leaseType = req.body.leaseType ?? "FIXED_TERM";
  if (!["FIXED_TERM", "MONTH_TO_MONTH"].includes(leaseType)) return res.status(400).json({ message: "Invalid leaseType" });

  const tenant = await db.tenant.findFirst({
    where: { id: tenantId, userId: req.userId!, OR: [{ propertyId }, { propertyId: null }] }
  });
  if (!tenant) return res.status(400).json({ message: "Invalid tenant" });

  const existingTenantCurrentLease = await db.lease.findFirst({
    where: { userId: req.userId!, tenantId, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] }, cancellationDate: null }
  });
  if (existingTenantCurrentLease) {
    return res.status(409).json({
      message: "This tenant already has a current lease. Cancel the existing lease before creating a new one.",
      blocking: {
        tenantLeaseId: existingTenantCurrentLease?.id ?? null,
        tenantLeasePropertyId: existingTenantCurrentLease?.propertyId ?? null,
        tenantLeaseStatus: existingTenantCurrentLease?.status ?? null
      }
    });
  }

  const fixedTermEndDate = req.body.fixedTermEndDate
    ? new Date(req.body.fixedTermEndDate)
    : req.body.endDate
      ? new Date(req.body.endDate)
      : null;
  const startDate = new Date(req.body.startDate);
  if (Number.isNaN(startDate.getTime())) return res.status(400).json({ message: "Invalid startDate" });
  if (fixedTermEndDate && Number.isNaN(fixedTermEndDate.getTime())) return res.status(400).json({ message: "Invalid fixedTermEndDate" });
  if (fixedTermEndDate && fixedTermEndDate <= startDate) return res.status(400).json({ message: "fixedTermEndDate must be after startDate" });

  const monthlyRent = asNumber(req.body.monthlyRent);
  const depositAmount = asNumber(req.body.depositAmount);
  if (monthlyRent < 0) return res.status(400).json({ message: "monthlyRent must be non-negative" });
  if (depositAmount < 0) return res.status(400).json({ message: "depositAmount must be non-negative" });

  const result = await db.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenantId }, data: { propertyId, status: "ACTIVE" } });
    const lease = await tx.lease.create({
      data: {
        userId: req.userId!,
        propertyId,
        tenantId,
        startDate,
        fixedTermEndDate,
        leaseType,
        monthlyRent,
        depositAmount,
        rentDueDay: req.body.rentDueDay != null ? Number(req.body.rentDueDay) : 1,
        escalationPercent: req.body.escalationPercent != null ? asNumber(req.body.escalationPercent) : null,
        escalationDate: req.body.escalationDate ? new Date(req.body.escalationDate) : null,
        status: leaseType === "MONTH_TO_MONTH" ? "MONTH_TO_MONTH" : "ACTIVE",
        leaseDocumentId: req.body.leaseDocumentId != null ? Number(req.body.leaseDocumentId) : null,
        notes: req.body.notes ?? null
      }
    });

    // Create a pending recurring expected rent rule (does NOT create received income)
    await tx.recurringIncomeRule.create({
      data: {
        userId: req.userId!,
        propertyId,
        tenantId,
        leaseId: lease.id,
        category: "RENT",
        amount: monthlyRent,
        frequency: "MONTHLY",
        dayOfMonth: lease.rentDueDay,
        startDate: lease.startDate,
        endDate: lease.leaseType === "FIXED_TERM" ? lease.fixedTermEndDate : null,
        status: "PAUSED",
        autoCreateExpectedEntries: true
      }
    });
    return lease;
  });

  return res.status(201).json(result);
});

ownedPropertiesRoutes.put("/leases/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const lease = await db.lease.findFirst({
    where: { id, userId: req.userId! },
    include: { invoices: true, incomeEntries: true }
  });
  if (!lease) return res.status(404).json({ message: "Lease not found" });
  if (["CANCELLED", "TERMINATED"].includes(lease.status as any)) return res.status(400).json({ message: "Cannot edit a cancelled/terminated lease." });
  const isArchived = lease.status === ("ARCHIVED" as any);
  const hasLinks = (lease.invoices?.length ?? 0) > 0 || (lease.incomeEntries?.length ?? 0) > 0;
  if (isArchived && hasLinks) {
    return res.status(400).json({ message: "Cannot edit an archived lease that has linked invoices/income entries." });
  }

  const patch: any = {};
  if (req.body.monthlyRent != null) patch.monthlyRent = asNumber(req.body.monthlyRent);
  if (req.body.depositAmount != null) patch.depositAmount = asNumber(req.body.depositAmount);
  if (req.body.rentDueDay != null) {
    if (!isValidDayOfMonth(req.body.rentDueDay)) return res.status(400).json({ message: "rentDueDay must be between 1 and 31" });
    patch.rentDueDay = Number(req.body.rentDueDay);
  }
  if (req.body.startDate) patch.startDate = new Date(req.body.startDate);
  if (req.body.fixedTermEndDate !== undefined) patch.fixedTermEndDate = req.body.fixedTermEndDate ? new Date(req.body.fixedTermEndDate) : null;
  if (req.body.leaseType) patch.leaseType = req.body.leaseType;
  if (req.body.notes !== undefined) patch.notes = req.body.notes ?? null;

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.lease.update({ where: { id }, data: patch });
    if (patch.monthlyRent != null) {
      await tx.recurringIncomeRule.updateMany({
        where: { userId: req.userId!, leaseId: id },
        data: { amount: patch.monthlyRent }
      });
    }
    if (patch.rentDueDay != null) {
      await tx.recurringIncomeRule.updateMany({
        where: { userId: req.userId!, leaseId: id },
        data: { dayOfMonth: patch.rentDueDay }
      });
    }
    if (patch.startDate != null || patch.fixedTermEndDate !== undefined) {
      await tx.recurringIncomeRule.updateMany({
        where: { userId: req.userId!, leaseId: id },
        data: {
          startDate: patch.startDate ?? lease.startDate,
          endDate: patch.fixedTermEndDate !== undefined ? patch.fixedTermEndDate : lease.fixedTermEndDate
        }
      });
    }
    return next;
  });

  return res.json(updated);
});

ownedPropertiesRoutes.delete("/leases/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const lease = await db.lease.findFirst({
    where: { id, userId: req.userId! },
    include: { invoices: true, incomeEntries: true }
  });
  if (!lease) return res.status(404).json({ message: "Lease not found" });
  const isDraft = lease.status === "DRAFT";
  const hasLinks = (lease.invoices?.length ?? 0) > 0 || (lease.incomeEntries?.length ?? 0) > 0;

  if (isDraft && !hasLinks) {
    await db.$transaction(async (tx) => {
      await tx.recurringIncomeRule.deleteMany({ where: { userId: req.userId!, leaseId: id } });
      await tx.lease.delete({ where: { id } });
    });
    return res.json({ message: "Deleted draft lease" });
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.recurringIncomeRule.updateMany({ where: { userId: req.userId!, leaseId: id }, data: { status: "CANCELLED" } });
    return await tx.lease.update({ where: { id }, data: { status: "ARCHIVED" } });
  });
  return res.json({ message: "Archived lease", lease: updated });
});

ownedPropertiesRoutes.post("/properties/:propertyId/documents/upload", upload.single("file"), async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  if (!req.file) return res.status(400).json({ message: "No file uploaded or file type invalid" });
  const doc = await db.propertyDocument.create({
    data: {
      userId: req.userId!,
      propertyId,
      leaseId: req.body.leaseId ? Number(req.body.leaseId) : null,
      documentType: req.body.documentType ?? "OTHER",
      fileName: req.file.originalname,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      fileSize: req.file.size
    }
  });
  return res.status(201).json(doc);
});

ownedPropertiesRoutes.get("/properties/:propertyId/documents", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  return res.json(await db.propertyDocument.findMany({ where: { userId: req.userId!, propertyId }, orderBy: { uploadedAt: "desc" } }));
});

ownedPropertiesRoutes.get("/documents/:id/download", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const doc = await db.propertyDocument.findFirst({ where: { id, userId: req.userId! } });
  if (!doc) return res.status(404).json({ message: "Document not found" });
  return res.download(doc.filePath, doc.fileName);
});

ownedPropertiesRoutes.delete("/documents/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const doc = await db.propertyDocument.findFirst({ where: { id, userId: req.userId! } });
  if (!doc) return res.status(404).json({ message: "Document not found" });
  await db.propertyDocument.delete({ where: { id } });
  try {
    await fs.unlink(doc.filePath);
  } catch {
    // noop for missing files
  }
  return res.json({ message: "Deleted" });
});

ownedPropertiesRoutes.get("/properties/:propertyId/financials", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });

  const includeArchived = req.query.includeArchived === "true";
  const expenseWhere: any = { userId: req.userId!, propertyId };
  const incomeWhere: any = { userId: req.userId!, propertyId };
  if (!includeArchived) {
    expenseWhere.status = { not: "ARCHIVED" };
    incomeWhere.status = { not: "ARCHIVED" };
  }

  const [summary, expenses, income, recurringRules] = await Promise.all([
    computeFinancialSummary(req.userId!, propertyId),
    db.propertyExpense.findMany({ where: expenseWhere, orderBy: { expenseDate: "desc" } }),
    db.propertyIncome.findMany({ where: incomeWhere, orderBy: { incomeDate: "desc" } }),
    db.recurringIncomeRule.findMany({ where: { userId: req.userId!, propertyId }, orderBy: { createdAt: "desc" } })
  ]);

  return res.json({ propertyId, summary, expenses, income, recurringIncomeRules: recurringRules });
});

ownedPropertiesRoutes.get("/properties/:propertyId/financials/summary", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const summary = await computeFinancialSummary(req.userId!, propertyId);
  if (!summary) return res.status(404).json({ message: "Property not found" });

  const incomeByMonth = await db.propertyIncome.groupBy({
    by: ["incomeDate"],
    where: { userId: req.userId!, propertyId, status: "RECEIVED" },
    _sum: { amount: true }
  });
  const expenseByMonth = await db.propertyExpense.groupBy({
    by: ["expenseDate"],
    where: { userId: req.userId!, propertyId, status: "ACTIVE" },
    _sum: { amount: true }
  });
  const expenseBreakdown = await db.propertyExpense.groupBy({
    by: ["category"],
    where: { userId: req.userId!, propertyId, status: "ACTIVE" },
    _sum: { amount: true }
  });

  return res.json({
    ...summary,
    charts: {
      incomeVsExpensesOverTime: {
        income: incomeByMonth.map((i) => ({ date: i.incomeDate, amount: i._sum.amount ?? 0 })),
        expenses: expenseByMonth.map((e) => ({ date: e.expenseDate, amount: e._sum.amount ?? 0 }))
      },
      expenseBreakdownByCategory: expenseBreakdown.map((e) => ({ category: e.category, amount: e._sum.amount ?? 0 })),
      cashFlowByMonth: incomeByMonth.map((i) => {
        const month = `${i.incomeDate.getFullYear()}-${String(i.incomeDate.getMonth() + 1).padStart(2, "0")}`;
        const expenseForMonth = expenseByMonth
          .filter((e) => `${e.expenseDate.getFullYear()}-${String(e.expenseDate.getMonth() + 1).padStart(2, "0")}` === month)
          .reduce((acc, e) => acc + (e._sum.amount ?? 0), 0);
        return { month, cashFlow: (i._sum.amount ?? 0) - expenseForMonth };
      })
    }
  });
});

ownedPropertiesRoutes.post("/properties/:propertyId/expenses", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const created = await db.propertyExpense.create({
    data: {
      userId: req.userId!,
      propertyId,
      category: req.body.category,
      description: req.body.description,
      amount: asNumber(req.body.amount),
      expenseDate: new Date(req.body.expenseDate),
      isRecurring: Boolean(req.body.isRecurring),
      recurringFrequency: req.body.recurringFrequency ?? null,
      source: req.body.source ?? "MANUAL_FINANCIAL_ENTRY",
      status: req.body.status ?? "ACTIVE"
    }
  });
  return res.status(201).json(created);
});

ownedPropertiesRoutes.post("/properties/:propertyId/income", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const created = await db.propertyIncome.create({
    data: {
      userId: req.userId!,
      propertyId,
      tenantId: req.body.tenantId != null ? Number(req.body.tenantId) : null,
      leaseId: req.body.leaseId != null ? Number(req.body.leaseId) : null,
      category: req.body.category,
      description: req.body.description,
      amount: asNumber(req.body.amount),
      incomeDate: new Date(req.body.incomeDate),
      source: req.body.source ?? "MANUAL_FINANCIAL_ENTRY",
      status: req.body.status ?? "RECEIVED"
    }
  });
  return res.status(201).json(created);
});

ownedPropertiesRoutes.get("/properties/:propertyId/expenses", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  return res.json(await db.propertyExpense.findMany({ where: { userId: req.userId!, propertyId }, orderBy: { expenseDate: "desc" } }));
});

ownedPropertiesRoutes.get("/properties/:propertyId/income", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  return res.json(await db.propertyIncome.findMany({ where: { userId: req.userId!, propertyId }, orderBy: { incomeDate: "desc" } }));
});

ownedPropertiesRoutes.delete("/expenses/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.propertyExpense.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Expense not found" });
  const updated = await db.propertyExpense.update({ where: { id }, data: { status: "ARCHIVED" } });
  return res.json({ message: "Archived", expense: updated });
});

ownedPropertiesRoutes.delete("/income/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.propertyIncome.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Income not found" });
  const updated = await db.propertyIncome.update({ where: { id }, data: { status: "ARCHIVED" } });
  return res.json({ message: "Archived", income: updated });
});

ownedPropertiesRoutes.post("/income/:id/mark-received", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.propertyIncome.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Income not found" });
  if (existing.status !== "EXPECTED") return res.status(400).json({ message: "Only EXPECTED income can be marked as received." });

  const paymentDate = req.body?.paymentDate ? new Date(req.body.paymentDate) : new Date();
  const updated = await db.propertyIncome.update({
    where: { id },
    data: {
      status: "RECEIVED",
      incomeDate: paymentDate
    }
  });
  return res.json({ income: updated });
});

ownedPropertiesRoutes.put("/income/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.propertyIncome.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Income not found" });
  if (existing.status === "ARCHIVED") return res.status(400).json({ message: "Cannot edit an archived income entry." });

  const patch: any = {};
  if (req.body.tenantId !== undefined) patch.tenantId = req.body.tenantId == null ? null : Number(req.body.tenantId);
  if (req.body.leaseId !== undefined) patch.leaseId = req.body.leaseId == null ? null : Number(req.body.leaseId);
  if (req.body.category) patch.category = req.body.category;
  if (req.body.description !== undefined) patch.description = req.body.description ?? "";
  if (req.body.amount !== undefined) patch.amount = asNumber(req.body.amount);
  if (req.body.incomeDate) patch.incomeDate = new Date(req.body.incomeDate);
  if (req.body.status) patch.status = req.body.status;

  const updated = await db.propertyIncome.update({ where: { id }, data: patch });
  return res.json({ income: updated });
});

ownedPropertiesRoutes.get("/properties/:propertyId/invoices", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  return res.json(
    await db.invoice.findMany({
      where: { userId: req.userId!, propertyId },
      include: { lineItems: true, tenant: true },
      orderBy: { createdAt: "desc" }
    })
  );
});

ownedPropertiesRoutes.post("/properties/:propertyId/invoices", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const property = await assertPropertyOwner(req.userId!, propertyId);
  if (!property) return res.status(404).json({ message: "Property not found" });
  const tenant = await db.tenant.findFirst({ where: { id: Number(req.body.tenantId), propertyId, userId: req.userId! } });
  if (!tenant) return res.status(400).json({ message: "Invalid tenant for property" });
  const invoiceNumber = req.body.invoiceNumber ?? `INV-${Date.now()}`;
  const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
  const subtotal = lineItems.reduce((acc: number, item: any) => acc + asNumber(item.total, asNumber(item.quantity) * asNumber(item.unitPrice)), 0);
  const total = req.body.total != null ? asNumber(req.body.total) : subtotal;

  const created = await db.invoice.create({
    data: {
      userId: req.userId!,
      propertyId,
      tenantId: Number(req.body.tenantId),
      leaseId: req.body.leaseId != null ? Number(req.body.leaseId) : null,
      invoiceNumber,
      invoiceDate: new Date(req.body.invoiceDate),
      dueDate: new Date(req.body.dueDate),
      status: req.body.status ?? "DRAFT",
      subtotal,
      total,
      notes: req.body.notes ?? null,
      lineItems: {
        create: lineItems.map((item: any) => ({
          description: item.description,
          quantity: asNumber(item.quantity, 1),
          unitPrice: asNumber(item.unitPrice),
          total: asNumber(item.total, asNumber(item.quantity) * asNumber(item.unitPrice))
        }))
      }
    },
    include: { lineItems: true }
  });
  return res.status(201).json(created);
});

ownedPropertiesRoutes.get("/invoices/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await db.invoice.findFirst({
    where: { id, userId: req.userId! },
    include: { lineItems: true, property: true, tenant: true }
  });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  return res.json(invoice);
});

ownedPropertiesRoutes.put("/invoices/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.invoice.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Invoice not found" });
  const updated = await db.invoice.update({
    where: { id },
    data: {
      invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : existing.invoiceDate,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : existing.dueDate,
      status: req.body.status ?? existing.status,
      notes: req.body.notes ?? existing.notes,
      total: req.body.total != null ? asNumber(req.body.total) : existing.total
    }
  });
  return res.json(updated);
});

ownedPropertiesRoutes.post("/invoices/:id/generate-pdf", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await db.invoice.findFirst({
    where: { id, userId: req.userId! },
    include: { lineItems: true, property: true, tenant: true }
  });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const filePath = path.join(invoicePdfDir, `invoice-${invoice.id}-${Date.now()}.pdf`);
  const lines = [
    "The Property Guy",
    "Invoice",
    `Invoice Number: ${invoice.invoiceNumber}`,
    `Invoice Date: ${invoice.invoiceDate.toISOString().slice(0, 10)}`,
    `Due Date: ${invoice.dueDate.toISOString().slice(0, 10)}`,
    `Property: ${invoice.property.name}`,
    `Address: ${invoice.property.addressLine1}, ${invoice.property.city}`,
    `Tenant: ${invoice.tenant.firstName} ${invoice.tenant.lastName}`,
    `Tenant Email: ${invoice.tenant.email}`,
    "Line Items:",
    ...invoice.lineItems.map((i) => `${i.description} | ${i.quantity} x ${i.unitPrice.toFixed(2)} = ${i.total.toFixed(2)}`),
    `Subtotal: ${invoice.subtotal.toFixed(2)}`,
    `Total: ${invoice.total.toFixed(2)}`,
    "Banking details: [Add landlord bank details]",
    `Payment reference: ${invoice.invoiceNumber}`,
    invoice.notes ?? "Notes: -"
  ];
  await fs.writeFile(filePath, lines.join("\n"), "utf8");
  await db.invoice.update({ where: { id }, data: { pdfPath: filePath } });
  return res.json({ message: "Invoice PDF generated", downloadUrl: `/api/invoices/${id}/download` });
});

ownedPropertiesRoutes.get("/invoices/:id/download", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await db.invoice.findFirst({ where: { id, userId: req.userId! } });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  if (!invoice.pdfPath) return res.status(400).json({ message: "Invoice PDF not generated yet" });
  return res.download(invoice.pdfPath);
});

ownedPropertiesRoutes.post("/invoices/:id/mark-paid", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await db.invoice.findFirst({ where: { id, userId: req.userId! } });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  const updated = await db.invoice.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
  return res.json(updated);
});

ownedPropertiesRoutes.post("/invoices/:id/send-email", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const invoice = await db.invoice.findFirst({
    where: { id, userId: req.userId! },
    include: { tenant: true }
  });
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  if (!invoice.tenant.email) return res.status(400).json({ message: "Tenant email is missing." });
  const sent = await sendInvoiceEmail({
    to: invoice.tenant.email,
    subject: `Invoice ${invoice.invoiceNumber}`,
    text: `Invoice ${invoice.invoiceNumber} total ${invoice.total.toFixed(2)}`
  });
  if (!sent.ok) return res.status(400).json({ message: sent.message });
  await db.invoice.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
  return res.json({ message: sent.message });
});

ownedPropertiesRoutes.get("/properties/:propertyId/recurring-invoices", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  return res.json(await db.recurringInvoiceRule.findMany({ where: { userId: req.userId!, propertyId }, orderBy: { createdAt: "desc" } }));
});

ownedPropertiesRoutes.post("/properties/:propertyId/recurring-invoices", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const created = await db.recurringInvoiceRule.create({
    data: {
      userId: req.userId!,
      propertyId,
      tenantId: Number(req.body.tenantId),
      leaseId: req.body.leaseId != null ? Number(req.body.leaseId) : null,
      enabled: Boolean(req.body.enabled),
      frequency: "MONTHLY",
      dayOfMonth: req.body.dayOfMonth != null ? Number(req.body.dayOfMonth) : 1,
      nextRunDate: new Date(req.body.nextRunDate),
      invoiceDescription: req.body.invoiceDescription ?? "Monthly Rent",
      rentAmount: asNumber(req.body.rentAmount),
      includeUtilities: Boolean(req.body.includeUtilities),
      emailTenant: Boolean(req.body.emailTenant),
      tenantPermissionConfirmed: Boolean(req.body.tenantPermissionConfirmed)
    }
  });
  return res.status(201).json(created);
});

ownedPropertiesRoutes.put("/recurring-invoices/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.recurringInvoiceRule.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Recurring rule not found" });
  return res.json(await db.recurringInvoiceRule.update({ where: { id }, data: req.body }));
});

ownedPropertiesRoutes.delete("/recurring-invoices/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.recurringInvoiceRule.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Recurring rule not found" });
  await db.recurringInvoiceRule.delete({ where: { id } });
  return res.json({ message: "Deleted" });
});

ownedPropertiesRoutes.post("/recurring-invoices/run-due", async (req: AuthRequest, res) => {
  const now = new Date();
  const dueRules = await db.recurringInvoiceRule.findMany({
    where: { userId: req.userId!, enabled: true, nextRunDate: { lte: now } },
    include: { tenant: true }
  });
  const generated: any[] = [];

  for (const rule of dueRules) {
    const invoice = await db.invoice.create({
      data: {
        userId: req.userId!,
        propertyId: rule.propertyId,
        tenantId: rule.tenantId,
        leaseId: rule.leaseId,
        invoiceNumber: `AUTO-${Date.now()}-${rule.id}`,
        invoiceDate: now,
        dueDate: new Date(now.getFullYear(), now.getMonth(), Math.max(1, rule.dayOfMonth)),
        status: "DRAFT",
        subtotal: rule.rentAmount,
        total: rule.rentAmount,
        notes: "Generated by recurring invoice rule",
        lineItems: {
          create: [{ description: rule.invoiceDescription, quantity: 1, unitPrice: rule.rentAmount, total: rule.rentAmount }]
        }
      }
    });

    if (rule.enabled && rule.tenantPermissionConfirmed && rule.emailTenant) {
      if (!rule.tenant.email) continue;
      const result = await sendInvoiceEmail({
        to: rule.tenant.email,
        subject: `Invoice ${invoice.invoiceNumber}`,
        text: `Monthly invoice ${invoice.invoiceNumber}`
      });
      if (result.ok) {
        await db.invoice.update({ where: { id: invoice.id }, data: { status: "SENT", sentAt: new Date() } });
      }
    }

    const nextRun = new Date(rule.nextRunDate);
    nextRun.setMonth(nextRun.getMonth() + 1);
    await db.recurringInvoiceRule.update({ where: { id: rule.id }, data: { nextRunDate: nextRun } });
    generated.push(invoice);
  }

  return res.json({
    message:
      "Recurring invoices run complete. Recurring invoices will only be emailed if you confirm permission and configure email sending.",
    generatedCount: generated.length,
    generated
  });
});

// --- Recurring expected rent income (draft/expected until marked received) ---
ownedPropertiesRoutes.get("/properties/:propertyId/recurring-income", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.propertyId);
  const existing = await assertPropertyOwner(req.userId!, propertyId);
  if (!existing) return res.status(404).json({ message: "Property not found" });
  const rules = await db.recurringIncomeRule.findMany({
    where: { userId: req.userId!, propertyId },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ rules });
});

ownedPropertiesRoutes.post("/recurring-income/:id/activate", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.recurringIncomeRule.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Recurring income rule not found" });
  const updated = await db.recurringIncomeRule.update({ where: { id }, data: { status: "ACTIVE" } });
  return res.json({ rule: updated });
});

ownedPropertiesRoutes.post("/recurring-income/:id/pause", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await db.recurringIncomeRule.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) return res.status(404).json({ message: "Recurring income rule not found" });
  const updated = await db.recurringIncomeRule.update({ where: { id }, data: { status: "PAUSED" } });
  return res.json({ rule: updated });
});

ownedPropertiesRoutes.post("/recurring-income/run-due", async (req: AuthRequest, res) => {
  const now = new Date();
  const rules = await db.recurringIncomeRule.findMany({
    where: { userId: req.userId!, status: "ACTIVE", autoCreateExpectedEntries: true }
  });
  const created: any[] = [];

  for (const rule of rules) {
    const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(28, Math.max(1, rule.dayOfMonth)));
    if (dueDate > now) continue;
    if (rule.startDate > dueDate) continue;
    if (rule.endDate && dueDate > rule.endDate) continue;

    const exists = await db.propertyIncome.findFirst({
      where: {
        userId: req.userId!,
        propertyId: rule.propertyId,
        tenantId: rule.tenantId,
        leaseId: rule.leaseId,
        category: rule.category,
        source: "LEASE_EXPECTED",
        incomeDate: dueDate
      }
    });
    if (exists) continue;

    const inc = await db.propertyIncome.create({
      data: {
        userId: req.userId!,
        propertyId: rule.propertyId,
        tenantId: rule.tenantId,
        leaseId: rule.leaseId,
        category: rule.category,
        description: "Expected rent",
        amount: rule.amount,
        incomeDate: dueDate,
        source: "LEASE_EXPECTED",
        status: "EXPECTED"
      }
    });
    created.push(inc);
  }

  return res.json({ message: "Recurring expected income run complete.", createdCount: created.length, created });
});

ownedPropertiesRoutes.post("/leases/:id/cancel", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const lease = await db.lease.findFirst({ where: { id, userId: req.userId! } });
    if (!lease) return res.status(404).json({ message: "Lease not found" });
    if (["CANCELLED", "TERMINATED", "ARCHIVED"].includes(lease.status as any)) {
      return res.status(400).json({ message: "Lease already cancelled/terminated" });
    }

    const cancellationDate = req.body.cancellationDate ? new Date(req.body.cancellationDate) : null;
    if (!cancellationDate || Number.isNaN(cancellationDate.getTime())) {
      return res.status(400).json({ message: "cancellationDate is required (YYYY-MM-DD)" });
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.recurringIncomeRule.updateMany({ where: { userId: req.userId!, leaseId: id }, data: { status: "CANCELLED" } });
      // Cancel any FUTURE expected income that was generated for this lease
      await tx.propertyIncome.updateMany({
        where: { userId: req.userId!, leaseId: id, status: "EXPECTED", incomeDate: { gt: cancellationDate } },
        data: { status: "CANCELLED" }
      });
      return await tx.lease.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancellationDate,
          cancellationReason: req.body.cancellationReason ?? null,
          cancelledBy: req.body.cancelledBy ?? null
        }
      });
    });

    const otherCurrent = await db.lease.findFirst({
      where: { userId: req.userId!, tenantId: updated.tenantId, id: { not: updated.id }, status: { in: ["ACTIVE", "MONTH_TO_MONTH"] } }
    });
    if (!otherCurrent) {
      await db.tenant.update({ where: { id: updated.tenantId }, data: { status: "PAST", propertyId: null } });
    }

    return res.json({ lease: updated });
  } catch (err: any) {
    console.error("[ownedProperties] POST /leases/:id/cancel failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to cancel lease." });
  }
});

