-- AlterTable
ALTER TABLE "gates" ADD COLUMN "intent" VARCHAR(300),
ADD COLUMN "remindedAt" TIMESTAMP(3);
