-- AlterTable
ALTER TABLE "gates" ADD COLUMN     "steps" VARCHAR(1000),
ADD COLUMN     "task" VARCHAR(500);

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "shareAgentTask" BOOLEAN NOT NULL DEFAULT false;
