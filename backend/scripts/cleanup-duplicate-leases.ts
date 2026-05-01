import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isCurrentLease(l: any) {
  return (l.status === "ACTIVE" || l.status === "MONTH_TO_MONTH") && l.cancellationDate == null;
}

async function main() {
  const leases = await prisma.lease.findMany({
    include: { recurringIncomeRule: true },
    orderBy: { updatedAt: "desc" }
  });

  const current = leases.filter(isCurrentLease);

  const byProperty = new Map<number, any[]>();
  const byTenant = new Map<number, any[]>();

  for (const l of current) {
    const pa = byProperty.get(l.propertyId) ?? [];
    pa.push(l);
    byProperty.set(l.propertyId, pa);
    const ta = byTenant.get(l.tenantId) ?? [];
    ta.push(l);
    byTenant.set(l.tenantId, ta);
  }

  let duplicatesFound = 0;
  let leasesArchived = 0;
  let tenantsFixed = 0;
  let recurringRulesDisabled = 0;

  const toArchive = new Set<number>();
  const keepForProperty = new Map<number, any>();
  const keepForTenant = new Map<number, any>();

  for (const [propertyId, arr] of byProperty.entries()) {
    if (arr.length <= 1) continue;
    duplicatesFound += arr.length - 1;
    const keep = arr[0]; // already sorted by updatedAt desc
    keepForProperty.set(propertyId, keep);
    arr.slice(1).forEach((l) => toArchive.add(l.id));
  }
  for (const [tenantId, arr] of byTenant.entries()) {
    if (arr.length <= 1) continue;
    duplicatesFound += arr.length - 1;
    const keep = arr[0];
    keepForTenant.set(tenantId, keep);
    arr.slice(1).forEach((l) => toArchive.add(l.id));
  }

  for (const leaseId of toArchive) {
    await prisma.$transaction(async (tx) => {
      const lease = await tx.lease.findUnique({ where: { id: leaseId } });
      if (!lease) return;
      await tx.lease.update({ where: { id: leaseId }, data: { status: "ARCHIVED" } });
      leasesArchived += 1;
      const rr = await tx.recurringIncomeRule.findFirst({ where: { leaseId } });
      if (rr) {
        await tx.recurringIncomeRule.update({ where: { id: rr.id }, data: { status: "CANCELLED" } });
        recurringRulesDisabled += 1;
      }
    });
  }

  // Fix tenant.propertyId to match kept current lease (best-effort)
  for (const [tenantId, keepLease] of keepForTenant.entries()) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) continue;
    if (t.propertyId !== keepLease.propertyId) {
      await prisma.tenant.update({ where: { id: tenantId }, data: { propertyId: keepLease.propertyId, status: "ACTIVE" } });
      tenantsFixed += 1;
    }
  }

  console.log("cleanup-duplicate-leases summary");
  console.log(`- currentLeasesChecked: ${current.length}`);
  console.log(`- duplicatesFound: ${duplicatesFound}`);
  console.log(`- leasesArchived: ${leasesArchived}`);
  console.log(`- tenantsFixed: ${tenantsFixed}`);
  console.log(`- recurringRulesDisabled: ${recurringRulesDisabled}`);
}

main()
  .catch((err) => {
    console.error("cleanup-duplicate-leases failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

