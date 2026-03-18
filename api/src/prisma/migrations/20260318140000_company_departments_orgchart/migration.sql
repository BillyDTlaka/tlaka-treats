-- Company table
CREATE TABLE IF NOT EXISTS "Company" (
  "id"             TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"           TEXT NOT NULL DEFAULT 'Tlaka Treats',
  "tradingName"    TEXT,
  "registrationNo" TEXT,
  "vatNo"          TEXT,
  "address"        TEXT,
  "city"           TEXT,
  "province"       TEXT,
  "postalCode"     TEXT,
  "phone"          TEXT,
  "email"          TEXT,
  "website"        TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Department table
CREATE TABLE IF NOT EXISTS "Department" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "managerId"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Department_name_key" UNIQUE ("name")
);

-- Add columns to Employee
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "reportsToId"  TEXT;

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportsToId_fkey"
    FOREIGN KEY ("reportsToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
