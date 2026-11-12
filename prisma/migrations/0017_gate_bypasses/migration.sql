-- AlterEnum
ALTER TYPE "GateStatus" ADD VALUE 'bypassed';

-- AlterTable
ALTER TABLE "gates" ADD COLUMN     "reviewNote" VARCHAR(500),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

