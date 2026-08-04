-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "disabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
