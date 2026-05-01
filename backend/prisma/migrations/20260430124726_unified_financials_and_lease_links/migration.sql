-- CreateEnum
CREATE TYPE "PropertyExpenseSource" AS ENUM ('PROPERTY_SETUP', 'MANUAL_FINANCIAL_ENTRY', 'INVOICE', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PropertyExpenseStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PropertyIncomeSource" AS ENUM ('LEASE_EXPECTED', 'MANUAL_FINANCIAL_ENTRY', 'INVOICE', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PropertyIncomeStatus" AS ENUM ('EXPECTED', 'RECEIVED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecurringIncomeRuleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LeaseStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "PropertyExpense" ADD COLUMN     "source" "PropertyExpenseSource" NOT NULL DEFAULT 'MANUAL_FINANCIAL_ENTRY',
ADD COLUMN     "status" "PropertyExpenseStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "PropertyIncome" ADD COLUMN     "leaseId" INTEGER,
ADD COLUMN     "source" "PropertyIncomeSource" NOT NULL DEFAULT 'MANUAL_FINANCIAL_ENTRY',
ADD COLUMN     "status" "PropertyIncomeStatus" NOT NULL DEFAULT 'RECEIVED';

-- CreateTable
CREATE TABLE "RecurringIncomeRule" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "leaseId" INTEGER NOT NULL,
    "category" "PropertyIncomeCategory" NOT NULL DEFAULT 'RENT',
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL DEFAULT 'MONTHLY',
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "RecurringIncomeRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoCreateExpectedEntries" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringIncomeRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringIncomeRule_leaseId_key" ON "RecurringIncomeRule"("leaseId");

-- CreateIndex
CREATE INDEX "RecurringIncomeRule_userId_idx" ON "RecurringIncomeRule"("userId");

-- CreateIndex
CREATE INDEX "RecurringIncomeRule_propertyId_idx" ON "RecurringIncomeRule"("propertyId");

-- CreateIndex
CREATE INDEX "RecurringIncomeRule_tenantId_idx" ON "RecurringIncomeRule"("tenantId");

-- CreateIndex
CREATE INDEX "RecurringIncomeRule_status_idx" ON "RecurringIncomeRule"("status");

-- CreateIndex
CREATE INDEX "PropertyExpense_status_idx" ON "PropertyExpense"("status");

-- CreateIndex
CREATE INDEX "PropertyIncome_tenantId_idx" ON "PropertyIncome"("tenantId");

-- CreateIndex
CREATE INDEX "PropertyIncome_leaseId_idx" ON "PropertyIncome"("leaseId");

-- CreateIndex
CREATE INDEX "PropertyIncome_status_idx" ON "PropertyIncome"("status");

-- AddForeignKey
ALTER TABLE "PropertyIncome" ADD CONSTRAINT "PropertyIncome_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringIncomeRule" ADD CONSTRAINT "RecurringIncomeRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringIncomeRule" ADD CONSTRAINT "RecurringIncomeRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringIncomeRule" ADD CONSTRAINT "RecurringIncomeRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringIncomeRule" ADD CONSTRAINT "RecurringIncomeRule_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
