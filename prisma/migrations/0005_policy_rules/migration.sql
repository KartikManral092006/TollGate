-- CreateEnum
CREATE TYPE "PolicyAction" AS ENUM ('one_approval', 'auto_approve');

-- AlterTable
ALTER TABLE "gates" ADD COLUMN     "policyRuleId" TEXT;

-- AlterTable
ALTER TABLE "repo_links" ADD COLUMN     "dismissedSuggestions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "policy_rules" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "env" TEXT NOT NULL,
    "action" "PolicyAction" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_rules_repoId_preset_env_key" ON "policy_rules"("repoId", "preset", "env");

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_policyRuleId_fkey" FOREIGN KEY ("policyRuleId") REFERENCES "policy_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_rules" ADD CONSTRAINT "policy_rules_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "repo_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_rules" ADD CONSTRAINT "policy_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

