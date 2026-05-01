import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const q = (process.argv[2] ?? "").trim().toLowerCase();
  if (!q) {
    console.log("Usage: npm run tenants:list -- <name-fragment>");
    return;
  }

  const tenants = await prisma.tenant.findMany({
    include: { property: true, leases: { include: { property: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" }
  });

  const hits = tenants.filter((t: any) => `${t.firstName ?? ""} ${t.lastName ?? ""}`.toLowerCase().includes(q));
  console.log(`tenants matched: ${hits.length}`);
  for (const t of hits as any[]) {
    console.log(
      `- tenantId=${t.id} name=${t.firstName} ${t.lastName} status=${t.status} propertyId=${t.propertyId ?? "null"} property=${t.property?.name ?? "-"} leases=${t.leases?.length ?? 0}`
    );
    for (const l of t.leases ?? []) {
      console.log(`  - leaseId=${l.id} status=${l.status} propertyId=${l.propertyId} property=${l.property?.name ?? "-"} start=${String(l.startDate).slice(0, 10)}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("list-tenants failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

