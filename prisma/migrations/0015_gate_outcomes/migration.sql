-- AlterTable
ALTER TABLE "gates" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "exitCode" INTEGER,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "outcomeAt" TIMESTAMP(3),
ADD COLUMN     "output" VARCHAR(1000);
