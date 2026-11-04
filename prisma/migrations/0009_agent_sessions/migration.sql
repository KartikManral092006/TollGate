-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sessionId" VARCHAR(200) NOT NULL,
    "repoId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "agent_sessions_teamId_sessionId_key" ON "agent_sessions"("teamId", "sessionId");
-- CreateIndex
CREATE INDEX "gates_teamId_sessionId_idx" ON "gates"("teamId", "sessionId");
-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
