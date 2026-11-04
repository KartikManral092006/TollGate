-- AlterTable
ALTER TABLE "gates" ADD COLUMN     "windowId" TEXT;

-- CreateTable
CREATE TABLE "approval_windows" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "env" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_windows_repoId_preset_env_requesterId_expiresAt_idx" ON "approval_windows"("repoId", "preset", "env", "requesterId", "expiresAt");

-- CreateIndex
CREATE INDEX "approval_windows_teamId_expiresAt_idx" ON "approval_windows"("teamId", "expiresAt");

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "approval_windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_windows" ADD CONSTRAINT "approval_windows_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_windows" ADD CONSTRAINT "approval_windows_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "repo_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_windows" ADD CONSTRAINT "approval_windows_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_windows" ADD CONSTRAINT "approval_windows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_windows" ADD CONSTRAINT "approval_windows_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_windows" ADD CONSTRAINT "approval_windows_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
