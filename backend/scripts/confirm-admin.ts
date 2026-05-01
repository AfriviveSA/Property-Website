import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ADMIN_EMAIL = "delangetiaan13@gmail.com";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existing) {
    console.log(`No user found for ${ADMIN_EMAIL}. Run prisma seed first.`);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      email_confirmed: true,
      confirmation_token: null,
      role: "ADMIN",
      subscription_status: "SUBSCRIBED",
      free_uses_remaining: null
    }
  });

  console.log(`Admin confirmation complete for ${ADMIN_EMAIL}.`);
}

main()
  .catch((error) => {
    console.error("confirm-admin failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
