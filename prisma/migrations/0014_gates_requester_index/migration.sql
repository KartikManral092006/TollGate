-- CreateIndex
CREATE INDEX "gates_requesterId_createdAt_idx" ON "gates"("requesterId", "createdAt" DESC);
