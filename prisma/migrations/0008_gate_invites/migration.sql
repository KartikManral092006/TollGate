-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "gateId" TEXT;

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "invitedById" TEXT;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
