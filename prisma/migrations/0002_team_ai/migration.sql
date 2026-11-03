-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('builtin', 'anthropic', 'openai_compatible');

-- CreateTable
CREATE TABLE "team_ai_configs" (
    "teamId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL DEFAULT 'builtin',
    "label" TEXT,
    "baseUrl" TEXT,
    "model" TEXT,
    "apiKeySealed" TEXT,
    "apiKeyLast4" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_ai_configs_pkey" PRIMARY KEY ("teamId")
);

-- AddForeignKey
ALTER TABLE "team_ai_configs" ADD CONSTRAINT "team_ai_configs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
