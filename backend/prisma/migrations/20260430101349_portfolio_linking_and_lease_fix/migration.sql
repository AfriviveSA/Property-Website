-- CreateEnum
CREATE TYPE "LeaseType" AS ENUM ('FIXED_TERM', 'MONTH_TO_MONTH');

-- CreateEnum
CREATE TYPE "LeaseCancelledBy" AS ENUM ('LANDLORD', 'TENANT', 'MUTUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeaseStatus" ADD VALUE 'MONTH_TO_MONTH';
ALTER TYPE "LeaseStatus" ADD VALUE 'CANCELLED';

-- DropForeignKey
ALTER TABLE "Tenant" DROP CONSTRAINT "Tenant_propertyId_fkey";

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "cancellationDate" TIMESTAMP(3),
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledBy" "LeaseCancelledBy",
ADD COLUMN     "leaseType" "LeaseType" NOT NULL DEFAULT 'FIXED_TERM',
ALTER COLUMN "endDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "propertyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
