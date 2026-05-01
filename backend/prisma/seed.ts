import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "delangetiaan13@gmail.com";
const TEMP_PASSWORD = "Tiaan123";

async function main() {
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password_hash: passwordHash,
        role: "ADMIN",
        subscription_status: "SUBSCRIBED",
        free_uses_remaining: null,
        email_confirmed: true,
        confirmation_token: null
      }
    });
    console.log(`Seed complete: updated ${ADMIN_EMAIL} to ADMIN + SUBSCRIBED + CONFIRMED.`);
    return;
  }

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password_hash: passwordHash,
      role: "ADMIN",
      subscription_status: "SUBSCRIBED",
      free_uses_remaining: null,
      email_confirmed: true,
      confirmation_token: null
    }
  });
  console.log(`Seed complete: created confirmed admin user ${ADMIN_EMAIL}.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
