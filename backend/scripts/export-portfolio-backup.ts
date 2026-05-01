import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { exportPortfolioBackup, type PortfolioSelector } from "../src/services/portfolioResetService.js";

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === "--email") out.email = String(argv[i + 1] ?? "");
    if (a === "--userId") out.userId = String(argv[i + 1] ?? "");
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
  const args = parseArgs(process.argv.slice(2));
  const selector = selectorFromArgs(args);

  const prisma = new PrismaClient();
  try {
    const payload = await exportPortfolioBackup(prisma, selector);
    const dir = path.join(process.cwd(), "backups/portfolio-reset");
    await mkdir(dir, { recursive: true });

    const fileName = `portfolio-backup-user-${payload.meta.user.id}-${tsSlug()}.json`;
    const filePath = path.join(dir, fileName);
    await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

    console.log("portfolio backup export complete");
    console.log(`- userId: ${payload.meta.user.id}`);
    console.log(`- email: ${payload.meta.user.email}`);
    console.log(`- file: ${filePath}`);
    console.log("- counts:");
    Object.entries(payload.counts).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("export-portfolio-backup failed:", err?.message ?? err);
  process.exitCode = 1;
});

