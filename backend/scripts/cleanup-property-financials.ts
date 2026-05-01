import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

async function main() {
  const properties = await prisma.property.findMany({
    include: { expenses: true }
  });

  let expensesCreated = 0;
  let duplicatesArchived = 0;
  const warnings: string[] = [];

  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  for (const p of properties as any[]) {
    // 1) Create missing setup recurring expenses from property fields (single source of truth migration)
    const desired: Array<{ category: any; amount: number; description: string }> = [];
    const pushIf = (amount: any, category: any, description: string) => {
      const v = typeof amount === "number" ? amount : amount == null ? 0 : Number(amount);
      if (Number.isFinite(v) && v > 0) desired.push({ category, amount: v, description });
    };

    pushIf(p.ratesAndTaxesMonthly, "RATES_TAXES", "Rates & taxes (setup)");
    pushIf(p.leviesMonthly, "LEVIES", "Levies (setup)");
    pushIf(p.maintenanceMonthly, "MAINTENANCE", "Maintenance (setup)");
    pushIf(p.securityMonthly, "OTHER", "Security (setup)");
    pushIf(p.expectedMonthlyExpenses, "OTHER", "Other monthly expenses (setup)");
    pushIf(p.monthlyBondPayment, "BOND_PAYMENT", "Bond payment (setup)");

    for (const d of desired) {
      const exists = p.expenses?.some(
        (e: any) =>
          e.status === "ACTIVE" &&
          e.source === "PROPERTY_SETUP" &&
          e.isRecurring === true &&
          e.recurringFrequency === "MONTHLY" &&
          e.category === d.category
      );
      if (exists) continue;
      await prisma.propertyExpense.create({
        data: {
          userId: p.userId,
          propertyId: p.id,
          category: d.category,
          description: d.description,
          amount: d.amount,
          expenseDate: firstOfMonth,
          isRecurring: true,
          recurringFrequency: "MONTHLY",
          source: "PROPERTY_SETUP",
          status: "ACTIVE"
        }
      });
      expensesCreated += 1;
    }

    // 2) Detect duplicate ACTIVE expenses (same key, close dates)
    const active = (await prisma.propertyExpense.findMany({
      where: { userId: p.userId, propertyId: p.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" }
    })) as any[];

    const groups = new Map<string, any[]>();
    for (const e of active) {
      const key = [
        e.propertyId,
        e.category,
        e.amount,
        e.isRecurring ? "R" : "O",
        e.recurringFrequency ?? "-",
        e.source ?? "-"
      ].join("|");
      const arr = groups.get(key) ?? [];
      arr.push(e);
      groups.set(key, arr);
    }

    for (const arr of groups.values()) {
      if (arr.length <= 1) continue;
      const keep = arr[0];
      for (let i = 1; i < arr.length; i++) {
        const cand = arr[i];
        // only archive as "duplicate" when created close together
        const close = daysBetween(new Date(keep.expenseDate), new Date(cand.expenseDate)) <= 3 || daysBetween(new Date(keep.createdAt), new Date(cand.createdAt)) <= 3;
        if (!close) continue;
        await prisma.propertyExpense.update({ where: { id: cand.id }, data: { status: "ARCHIVED" } });
        duplicatesArchived += 1;
      }
    }
  }

  console.log("cleanup-property-financials summary");
  console.log(`- propertiesChecked: ${properties.length}`);
  console.log(`- expensesCreated: ${expensesCreated}`);
  console.log(`- duplicatesArchived: ${duplicatesArchived}`);
  if (warnings.length) {
    console.log("- warnings:");
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
}

main()
  .catch((err) => {
    console.error("cleanup-property-financials failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

