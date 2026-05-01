import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function norm(s: string | null | undefined) {
  return String(s ?? "").trim().toLowerCase();
}

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      leases: true,
      incomeEntries: true,
      invoices: true
    },
    orderBy: { createdAt: "asc" }
  });

  const byKey = new Map<string, any[]>();
  for (const t of tenants as any[]) {
    // Key: user + property + full name (duplicates usually happen within same property)
    const key = [t.userId, t.propertyId ?? "null", norm(t.firstName), norm(t.lastName)].join("|");
    const arr = byKey.get(key) ?? [];
    arr.push(t);
    byKey.set(key, arr);
  }

  let duplicateGroups = 0;
  let deleted = 0;
  let archived = 0;
  const warnings: string[] = [];

  for (const [key, arr] of byKey.entries()) {
    if (arr.length <= 1) continue;
    duplicateGroups += 1;

    // Keep the tenant with the most linkage (leases + income + invoices), tie-breaker: earliest created.
    const scored = arr
      .map((t) => ({
        t,
        score: (t.leases?.length ?? 0) * 10 + (t.incomeEntries?.length ?? 0) * 3 + (t.invoices?.length ?? 0) * 3
      }))
      .sort((a, b) => b.score - a.score || new Date(a.t.createdAt).getTime() - new Date(b.t.createdAt).getTime());

    const keep = scored[0].t;
    const remove = scored.slice(1).map((s) => s.t);

    for (const t of remove) {
      const hasLinks = (t.leases?.length ?? 0) > 0 || (t.incomeEntries?.length ?? 0) > 0 || (t.invoices?.length ?? 0) > 0;
      if (!hasLinks) {
        // Safe hard delete: no historical links.
        await prisma.tenant.delete({ where: { id: t.id } });
        deleted += 1;
        continue;
      }

      // Keep history: unlink from property and mark PAST.
      await prisma.tenant.update({
        where: { id: t.id },
        data: { status: "PAST", propertyId: null }
      });
      archived += 1;

      warnings.push(
        `Tenant ${t.id} had links (leases/income/invoices). Marked PAST + unlinked. Kept tenant ${keep.id}.`
      );
    }
  }

  console.log("cleanup-duplicate-tenants summary");
  console.log(`- tenantsChecked: ${tenants.length}`);
  console.log(`- duplicateGroups: ${duplicateGroups}`);
  console.log(`- deleted: ${deleted}`);
  console.log(`- archivedUnlinked: ${archived}`);
  if (warnings.length) {
    console.log("- warnings:");
    warnings.slice(0, 50).forEach((w) => console.log(`  - ${w}`));
    if (warnings.length > 50) console.log(`  - ... and ${warnings.length - 50} more`);
  }
}

main()
  .catch((err) => {
    console.error("cleanup-duplicate-tenants failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

