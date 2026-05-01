import type { Prisma, PrismaClient } from "@prisma/client";

export type PortfolioSelector =
  | { email: string; userId?: never }
  | { userId: number; email?: never };

export type PortfolioModelCounts = {
  properties: number;
  tenants: number;
  leases: number;
  propertyIncome: number;
  propertyExpense: number;
  recurringIncomeRules: number;
  recurringInvoiceRules: number;
  invoices: number;
  invoiceLineItems: number;
  propertyDocuments: number;
  leaseDocuments: number;
};

export type PortfolioBackupPayload = {
  meta: {
    exportedAt: string;
    selector: PortfolioSelector;
    user: { id: number; email: string };
  };
  data: {
    properties: any[];
    tenants: any[];
    leases: any[];
    propertyIncome: any[];
    propertyExpense: any[];
    recurringIncomeRules: any[];
    recurringInvoiceRules: any[];
    invoices: any[];
    invoiceLineItems: any[];
    propertyDocuments: any[];
  };
  counts: PortfolioModelCounts;
};

type PrismaLike = Pick<
  PrismaClient,
  | "user"
  | "property"
  | "tenant"
  | "lease"
  | "propertyIncome"
  | "propertyExpense"
  | "recurringIncomeRule"
  | "recurringInvoiceRule"
  | "invoice"
  | "invoiceLineItem"
  | "propertyDocument"
  | "$transaction"
>;

export async function resolveUserOrThrow(prisma: PrismaLike, selector: PortfolioSelector) {
  const user =
    "email" in selector
      ? await prisma.user.findUnique({ where: { email: selector.email } })
      : await prisma.user.findUnique({ where: { id: selector.userId } });

  if (!user) {
    const key = "email" in selector ? `email=${selector.email}` : `userId=${selector.userId}`;
    throw new Error(`User not found (${key})`);
  }
  return { id: user.id, email: user.email };
}

export async function exportPortfolioBackup(prisma: PrismaLike, selector: PortfolioSelector): Promise<PortfolioBackupPayload> {
  const user = await resolveUserOrThrow(prisma, selector);

  const [
    properties,
    tenants,
    leases,
    propertyIncome,
    propertyExpense,
    recurringIncomeRules,
    recurringInvoiceRules,
    invoices,
    propertyDocuments
  ] = await Promise.all([
    prisma.property.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }),
    prisma.tenant.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }),
    prisma.lease.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }),
    prisma.propertyIncome.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }),
    prisma.propertyExpense.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }),
    prisma.recurringIncomeRule.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }),
    prisma.recurringInvoiceRule.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }),
    prisma.invoice.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }),
    prisma.propertyDocument.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } })
  ]);

  const invoiceIds = invoices.map((i: any) => i.id).filter((id: any) => typeof id === "number");
  const invoiceLineItems =
    invoiceIds.length > 0 ? await prisma.invoiceLineItem.findMany({ where: { invoiceId: { in: invoiceIds } }, orderBy: { id: "asc" } }) : [];

  const leaseDocuments = propertyDocuments.filter((d: any) => d.leaseId != null);

  const counts: PortfolioModelCounts = {
    properties: properties.length,
    tenants: tenants.length,
    leases: leases.length,
    propertyIncome: propertyIncome.length,
    propertyExpense: propertyExpense.length,
    recurringIncomeRules: recurringIncomeRules.length,
    recurringInvoiceRules: recurringInvoiceRules.length,
    invoices: invoices.length,
    invoiceLineItems: invoiceLineItems.length,
    propertyDocuments: propertyDocuments.length,
    leaseDocuments: leaseDocuments.length
  };

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      selector,
      user: { id: user.id, email: user.email }
    },
    data: {
      properties,
      tenants,
      leases,
      propertyIncome,
      propertyExpense,
      recurringIncomeRules,
      recurringInvoiceRules,
      invoices,
      invoiceLineItems,
      propertyDocuments
    },
    counts
  };
}

export type ResetPlan = {
  user: { id: number; email: string };
  propertyIds: number[];
  tenantIds: number[];
  leaseIds: number[];
  invoiceIds: number[];
  leaseDocumentIds: number[];
  counts: PortfolioModelCounts;
};

export async function planPortfolioReset(prisma: PrismaLike, selector: PortfolioSelector): Promise<ResetPlan> {
  const user = await resolveUserOrThrow(prisma, selector);

  const [properties, tenants, leases, invoices, recurringIncomeRules, recurringInvoiceRules, propertyIncome, propertyExpense, propertyDocuments] =
    await Promise.all([
      prisma.property.findMany({ where: { userId: user.id }, select: { id: true } }),
      prisma.tenant.findMany({ where: { userId: user.id }, select: { id: true } }),
      prisma.lease.findMany({ where: { userId: user.id }, select: { id: true } }),
      prisma.invoice.findMany({ where: { userId: user.id }, select: { id: true } }),
      prisma.recurringIncomeRule.findMany({ where: { userId: user.id }, select: { id: true } }),
      prisma.recurringInvoiceRule.findMany({ where: { userId: user.id }, select: { id: true } }),
      prisma.propertyIncome.findMany({ where: { userId: user.id }, select: { id: true } }),
      prisma.propertyExpense.findMany({ where: { userId: user.id }, select: { id: true } }),
      prisma.propertyDocument.findMany({ where: { userId: user.id }, select: { id: true, leaseId: true } })
    ]);

  const propertyIds = properties.map((p) => p.id);
  const tenantIds = tenants.map((t) => t.id);
  const leaseIds = leases.map((l) => l.id);
  const invoiceIds = invoices.map((i) => i.id);
  const leaseDocumentIds = propertyDocuments.filter((d) => d.leaseId != null).map((d) => d.id);

  const invoiceLineItemsCount =
    invoiceIds.length > 0 ? await prisma.invoiceLineItem.count({ where: { invoiceId: { in: invoiceIds } } }) : 0;

  const counts: PortfolioModelCounts = {
    properties: propertyIds.length,
    tenants: tenantIds.length,
    leases: leaseIds.length,
    propertyIncome: propertyIncome.length,
    propertyExpense: propertyExpense.length,
    recurringIncomeRules: recurringIncomeRules.length,
    recurringInvoiceRules: recurringInvoiceRules.length,
    invoices: invoiceIds.length,
    invoiceLineItems: invoiceLineItemsCount,
    propertyDocuments: propertyDocuments.length,
    leaseDocuments: leaseDocumentIds.length
  };

  return { user, propertyIds, tenantIds, leaseIds, invoiceIds, leaseDocumentIds, counts };
}

export type ResetResult = {
  dryRun: boolean;
  deleted: {
    invoiceLineItems: number;
    invoices: number;
    recurringIncomeRules: number;
    recurringInvoiceRules: number;
    propertyIncome: number;
    propertyExpense: number;
    propertyDocuments: number;
    leases: number;
    tenants: number;
  };
};

export async function resetPortfolioData(
  prisma: PrismaLike,
  selector: PortfolioSelector,
  opts: { dryRun: boolean }
): Promise<ResetResult> {
  const plan = await planPortfolioReset(prisma, selector);

  const deleted = {
    invoiceLineItems: plan.counts.invoiceLineItems,
    invoices: plan.counts.invoices,
    recurringIncomeRules: plan.counts.recurringIncomeRules,
    recurringInvoiceRules: plan.counts.recurringInvoiceRules,
    propertyIncome: plan.counts.propertyIncome,
    propertyExpense: plan.counts.propertyExpense,
    // Only lease-linked documents are removed; property-level docs remain.
    propertyDocuments: plan.counts.leaseDocuments,
    leases: plan.counts.leases,
    tenants: plan.counts.tenants
  };

  if (opts.dryRun) return { dryRun: true, deleted };

  await prisma.$transaction(async (tx) => {
    if (plan.invoiceIds.length > 0) {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: { in: plan.invoiceIds } } });
    }
    await tx.invoice.deleteMany({ where: { userId: plan.user.id } });
    await tx.recurringInvoiceRule.deleteMany({ where: { userId: plan.user.id } });
    await tx.recurringIncomeRule.deleteMany({ where: { userId: plan.user.id } });
    await tx.propertyIncome.deleteMany({ where: { userId: plan.user.id } });
    await tx.propertyExpense.deleteMany({ where: { userId: plan.user.id } });

    // Lease-linked documents are safe to remove; property-level docs remain.
    await tx.propertyDocument.deleteMany({ where: { userId: plan.user.id, leaseId: { not: null } } });

    await tx.lease.deleteMany({ where: { userId: plan.user.id } });
    await tx.tenant.deleteMany({ where: { userId: plan.user.id } });
  });

  return { dryRun: false, deleted };
}

