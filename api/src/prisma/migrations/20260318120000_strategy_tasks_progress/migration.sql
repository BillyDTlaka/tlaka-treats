-- TaskSource: add STRATEGY value
ALTER TYPE "TaskSource" ADD VALUE IF NOT EXISTS 'STRATEGY';

-- Task: add employeeId and strategyId columns
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "strategyId" TEXT;

-- Strategy: add progressJson
ALTER TABLE "Strategy" ADD COLUMN IF NOT EXISTS "progressJson" JSONB NOT NULL DEFAULT '{}';

-- Foreign keys (add safely, ignore if already exists)
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_strategyId_fkey"
    FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
