"use client";

import { KeyRound, Link2, Loader2, ShieldCheck, Terminal, Zap } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Section } from "@/components/shell/section";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PolicyState } from "@/features/insights/server/policy";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { timeAgo } from "@/features/room/shared/format";
import { AiSettings } from "@/features/settings/components/ai-card";
import { CopyField } from "@/features/settings/components/copy-field";
import { TeamExit, TeamName } from "@/features/settings/components/delete-team-card";
import { FreezeSettings } from "@/features/settings/components/freeze-card";
import { RulesSettings } from "@/features/settings/components/rules-card";
import type { FreezeView } from "@/features/teams/shared/freeze";
import type { InviteRow, RepoRow } from "@/features/teams/server/settings";
import { REPO_NAME_RE } from "@/features/teams/shared/schemas";
import type { AiConfigView } from "@/features/why/shared/providers";
import { cn } from "@/lib/utils";

// invitedBy: whose link they joined through, so a forwarded link shows up here.
type Member = { id: string; name: string; role: string; invitedBy: string | null };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  approver: "Approver",
  requester: "Requester",
  guest: "Client",
};

// Owner only. Off by default: the developer's own words are more personal than a command.
function SharingSettings({
  teamId,
  isOwner,
  initial,
}: {
  teamId: string;
  isOwner: boolean;
  initial: { shareAgentTask: boolean };
}) {
  const [on, setOn] = useState(initial.shareAgentTask);
  const [busy, setBusy] = useState(false);

  async function change(next: boolean) {
    setBusy(true);
    setOn(next);
    const { ok } = await postJson(`/api/teams/${teamId}/sharing`, { shareAgentTask: next }, "PUT");
    setBusy(false);
    if (!ok) {
      setOn(!next);
      toast.error("Couldn't save that. Try again.");
      return;
    }
    toast.success(
      next ? "Approvers now see the agent's task." : "The agent's task is no longer shared.",
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-3">
        <Switch
          checked={on}
          onCheckedChange={(next) => void change(next)}
          disabled={!isOwner || busy}
          className="mt-0.5"
          aria-describedby="share-task-help"
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium">The agent&apos;s task</span>
          <span id="share-task-help" className="text-sm text-muted-foreground">
            The developer&apos;s last instruction to the agent and the calls it made since (at most
            five: a command&apos;s first line, a file&apos;s path, an MCP tool&apos;s name). Helps
            approvers judge whether the command fits the job. Needs CLI 0.3 or later.
          </span>
        </span>
      </label>
      {!isOwner && <p className="text-xs text-muted-foreground">Only the owner can change this.</p>}
    </div>
  );
}

async function postJson(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

function ConfirmRevoke({
  title,
  description,
  onConfirm,
  label = "Revoke",
}: {
  title: string;
  description: React.ReactNode;
  onConfirm: () => Promise<void>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="shrink-0 text-destructive" />}
      >
        {label}
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
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function initCommand(data: Record<string, unknown>): string {
  return `npx -y tollgate-cli@latest init --server ${String(data.serverUrl)} --token ${String(data.token)}`;
}

// A freshly minted token's command. The token is shown this once.
function IssuedCommand({
  repo,
  command,
  onDone,
}: {
  repo: string;
  command: string;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex max-w-2xl flex-col gap-3 border-s-4 border-gate-approved ps-4"
    >
      <p className="text-sm font-semibold text-gate-approved-fg">
        Token created for {repo}. Run this in the repo:
      </p>
      <CodeBlock size="sm" className="border-0 bg-asphalt text-white dark:bg-asphalt">
        <CodeBlockContent wrap className="pe-11! text-xs break-all">
          {command}
        </CodeBlockContent>
        <CodeBlockActions>
          <CodeBlockCopyButton
            value={command}
            className="bg-white/10! text-white/80 ring-white/20! hover:bg-white/20! hover:text-white"
          />
        </CodeBlockActions>
      </CodeBlock>
      <p className="text-xs text-muted-foreground">
        Shown once. If you lose it, create another token and revoke this one. Then restart Claude
        Code and run <code className="font-mono">npx -y tollgate-cli test</code>.
      </p>
      <Button variant="outline" size="sm" className="self-start" onClick={onDone}>
        Done
      </Button>
    </motion.div>
  );
}

function LinkRepo({ teamId, isOwner }: { teamId: string; isOwner: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"guard" | "delegate">("guard");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ repo: string; command: string } | null>(null);
  const valid = REPO_NAME_RE.test(name.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const { ok, data } = await postJson(`/api/teams/${teamId}/repos`, {
        name: name.trim(),
        mode,
      });
      if (!ok) {
        toast.error(
          data.error === "forbidden"
            ? "Only the owner can turn on Delegate mode."
            : "Couldn't link the repo.",
        );
        return;
      }
      setIssued({
        repo: name.trim(),
        command: initCommand(data),
      });
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (issued) {
    return <IssuedCommand {...issued} onDone={() => setIssued(null)} />;
  }

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="repo-name">Repository</Label>
        <Input
          id="repo-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="acme/billing"
          autoComplete="off"
          spellCheck={false}
          className="h-10 font-mono"
          aria-invalid={name.length > 0 && !valid}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Mode</Label>
        <ToggleGroup
          value={[mode]}
          onValueChange={(value: string[]) => value[0] && setMode(value[0] as "guard" | "delegate")}
          variant="outline"
          aria-label="Mode"
        >
          <ToggleGroupItem value="guard" className="h-10">
            <ShieldCheck /> Guard
          </ToggleGroupItem>
          <ToggleGroupItem value="delegate" disabled={!isOwner} className="h-10">
            <Zap /> Delegate
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        {mode === "guard"
          ? "Recommended. Tollgate can only stop commands; after the team approves, Claude Code still asks as usual."
          : "The team's approval lets that exact command run without Claude Code asking again. Owner only."}
      </p>
      <Button type="submit" className="justify-self-start" disabled={!valid || busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Terminal />}
        Create token
      </Button>
    </form>
  );
}

function Repos({ teamId, repos, isOwner }: { teamId: string; repos: RepoRow[]; isOwner: boolean }) {
  const router = useRouter();
  const [minting, setMinting] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ repoId: string; repo: string; command: string } | null>(
    null,
  );

  // Another token for a repo that's already linked: no need to type its name again.
  async function newToken(repo: RepoRow) {
    setMinting(repo.id);
    try {
      const { ok, data } = await postJson(`/api/teams/${teamId}/repos/${repo.id}/tokens`, {});
      if (!ok) {
        toast.error("Couldn't create a token.");
        return;
      }
      setIssued({ repoId: repo.id, repo: repo.name, command: initCommand(data) });
      router.refresh();
    } finally {
      setMinting(null);
    }
  }

  async function revoke(tokenId: string) {
    const { ok } = await postJson(`/api/teams/${teamId}/tokens/${tokenId}`, {}, "DELETE");
    if (ok) {
      toast.success("Token revoked. Commands from that machine are now blocked.");
      router.refresh();
    } else {
      toast.error("Couldn't revoke the token.");
    }
  }

  if (repos.length === 0) {
    return <p className="text-sm text-muted-foreground">No repos linked yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {repos.map((repo) => (
        <div key={repo.id} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="flex min-w-0 items-center gap-2 font-mono text-sm font-semibold">
              <span className="truncate">{repo.name}</span>
              <Badge variant={repo.mode === "delegate" ? "default" : "secondary"}>
                {repo.mode === "delegate" ? "Delegate" : "Guard"}
              </Badge>
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="ms-auto shrink-0"
              onClick={() => void newToken(repo)}
              disabled={minting !== null}
            >
              {minting === repo.id ? <Loader2 className="animate-spin" /> : <Terminal />}
              New token
            </Button>
          </div>
          {issued?.repoId === repo.id && (
            <IssuedCommand
              repo={issued.repo}
              command={issued.command}
              onDone={() => setIssued(null)}
            />
          )}
          {repo.tokens.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active tokens.</p>
          ) : (
            <ul className="divide-y border-y">
              {repo.tokens.map((token) => (
                <li key={token.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="w-28 shrink-0 truncate font-mono text-xs">{token.prefix}…</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {token.createdBy}
                    {token.mine ? " (you)" : ""},{" "}
                    {token.lastUsedAt ? `used ${timeAgo(token.lastUsedAt)}` : "never used"}
                  </span>
                  {(isOwner || token.mine) && (
                    <ConfirmRevoke
                      title="Revoke this token?"
                      description={`Risky commands from the machine using ${token.prefix}… will be blocked until it's linked again.`}
                      onConfirm={() => revoke(token.id)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Invites({ teamId, invites }: { teamId: string; invites: InviteRow[] }) {
  const router = useRouter();
  const [role, setRole] = useState<"approver" | "guest">("approver");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    try {
      const { ok, data } = await postJson(`/api/teams/${teamId}/invites`, { role });
      if (!ok) {
        toast.error("Couldn't create the invite.");
        return;
      }
      setLink(String(data.url));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inviteId: string) {
    const { ok } = await postJson(`/api/teams/${teamId}/invites/${inviteId}`, {}, "DELETE");
    if (ok) {
      toast.success("Invite link disabled.");
      router.refresh();
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          value={[role]}
          onValueChange={(value: string[]) => value[0] && setRole(value[0] as "approver" | "guest")}
          variant="outline"
          aria-label="Invite as"
        >
          <ToggleGroupItem value="approver">Teammate</ToggleGroupItem>
          <ToggleGroupItem value="guest">Client</ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={create} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Link2 />}
          Create link
        </Button>
      </div>
      {link && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex flex-col gap-1.5"
        >
          <CopyField value={link} label="invite link" mono={false} />
          <p className="text-xs text-muted-foreground">Works for 10 people for 3 days.</p>
        </motion.div>
      )}
      {invites.length > 0 && (
        <ul className="divide-y border-y">
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center gap-3 py-2.5 text-sm">
              <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {ROLE_LABEL[invite.role] ?? invite.role} link
                <span className="text-muted-foreground">
                  , {invite.uses} of {invite.maxUses} used, expires {timeAgo(invite.expiresAt)}
                </span>
              </span>
              <ConfirmRevoke
                title="Disable this invite link?"
                description="Anyone who hasn't joined yet won't be able to use it. People who already joined stay."
                onConfirm={() => revoke(invite.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Members({
  teamId,
  members,
  viewerId,
  isOwner,
}: {
  teamId: string;
  members: Member[];
  viewerId: string;
  isOwner: boolean;
}) {
  const router = useRouter();

  async function remove(member: Member) {
    const { ok, data } = await postJson(`/api/teams/${teamId}/members/${member.id}`, {}, "DELETE");
    if (!ok) {
      toast.error(
        data.error === "cannot_remove_owner"
          ? "The team's owner can't be removed."
          : `Couldn't remove ${member.name}. Try again.`,
      );
      return;
    }
    toast.success(`${member.name} was removed from the team.`);
    router.refresh();
  }

  return (
    <ul className="divide-y border-y">
      {members.map((member) => (
        <li key={member.id} className="flex items-center gap-3 py-2.5">
          <PersonAvatar id={member.id} name={member.name} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col">
            <Link
              href={`/people/${member.id}`}
              className="truncate text-sm font-medium underline-offset-4 hover:text-primary hover:underline"
            >
              {member.name}
              {member.id === viewerId && <span className="text-muted-foreground"> (you)</span>}
            </Link>
            {member.invitedBy && (
              <span className="truncate text-xs text-muted-foreground">
                Joined via {member.invitedBy}’s invite
              </span>
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {ROLE_LABEL[member.role] ?? member.role}
          </span>
          {isOwner && member.id !== viewerId && member.role !== "owner" && (
            <ConfirmRevoke
              label="Remove"
              title={`Remove ${member.name} from the team?`}
              description={
                <>
                  They lose access right away: their machines&apos; tokens stop working, their
                  waiting gates and votes on open gates are cancelled, and invite links they made
                  stop working. Past decisions stay in the audit log. You can invite them again
                  later.
                </>
              }
              onConfirm={() => remove(member)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

type NavSection = { id: string; label: string };

// Which section is being read: the last one whose top has passed the upper third.
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const update = () => {
      let current = ids[0] ?? null;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top < window.innerHeight * 0.33) {
          current = id;
        }
      }
      // At the very bottom, the last section is the one in view.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        current = ids.at(-1) ?? current;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids]);
  return active;
}

function SectionNav({ sections, active }: { sections: NavSection[]; active: string | null }) {
  return (
    <>
      {/* Desktop: a list that follows you down the page. */}
      <nav aria-label="Settings sections" className="sticky top-0 hidden self-start py-8 lg:block">
        <ul className="flex flex-col gap-0.5 border-s">
          {sections.map((section) => (
            <li key={section.id} className="relative">
              {active === section.id && (
                <motion.span
                  layoutId="settings-section-marker"
                  transition={{ type: "spring", stiffness: 520, damping: 42 }}
                  className="absolute inset-y-1 -start-px w-0.5 rounded-full bg-primary"
                />
              )}
              <a
                href={`#${section.id}`}
                className={cn(
                  "block py-1.5 ps-4 text-sm transition-colors outline-none focus-visible:text-foreground",
                  active === section.id
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {/* Phones: a strip under the top bar. */}
      <nav
        aria-label="Settings sections"
        className="sticky top-14 z-20 -mx-4 overflow-x-auto border-b bg-background/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden"
      >
        <ul className="flex gap-5">
          {sections.map((section) => (
            <li key={section.id} className="relative shrink-0">
              <a
                href={`#${section.id}`}
                className={cn(
                  "block py-3 text-sm whitespace-nowrap",
                  active === section.id ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {section.label}
              </a>
              {active === section.id && (
                <motion.span
                  layoutId="settings-section-strip"
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                />
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export function SettingsClient({
  teamId,
  teamName,
  viewer,
  members,
  repos,
  invites,
  ai,
  policy,
  sharing,
  freeze,
}: {
  teamId: string;
  teamName: string;
  ai: AiConfigView;
  policy: PolicyState;
  sharing: { shareAgentTask: boolean };
  freeze: FreezeView | null;
  viewer: { id: string; role: string };
  members: Member[];
  repos: RepoRow[];
  invites: InviteRow[];
}) {
  const isOwner = viewer.role === "owner";
  const canLink = viewer.role !== "guest";
  const [sections] = useState<NavSection[]>(() => [
    ...(isOwner ? [{ id: "team", label: "Team name" }] : []),
    ...(canLink ? [{ id: "link", label: "Link a repo" }] : []),
    { id: "repos", label: "Linked repos" },
    ...(isOwner ? [{ id: "invite", label: "Invite people" }] : []),
    { id: "rules", label: "Rules" },
    { id: "freeze", label: "Freeze" },
    { id: "sharing", label: "What approvers see" },
    { id: "ai", label: "AI explanations" },
    { id: "members", label: "Members" },
    { id: "danger", label: isOwner ? "Delete team" : "Leave team" },
  ]);
  const [ids] = useState(() => sections.map((section) => section.id));
  const active = useActiveSection(ids);

  return (
    <>
      <PageHeader title="Settings" description={`Repos, people and rules for ${teamName}.`} />
      <div className="flex-1 px-4 sm:px-6 lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10 lg:px-10 xl:gap-16">
        <SectionNav sections={sections} active={active} />
        <div className="max-w-5xl pb-16">
          {isOwner && (
            <Section
              id="team"
              title="Team name"
              description="Shown to everyone in the team, in the sidebar, on invites and in the team's chat."
            >
              <TeamName teamId={teamId} initial={teamName} />
            </Section>
          )}
          {canLink && (
            <Section
              id="link"
              title="Link a repo"
              description="Each developer links the repo on their own machine. The token can raise gates for this repo and read their status; it can never approve anything."
            >
              <LinkRepo teamId={teamId} isOwner={isOwner} />
            </Section>
          )}
          <Section
            id="repos"
            title="Linked repos"
            description="One token per developer's machine. Revoke a token if a laptop is lost or someone leaves."
          >
            <Repos teamId={teamId} repos={repos} isOwner={isOwner} />
          </Section>
          {isOwner && (
            <Section
              id="invite"
              title="Invite people"
              description="Teammates approve from the room. Clients approve from a link on their phone: no install, no Slack seat."
            >
              <Invites teamId={teamId} invites={invites} />
            </Section>
          )}
          <Section
            id="rules"
            title="Rules from your decisions"
            description="When your team approves the same kind of command every time, waiting adds little. Suggested after 10 approvals in 30 days with no denials; never for production, publishing, infrastructure or deletes outside the repo."
          >
            <RulesSettings teamId={teamId} isOwner={isOwner} state={policy} />
          </Section>
          <Section
            id="freeze"
            title="Freeze and incident mode"
            description="For a release week, a holiday or an outage: for a while, people decide everything, and production asks for more."
          >
            <FreezeSettings
              teamId={teamId}
              canManage={viewer.role === "owner" || viewer.role === "approver"}
              initial={freeze}
            />
          </Section>
          <Section
            id="sharing"
            title="What approvers see"
            description="Besides the command itself. Everything here comes from the developer's machine with secrets removed there, and again on the server."
          >
            <SharingSettings teamId={teamId} isOwner={isOwner} initial={sharing} />
          </Section>
          <Section
            id="ai"
            title="AI explanations"
            description={
              <>
                What the &ldquo;Why?&rdquo; button on gate cards uses: your own provider (paid, free
                tier or self-hosted) or the free built-in explanations. Explanations never approve
                or deny anything.
              </>
            }
          >
            <AiSettings teamId={teamId} isOwner={isOwner} initial={ai} />
          </Section>
          <Section
            id="members"
            title="Members"
            description="Owners, approvers and clients can vote. Nobody can approve their own agent's command."
          >
            <Members teamId={teamId} members={members} viewerId={viewer.id} isOwner={isOwner} />
          </Section>
          <Section
            id="danger"
            title={isOwner ? "Delete this team" : "Leave this team"}
            description={
              isOwner
                ? "For a project that's over or a team made to try Tollgate out."
                : "For a team you no longer approve or run commands for."
            }
          >
            <TeamExit
              teamId={teamId}
              teamName={teamName}
              isOwner={isOwner}
              repos={repos.length}
              members={members.length}
            />
          </Section>
        </div>
      </div>
    </>
  );
}
