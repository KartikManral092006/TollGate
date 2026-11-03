import type { Metadata } from "next";
import { connection } from "next/server";
import { verifySession } from "@/features/auth/server/session";
import { AcceptInvite } from "@/features/teams/components/accept-invite";

export const instant = false;

export const metadata: Metadata = {
  title: "Join a team · Tollgate",
  robots: { index: false, follow: false },
};

// Approvers and client guests land here from an invite link: sign in (magic link works
// without any install), then one tap joins the team.
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  await connection();
  const { token } = await params;
  await verifySession(`/invite/${token}`);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">You&apos;re invited to approve risky agent actions</h1>
      <p className="text-sm text-muted-foreground">
        Your team&apos;s coding agents will ask before deploying, migrating or publishing. You will
        see exactly what will run (with secrets hidden) and can approve, deny with a reason, or call
        the person who asked.
      </p>
      <AcceptInvite token={token} />
    </main>
  );
}
