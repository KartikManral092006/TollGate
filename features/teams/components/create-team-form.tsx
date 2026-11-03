"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? "Too many teams today." : "Could not create the team.");
        return;
      }
      const team = (await response.json()) as { id: string };
      router.push(`/teams/${team.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Team name, e.g. Billing"
        maxLength={64}
        required
        aria-label="Team name"
      />
      <Button type="submit" disabled={busy || name.trim().length === 0}>
        {busy ? "Creating…" : "Create team"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
