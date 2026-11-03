"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  invalid: "This invite link is not valid.",
  expired: "This invite has expired. Ask for a new link.",
  used_up: "This invite has been used up. Ask for a new link.",
};

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json()) as { teamId?: string; error?: string };
      if (!response.ok || !body.teamId) {
        setError(MESSAGES[body.error ?? ""] ?? "Could not join the team.");
        return;
      }
      router.push(`/teams/${body.teamId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={accept} disabled={busy}>
        {busy ? "Joining…" : "Join the team"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
