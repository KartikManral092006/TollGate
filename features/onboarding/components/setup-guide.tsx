"use client";

import {
  Check,
  ChevronDown,
  Link2,
  Loader2,
  PartyPopper,
  Terminal,
  UserPlus,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Celebrate } from "@/components/motion/celebrate";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block";
import { Input } from "@/components/ui/input";
import { authClient } from "@/features/auth/client/auth-client";
import {
  currentStep,
  SETUP_ORDER,
  type SetupState,
  type SetupStepId,
} from "@/features/onboarding/shared/steps";
import { CopyField } from "@/features/settings/components/copy-field";
import { GateInvite } from "@/features/teams/components/gate-invite";
import { REPO_NAME_RE } from "@/features/teams/shared/schemas";
import { cn } from "@/lib/utils";

const TITLES: Record<SetupStepId, string> = {
  name: "Add your name",
  repo: "Link the repo your agent works in",
  connect: "Connect your computer",
  gate: "See your first gate",
  invite: "Get a gate decided by someone else",
};

const POLL_MS = 4000;
const HIDE_KEY = (teamId: string) => `tollgate:setup-hidden:${teamId}`;

function Command({ value }: { value: string }) {
  return (
    <CodeBlock size="sm" className="bg-asphalt text-white">
      <CodeBlockContent wrap className="pe-11! text-xs break-all">
        {value}
      </CodeBlockContent>
      <CodeBlockActions>
        <CodeBlockCopyButton value={value} />
      </CodeBlockActions>
    </CodeBlock>
  );
}

function StepMarker({ index, done, active }: { index: number; done: boolean; active: boolean }) {
  return (
    <span
      className={cn(
        "relative grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-colors",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : active
            ? "border-signal bg-signal/15 text-foreground"
            : "border-border text-muted-foreground",
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {done ? (
          <motion.span
            key="done"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 22 }}
          >
            <Check className="size-4" strokeWidth={3} />
          </motion.span>
        ) : (
          <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {index + 1}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function SetupGuide({
  teamId,
  serverUrl,
  isOwner,
  initial,
}: {
  teamId: string;
  serverUrl: string;
  isOwner: boolean;
  initial: SetupState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState<SetupStepId | null>(currentStep(initial));
  const [command, setCommand] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const previous = useRef(initial);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setHidden(window.localStorage.getItem(HIDE_KEY(teamId)) === "1");
      } catch {
        // storage blocked: keep showing the guide
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [teamId]);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/teams/${teamId}/setup`, { cache: "no-store" });
    if (!response.ok) return;
    const next = (await response.json()) as SetupState;
    const before = previous.current;
    previous.current = next;
    setState(next);
    const finished = SETUP_ORDER.find((id) => next.steps[id] && !before.steps[id]);
    if (finished) {
      setOpen(currentStep(next));
      if (finished === "connect") toast.success("Your computer is connected to Tollgate.");
      if (finished === "gate") toast.success("Your first gate arrived. That's the whole loop!");
      if (finished === "invite") toast.success("Someone else decided a gate. Tollgate is set up.");
    }
    if (next.complete && !before.complete) router.refresh();
  }, [teamId, router]);

  useEffect(() => {
    if (state.complete || hidden) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [state.complete, hidden, refresh]);

  if (hidden || (state.complete && initial.complete)) return null;

  function hide() {
    setHidden(true);
    try {
      window.localStorage.setItem(HIDE_KEY(teamId), "1");
    } catch {
      // nothing to persist
    }
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    const value = name.replace(/\s+/g, " ").trim();
    if (!value) return;
    setBusy(true);
    try {
      const result = await authClient.updateUser({ name: value.slice(0, 64) });
      if (result.error) toast.error("Couldn't save your name.");
      else await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function linkRepo(event: React.FormEvent) {
    event.preventDefault();
    if (!REPO_NAME_RE.test(repo.trim())) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/repos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: repo.trim(), mode: "guard" }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        token?: string;
        serverUrl?: string;
      };
      if (!response.ok || !body.token) {
        toast.error("Couldn't link the repo. Use a name like your-name/your-project.");
        return;
      }
      setCommand(
        `npx tollgate-cli init --server ${body.serverUrl ?? serverUrl} --token ${body.token}`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    setBusy(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "approver" }),
      });
      const body = (await response.json().catch(() => ({}))) as { url?: string };
      if (body.url) setInvite(body.url);
      else toast.error("Couldn't create an invite link.");
    } finally {
      setBusy(false);
    }
  }

  function body(id: SetupStepId) {
    switch (id) {
      case "name":
        return (
          <form onSubmit={saveName} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="What your team calls you"
              autoComplete="name"
              aria-label="Your name"
              className="h-10"
            />
            <Button type="submit" className="h-10" disabled={busy || !name.trim()}>
              Save name
            </Button>
          </form>
        );
      case "repo":
        return (
          <div className="flex flex-col gap-2">
            <p>
              Type the repository name as it appears on GitHub. It&apos;s a label for your gates;
              Tollgate doesn&apos;t need access to GitHub.
            </p>
            <form onSubmit={linkRepo} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                placeholder="your-name/your-project"
                spellCheck={false}
                aria-label="Repository"
                className="h-10 font-mono text-sm"
              />
              <Button
                type="submit"
                className="h-10"
                disabled={busy || !REPO_NAME_RE.test(repo.trim())}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Link2 />} Link repo
              </Button>
            </form>
          </div>
        );
      case "connect":
        return (
          <div className="flex flex-col gap-2">
            <p>
              Open a terminal <strong>inside your project folder</strong> and paste this command.
              This step ticks itself off as soon as your computer connects.
            </p>
            {command ? (
              <Command value={command} />
            ) : (
              <p className="rounded-lg bg-muted px-3 py-2">
                Lost the command? Get a new one with <strong>New token</strong> next to your repo in{" "}
                <a
                  href={`/teams/${teamId}/settings`}
                  className="font-semibold underline underline-offset-4"
                >
                  Settings › Linked repos
                </a>
                .
              </p>
            )}
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Waiting for your computer…
              <a
                href="/docs/troubleshooting"
                target="_blank"
                className="ms-auto font-medium text-foreground underline-offset-4 hover:underline"
              >
                Stuck? Troubleshooting
              </a>
            </p>
          </div>
        );
      case "gate":
        return (
          <div className="flex flex-col gap-2">
            <p>Send a harmless test command (it only prints text) from the same folder:</p>
            <Command value="npx tollgate-cli test" />
            <p className="text-xs text-muted-foreground">
              A card appears below in a moment. Later, Claude Code&apos;s risky commands show up the
              same way.
            </p>
          </div>
        );
      case "invite":
        if (state.waitingGate && isOwner && state.memberCount === 1) {
          return (
            <div className="flex flex-col gap-3">
              <p>
                You can&apos;t approve your own agent&apos;s commands, so TG-
                {state.waitingGate.code} is waiting for someone else. Invite a teammate or client to
                decide it: they sign in from the link, with nothing to install.
              </p>
              <GateInvite gateId={state.waitingGate.id} code={state.waitingGate.code} />
            </div>
          );
        }
        if (state.memberCount > 1) {
          return (
            <p>
              Your team is in. This step finishes when someone decides a gate they didn&apos;t raise
              {state.waitingGate ? `: TG-${state.waitingGate.code} is waiting` : ""}.
            </p>
          );
        }
        return (
          <div className="flex flex-col gap-2">
            <p>
              You can&apos;t approve your own agent&apos;s commands, so invite a teammate or client.
              They sign in from the link: no install needed.
            </p>
            {invite ? (
              <CopyField value={invite} label="invite link" mono={false} />
            ) : isOwner ? (
              <Button
                variant="outline"
                className="h-10 self-start"
                onClick={createInvite}
                disabled={busy}
              >
                <UserPlus /> Create invite link
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ask the team owner for an invite link.
              </p>
            )}
          </div>
        );
    }
  }

  const ICON: Partial<Record<SetupStepId, React.ReactNode>> = {
    connect: <Terminal className="size-4" aria-hidden />,
  };

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Setup guide"
      className="overflow-hidden rounded-2xl border-2 border-primary/25 bg-card shadow-sm"
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold tracking-tight">
            {state.complete ? "You're all set" : "Get Tollgate working"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {state.complete
              ? "Your agent's risky commands now stop here for your team."
              : `${state.done} of ${state.total} done, about 3 minutes in total`}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Hide setup guide" onClick={hide}>
          <X />
        </Button>
      </div>
      <div className="mx-4 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${(state.done / state.total) * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      {state.complete ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative flex items-center gap-3 p-4 text-sm"
        >
          <Celebrate fire />
          <PartyPopper className="size-6 text-signal" aria-hidden />
          Next time Claude Code tries something risky in your repo, it waits here for a teammate.
        </motion.div>
      ) : (
        <ol className="flex flex-col p-2 pt-3">
          {SETUP_ORDER.map((id, index) => {
            const done = state.steps[id];
            const expanded = open === id && !done;
            return (
              <li key={id} className="rounded-xl">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <StepMarker index={index} done={done} active={id === currentStep(state)} />
                  <span
                    className={cn(
                      "flex flex-1 items-center gap-1.5 text-sm font-semibold",
                      done && "text-muted-foreground line-through decoration-2",
                    )}
                  >
                    {ICON[id]}
                    {TITLES[id]}
                  </span>
                  {!done && (
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        expanded && "rotate-180",
                      )}
                      aria-hidden
                    />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="ms-12 me-2 mb-3 flex flex-col gap-2 text-sm">{body(id)}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      )}
    </motion.section>
  );
}
