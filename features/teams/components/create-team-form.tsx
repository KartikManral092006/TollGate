"use client";

import { Loader2 } from "lucide-react";
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
        setError(
          response.status === 429
            ? "You've created a lot of teams today. Try again tomorrow."
            : "Couldn't create the team. Try again.",
        );
        return;
      }
      const team = (await response.json()) as { id: string };
      router.push(`/teams/${team.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="team-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Billing"
          aria-label="Team name"
          maxLength={64}
          required
          className="h-10"
        />
        <Button type="submit" className="h-10" disabled={busy || name.trim().length === 0}>
          {busy && <Loader2 className="animate-spin" />}
          Create team
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
