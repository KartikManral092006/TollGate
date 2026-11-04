-- CreateTable
CREATE TABLE "gate_seen" (
    "gateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gate_seen_pkey" PRIMARY KEY ("gateId","userId")
);
-- CreateIndex
CREATE INDEX "gate_seen_userId_idx" ON "gate_seen"("userId");
-- AddForeignKey
ALTER TABLE "gate_seen" ADD CONSTRAINT "gate_seen_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gate_seen" ADD CONSTRAINT "gate_seen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
