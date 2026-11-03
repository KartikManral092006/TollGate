"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/features/auth/client/auth-client";

// Email sign-ups start without a name, which would show as "Member ABCD" on gate cards.
export function NamePrompt() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed = name.replace(/\s+/g, " ").trim();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    setBusy(true);
    try {
      const result = await authClient.updateUser({ name: trimmed.slice(0, 64) });
      if (result.error) {
        toast.error("Couldn't save your name. Try again.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-3 border-s-4 border-signal ps-4 lg:flex-row lg:items-center lg:gap-8"
    >
      <div>
        <p className="font-medium">What should your team call you?</p>
        <p className="text-sm text-muted-foreground">
          Your name appears on gate cards and votes, e.g. &ldquo;Ana&apos;s agent wants to
          run…&rdquo;.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row lg:w-96">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          autoComplete="name"
          maxLength={64}
          aria-label="Your name"
          className="h-11"
        />
        <Button type="submit" className="h-11" disabled={busy || !trimmed}>
          Save
        </Button>
      </div>
    </form>
  );
}
