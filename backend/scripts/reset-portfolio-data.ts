import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";
import { exportPortfolioBackup, planPortfolioReset, resetPortfolioData, type PortfolioSelector } from "../src/services/portfolioResetService.js";
import { assertPortfolioResetAllowed } from "../src/utils/portfolioResetGuards.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === "--email") out.email = String(argv[i + 1] ?? "");
    if (a === "--userId") out.userId = String(argv[i + 1] ?? "");
    if (a === "--confirm") out.confirm = String(argv[i + 1] ?? "");
    if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function selectorFromArgs(args: Record<string, string | boolean>): PortfolioSelector {
  if (typeof args.email === "string" && args.email.trim()) return { email: args.email.trim() };
  if (typeof args.userId === "string" && args.userId.trim()) return { userId: Number(args.userId) };
  throw new Error("Provide exactly one: --email <email> OR --userId <id>");
}

function tsSlug(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  // ensure dotenv is loaded via env import (existing project pattern)
  void env;

  const args = parseArgs(process.argv.slice(2));
  const selector = selectorFromArgs(args);
  const confirm = typeof args.confirm === "string" ? args.confirm : "";
  const dryRun = Boolean(args.dryRun);
  assertPortfolioResetAllowed({ nodeEnv: process.env.NODE_ENV, confirm });

  const prisma = new PrismaClient();
  try {
    // Always back up before deletion (even for dry runs, to be safe/consistent).
    const backupPayload = await exportPortfolioBackup(prisma, selector);
    const backupDir = path.join(process.cwd(), "backups/portfolio-reset");
    await mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `portfolio-backup-user-${backupPayload.meta.user.id}-${tsSlug()}.json`);
    await writeFile(backupPath, JSON.stringify(backupPayload, null, 2), "utf8");

    console.log("portfolio reset backup saved");
    console.log(`- file: ${backupPath}`);

    const plan = await planPortfolioReset(prisma, selector);
    console.log("reset plan (properties will be kept)");
    console.log(`- userId: ${plan.user.id}`);
    console.log(`- email: ${plan.user.email}`);
    console.log("- would delete:");
    console.log(`  - invoiceLineItems: ${plan.counts.invoiceLineItems}`);
    console.log(`  - invoices: ${plan.counts.invoices}`);
    console.log(`  - recurringIncomeRules: ${plan.counts.recurringIncomeRules}`);
    console.log(`  - recurringInvoiceRules: ${plan.counts.recurringInvoiceRules}`);
    console.log(`  - propertyIncome: ${plan.counts.propertyIncome}`);
    console.log(`  - propertyExpense: ${plan.counts.propertyExpense}`);
    console.log(`  - propertyDocuments (lease-linked only): ${plan.counts.leaseDocuments}`);
    console.log(`  - leases: ${plan.counts.leases}`);
    console.log(`  - tenants: ${plan.counts.tenants}`);

    const result = await resetPortfolioData(prisma, selector, { dryRun });
    if (result.dryRun) {
      console.log("dry run complete (no data deleted)");
      return;
    }

    // Minimal post-check: ensure properties remain and children are cleared.
    const after = await planPortfolioReset(prisma, selector);
    console.log("reset complete");
    console.log(`- propertiesRemaining: ${after.counts.properties}`);
    console.log(`- tenantsRemaining: ${after.counts.tenants}`);
    console.log(`- leasesRemaining: ${after.counts.leases}`);
    console.log(`- incomeRemaining: ${after.counts.propertyIncome}`);
    console.log(`- expensesRemaining: ${after.counts.propertyExpense}`);
    console.log(`- invoicesRemaining: ${after.counts.invoices}`);
    console.log(`- recurringIncomeRulesRemaining: ${after.counts.recurringIncomeRules}`);
    console.log(`- recurringInvoiceRulesRemaining: ${after.counts.recurringInvoiceRules}`);
    console.log(`- leaseLinkedDocsRemaining: ${after.counts.leaseDocuments}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("reset-portfolio-data failed:", err?.message ?? err);
  process.exitCode = 1;
});

