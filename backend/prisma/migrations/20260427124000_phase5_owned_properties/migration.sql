-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'TOWNHOUSE', 'DUPLEX', 'ROOM', 'COMMERCIAL', 'OTHER');
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'PAST', 'APPLICANT');
CREATE TYPE "LeaseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED', 'DRAFT');
CREATE TYPE "PropertyDocumentType" AS ENUM ('LEASE_AGREEMENT', 'ID_DOCUMENT', 'PROOF_OF_PAYMENT', 'MUNICIPAL_ACCOUNT', 'INSURANCE', 'INSPECTION', 'OTHER');
CREATE TYPE "PropertyExpenseCategory" AS ENUM ('RATES_TAXES', 'WATER', 'ELECTRICITY', 'LEVIES', 'INSURANCE', 'MAINTENANCE', 'REPAIRS', 'MANAGEMENT_FEES', 'BOND_PAYMENT', 'ACCOUNTING', 'OTHER');
CREATE TYPE "RecurringFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');
CREATE TYPE "PropertyIncomeCategory" AS ENUM ('RENT', 'DEPOSIT', 'LATE_FEE', 'UTILITIES_RECOVERY', 'OTHER');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Property" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "propertyType" "PropertyType" NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "suburb" TEXT,
  "city" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'South Africa',
  "erfNumber" TEXT,
  "sizeSqm" DOUBLE PRECISION,
  "bedrooms" INTEGER,
  "bathrooms" INTEGER,
  "parkingBays" INTEGER,
  "purchasePrice" DOUBLE PRECISION NOT NULL,
  "purchaseDate" TIMESTAMP(3),
  "currentEstimatedValue" DOUBLE PRECISION,
  "monthlyBondPayment" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tenant" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "propertyId" INTEGER NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "idNumber" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "status" "TenantStatus" NOT NULL DEFAULT 'APPLICANT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lease" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "propertyId" INTEGER NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "monthlyRent" DOUBLE PRECISION NOT NULL,
  "depositAmount" DOUBLE PRECISION NOT NULL,
  "rentDueDay" INTEGER NOT NULL DEFAULT 1,
  "escalationPercent" DOUBLE PRECISION,
  "escalationDate" TIMESTAMP(3),
  "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
  "leaseDocumentId" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Lease_leaseDocumentId_key" ON "Lease"("leaseDocumentId");

CREATE TABLE "PropertyDocument" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "propertyId" INTEGER NOT NULL,
  "leaseId" INTEGER,
  "documentType" "PropertyDocumentType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyExpense" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "propertyId" INTEGER NOT NULL,
  "category" "PropertyExpenseCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "recurringFrequency" "RecurringFrequency",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyIncome" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "propertyId" INTEGER NOT NULL,
  "tenantId" INTEGER,
  "category" "PropertyIncomeCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "incomeDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyIncome_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "propertyId" INTEGER NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "leaseId" INTEGER,
  "invoiceNumber" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DOUBLE PRECISION NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "pdfPath" TEXT,
  "sentAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

CREATE TABLE "InvoiceLineItem" (
  "id" SERIAL NOT NULL,
  "invoiceId" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringInvoiceRule" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "propertyId" INTEGER NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "leaseId" INTEGER,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "frequency" "RecurringFrequency" NOT NULL DEFAULT 'MONTHLY',
  "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
  "nextRunDate" TIMESTAMP(3) NOT NULL,
  "invoiceDescription" TEXT NOT NULL DEFAULT 'Monthly Rent',
  "rentAmount" DOUBLE PRECISION NOT NULL,
  "includeUtilities" BOOLEAN NOT NULL DEFAULT false,
  "emailTenant" BOOLEAN NOT NULL DEFAULT false,
  "tenantPermissionConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringInvoiceRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Property_userId_idx" ON "Property"("userId");
CREATE INDEX "Tenant_userId_idx" ON "Tenant"("userId");
CREATE INDEX "Tenant_propertyId_idx" ON "Tenant"("propertyId");
CREATE INDEX "Lease_userId_idx" ON "Lease"("userId");
CREATE INDEX "Lease_propertyId_idx" ON "Lease"("propertyId");
CREATE INDEX "Lease_tenantId_idx" ON "Lease"("tenantId");
CREATE INDEX "PropertyDocument_userId_idx" ON "PropertyDocument"("userId");
CREATE INDEX "PropertyDocument_propertyId_idx" ON "PropertyDocument"("propertyId");
CREATE INDEX "PropertyExpense_userId_idx" ON "PropertyExpense"("userId");
CREATE INDEX "PropertyExpense_propertyId_idx" ON "PropertyExpense"("propertyId");
CREATE INDEX "PropertyIncome_userId_idx" ON "PropertyIncome"("userId");
CREATE INDEX "PropertyIncome_propertyId_idx" ON "PropertyIncome"("propertyId");
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX "Invoice_propertyId_idx" ON "Invoice"("propertyId");
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");
CREATE INDEX "RecurringInvoiceRule_userId_idx" ON "RecurringInvoiceRule"("userId");
CREATE INDEX "RecurringInvoiceRule_propertyId_idx" ON "RecurringInvoiceRule"("propertyId");

ALTER TABLE "Property" ADD CONSTRAINT "Property_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_leaseDocumentId_fkey" FOREIGN KEY ("leaseDocumentId") REFERENCES "PropertyDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyIncome" ADD CONSTRAINT "PropertyIncome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyIncome" ADD CONSTRAINT "PropertyIncome_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyIncome" ADD CONSTRAINT "PropertyIncome_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringInvoiceRule" ADD CONSTRAINT "RecurringInvoiceRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringInvoiceRule" ADD CONSTRAINT "RecurringInvoiceRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringInvoiceRule" ADD CONSTRAINT "RecurringInvoiceRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringInvoiceRule" ADD CONSTRAINT "RecurringInvoiceRule_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
