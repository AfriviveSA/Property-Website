-- CreateEnum
CREATE TYPE "InvestmentPropertyType" AS ENUM ('LONG_TERM_RENTAL', 'SHORT_TERM_RENTAL', 'PRIMARY_RESIDENCE', 'HOUSE_HACK', 'BRRRR', 'FLIP', 'VACANT_LAND', 'COMMERCIAL', 'MIXED_USE', 'OTHER');

-- CreateEnum
CREATE TYPE "FlipProjectStage" AS ENUM ('ACQUISITION', 'RENOVATION', 'FOR_SALE', 'SOLD');

-- CreateEnum
CREATE TYPE "BRRRRStage" AS ENUM ('ACQUISITION', 'RENOVATION', 'RENTED', 'REFINANCED');

-- CreateEnum
CREATE TYPE "LandUse" AS ENUM ('RESIDENTIAL', 'AGRICULTURAL', 'COMMERCIAL', 'INDUSTRIAL', 'OTHER');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "afterRepairValue" DOUBLE PRECISION,
ADD COLUMN     "availableNightsPerMonth" INTEGER,
ADD COLUMN     "averageDailyRate" DOUBLE PRECISION,
ADD COLUMN     "brrrrStage" "BRRRRStage",
ADD COLUMN     "cleaningFeesMonthly" DOUBLE PRECISION,
ADD COLUMN     "expectedAnnualAppreciationPercent" DOUBLE PRECISION,
ADD COLUMN     "expectedMonthlyExpenses" DOUBLE PRECISION,
ADD COLUMN     "expectedMonthlyIncome" DOUBLE PRECISION,
ADD COLUMN     "expectedSalePrice" DOUBLE PRECISION,
ADD COLUMN     "furnishingValue" DOUBLE PRECISION,
ADD COLUMN     "holdingCostsMonthly" DOUBLE PRECISION,
ADD COLUMN     "investmentType" "InvestmentPropertyType" NOT NULL DEFAULT 'LONG_TERM_RENTAL',
ADD COLUMN     "landUse" "LandUse",
ADD COLUMN     "leviesMonthly" DOUBLE PRECISION,
ADD COLUMN     "maintenanceMonthly" DOUBLE PRECISION,
ADD COLUMN     "managementFeePercent" DOUBLE PRECISION,
ADD COLUMN     "monthlyUtilities" DOUBLE PRECISION,
ADD COLUMN     "occupancyRate" DOUBLE PRECISION,
ADD COLUMN     "platformFeePercent" DOUBLE PRECISION,
ADD COLUMN     "projectStage" "FlipProjectStage",
ADD COLUMN     "ratesAndTaxesMonthly" DOUBLE PRECISION,
ADD COLUMN     "refinanceAmount" DOUBLE PRECISION,
ADD COLUMN     "rehabBudget" DOUBLE PRECISION,
ADD COLUMN     "securityMonthly" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "targetSaleDate" TIMESTAMP(3),
ADD COLUMN     "zoning" TEXT;
