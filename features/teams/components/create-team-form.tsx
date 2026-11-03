"use client";

import { Loader2, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateTeamForm({ startOpen = false }: { startOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
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
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-card/60"
    >
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.button
            key="closed"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex w-full items-center gap-3 px-4 py-4 text-start font-semibold text-primary outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Plus className="size-5" />
            </span>
            Start a new team
          </motion.button>
        ) : (
          <motion.form
            key="open"
            onSubmit={submit}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3 p-4"
          >
            <label htmlFor="team-name" className="font-semibold">
              Name your team
            </label>
            <p className="-mt-2 text-sm text-muted-foreground">
              Usually your project or company, for example &ldquo;Billing&rdquo;. You can invite
              people next.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="team-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Team name"
                maxLength={64}
                required
                autoFocus
                className="h-11"
              />
              <Button type="submit" className="h-11" disabled={busy || name.trim().length === 0}>
                {busy && <Loader2 className="animate-spin" />}
                Create team
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
