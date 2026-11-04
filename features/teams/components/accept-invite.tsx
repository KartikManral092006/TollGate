"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  invalid: "This invite link is not valid.",
  expired: "This invite has expired. Ask for a new link.",
  used_up: "This invite has been used up. Ask for a new link.",
};

export function AcceptInvite({ token, label }: { token: string; label: string }) {
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
      const body = (await response.json()) as {
        teamId?: string;
        gateId?: string | null;
        error?: string;
      };
      if (!response.ok || !body.teamId) {
        setError(MESSAGES[body.error ?? ""] ?? "Could not join the team.");
        return;
      }
      // An invite made for a gate opens on that gate, with a one-time hint by Approve.
      router.push(
        body.gateId
          ? `/teams/${body.teamId}?gate=${body.gateId}&joined=1`
          : `/teams/${body.teamId}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button className="h-11 px-5" onClick={accept} disabled={busy}>
        {busy ? "Joining…" : label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
