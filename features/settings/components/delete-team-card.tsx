"use client";

import { Check, DoorOpen, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: response.ok, error: data.error };
}

// The owner renames the team. Everyone sees the new name at once; the team's chat follows.
export function TeamName({ teamId, initial }: { teamId: string; initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const dirty = trimmed !== saved.trim() && trimmed.length > 0;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setBusy(true);
    try {
      const { ok } = await send(`/api/teams/${teamId}`, "PATCH", { name: trimmed });
      if (!ok) {
        toast.error("Couldn't rename the team. Try again.");
        return;
      }
      setSaved(trimmed);
      setName(trimmed);
      toast.success(`The team is now called ${trimmed}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex max-w-xl flex-col gap-1.5">
      <Label htmlFor="team-name-edit">Team name</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="team-name-edit"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={64}
          required
          className="h-10 text-base sm:h-9 sm:text-sm"
        />
        <Button type="submit" className="h-10 sm:h-9" disabled={!dirty || busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Save
        </Button>
      </div>
    </form>
  );
}

// The owner deletes the whole team after typing its name. Everyone else can leave it, so a
// team they no longer need stops filling their list.
export function TeamExit({
  teamId,
  teamName,
  isOwner,
  repos,
  members,
}: {
  teamId: string;
  teamName: string;
  isOwner: boolean;
  repos: number;
  members: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim() === teamName.trim();

  async function remove() {
    if (!matches) return;
    setBusy(true);
    try {
      const { ok, error } = await send(`/api/teams/${teamId}`, "DELETE", { name: typed });
      if (!ok) {
        toast.error(
          error === "wrong_name"
            ? "The name doesn't match. Type it exactly as shown."
            : error === "forbidden"
              ? "Only the team's owner can delete it."
              : "Couldn't delete the team. Try again.",
        );
        return;
      }
      setOpen(false);
      toast.success(`${teamName} was deleted.`);
      router.replace("/home");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      const { ok, error } = await send(`/api/teams/${teamId}/leave`, "POST", {});
      if (!ok) {
        toast.error(
          error === "owner_cannot_leave"
            ? "Owners can't leave. Delete the team instead."
            : "Couldn't leave the team. Try again.",
        );
        return;
      }
      setOpen(false);
      toast.success(`You left ${teamName}.`);
      router.replace("/home");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          <p className="font-semibold">Leave {teamName}</p>
          <p className="text-muted-foreground">
            It disappears from your list. Your machines&apos; tokens for its repos stop working and
            your waiting gates are cancelled. An owner can invite you back.
          </p>
        </div>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger render={<Button variant="outline" className="shrink-0" />}>
            <DoorOpen aria-hidden /> Leave team
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave {teamName}?</AlertDialogTitle>
              <AlertDialogDescription>
                You lose access right away. Past decisions stay in the team&apos;s audit log.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={busy} onClick={leave}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                Leave team
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4 sm:flex-row sm:items-center">
      <div className="flex-1 text-sm">
        <p className="font-semibold">Delete {teamName}</p>
        <p className="text-muted-foreground">
          Removes the team for everyone ({plural(members, "member", "members")}): its room,{" "}
          {plural(repos, "linked repo", "linked repos")} and {repos === 1 ? "its" : "their"} tokens,
          every gate and the audit log. This can&apos;t be undone.
        </p>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTyped("");
        }}
      >
        <AlertDialogTrigger render={<Button variant="destructive" className="shrink-0" />}>
          <Trash2 aria-hidden /> Delete team
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {teamName} for good?</AlertDialogTitle>
              <AlertDialogDescription>
                Everyone loses access. Developers&apos; agents can&apos;t raise gates for its repos
                any more, so their risky commands are blocked until they link another team.{" "}
                <Link
                  href={`/teams/${teamId}/audit`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Download the audit log
                </Link>{" "}
                first if you need it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-team-name">
                Type <span className="font-mono font-semibold">{teamName}</span> to confirm
              </Label>
              <Input
                id="delete-team-name"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="h-10 text-base sm:h-9 sm:text-sm"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" variant="destructive" disabled={!matches || busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                Delete team
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
