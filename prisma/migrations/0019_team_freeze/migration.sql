-- AlterTable
ALTER TABLE "gates" ADD COLUMN     "frozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "freezeById" TEXT,
ADD COLUMN     "freezeKind" TEXT,
ADD COLUMN     "freezeReason" VARCHAR(200),
ADD COLUMN     "freezeStartedAt" TIMESTAMP(3),
ADD COLUMN     "freezeUntil" TIMESTAMP(3);

