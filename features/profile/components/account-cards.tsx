"use client";

import { Check, KeyRound, Laptop, Loader2, LogOut, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Row, RowList } from "@/components/shell/section";
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
import { authClient } from "@/features/auth/client/auth-client";
import type { ProfileSession, ProfileToken } from "@/features/profile/shared/profile";
import { timeAgo } from "@/features/room/shared/format";

async function send(url: string, method: "DELETE") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return response.ok;
}

function Confirm({
  trigger,
  title,
  description,
  action,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="shrink-0 text-destructive" />}
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Your name, edited in place. It's what teammates see on gate cards and votes.
export function NameEditor({ name, className }: { name: string; className?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const trimmed = value.replace(/\s+/g, " ").trim();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.updateUser({ name: trimmed.slice(0, 64) });
      if (result.error) {
        toast.error("Couldn't save your name. Try again.");
        return;
      }
      toast.success("Name saved. Teammates see it on your next gate.");
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={className}
        onClick={() => {
          setValue(name);
          setEditing(true);
        }}
      >
        <Pencil />
        Edit name
      </Button>
    );
  }
  return (
    <form onSubmit={save} className="flex w-full max-w-sm items-center gap-2">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
        autoFocus
        autoComplete="name"
        maxLength={64}
        aria-label="Your name"
        className="h-9 bg-white text-foreground"
      />
      <Button type="submit" size="icon" aria-label="Save name" disabled={busy || !trimmed}>
        {busy ? <Loader2 className="animate-spin" /> : <Check />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        aria-label="Cancel"
        onClick={() => setEditing(false)}
      >
        <X />
      </Button>
    </form>
  );
}

// The hook tokens you made: one per repo per machine you ran `init` on.
export function LinkedMachines({ tokens }: { tokens: ProfileToken[] }) {
  const router = useRouter();
  if (tokens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No machines linked. In a team&apos;s Settings › Repos, make a token and run the command it
        shows in your repo.
      </p>
    );
  }
  return (
    <RowList>
      {tokens.map((token) => (
        <Row key={token.id}>
          <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">
              {token.repo}{" "}
              <span className="font-normal text-muted-foreground">in {token.teamName}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
              <code className="font-mono">{token.prefix}…</code>, made {timeAgo(token.createdAt)},{" "}
              {token.lastUsedAt ? `last used ${timeAgo(token.lastUsedAt)}` : "never used"}
            </span>
          </span>
          <Confirm
            trigger="Revoke"
            title={`Revoke the token for ${token.repo}?`}
            description="Risky commands from the machine using it will be blocked until you run init there with a new token."
            action="Revoke"
            onConfirm={async () => {
              if (await send(`/api/teams/${token.teamId}/tokens/${token.id}`, "DELETE")) {
                toast.success("Token revoked.");
                router.refresh();
              } else {
                toast.error("Couldn't revoke the token.");
              }
            }}
          />
        </Row>
      ))}
    </RowList>
  );
}

// Every browser signed in as you, with a way to sign the others out.
export function SignedInBrowsers({ sessions }: { sessions: ProfileSession[] }) {
  const router = useRouter();
  const others = sessions.filter((s) => !s.current);
  return (
    <div className="flex flex-col gap-4">
      <RowList>
        {sessions.map((session) => (
          <Row key={session.id}>
            <Laptop className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2 truncate font-medium">
                {session.device}
                {session.current && (
                  <span className="rounded-full bg-gate-approved-bg px-2 text-xs leading-5 font-semibold text-gate-approved-fg">
                    This browser
                  </span>
                )}
              </span>
              <span className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
                Signed in {timeAgo(session.createdAt)}
                {session.ip ? `, from ${session.ip}` : ""}
              </span>
            </span>
            {!session.current && (
              <Confirm
                trigger="Sign out"
                title={`Sign out ${session.device}?`}
                description="That browser will need a new sign-in link to get back in."
                action="Sign out"
                onConfirm={async () => {
                  if (await send(`/api/me/sessions/${session.id}`, "DELETE")) {
                    toast.success("Signed out.");
                    router.refresh();
                  } else {
                    toast.error("Couldn't sign that browser out.");
                  }
                }}
              />
            )}
          </Row>
        ))}
      </RowList>
      {others.length > 0 && (
        <div>
          <Confirm
            trigger={
              <>
                <LogOut />
                Sign out everywhere else
              </>
            }
            title={`Sign out ${others.length} other ${others.length === 1 ? "browser" : "browsers"}?`}
            description="Use this if you signed in on a shared or lost device. This browser stays signed in."
            action="Sign out others"
            onConfirm={async () => {
              if (await send("/api/me/sessions", "DELETE")) {
                toast.success("Signed out everywhere else.");
                router.refresh();
              } else {
                toast.error("Couldn't sign the other browsers out.");
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
