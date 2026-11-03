-- AlterTable
ALTER TABLE "gates" ADD COLUMN     "followUpOfId" TEXT,
ADD COLUMN     "question" VARCHAR(500);

-- CreateIndex
CREATE INDEX "gates_followUpOfId_idx" ON "gates"("followUpOfId");

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_followUpOfId_fkey" FOREIGN KEY ("followUpOfId") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

