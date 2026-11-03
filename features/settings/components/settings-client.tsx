"use client";

import {
  FolderGit2,
  KeyRound,
  Link2,
  Loader2,
  ShieldCheck,
  Terminal,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
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
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { ExitTab, SignIcon } from "@/components/road/sign-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from "@/components/ui/code-block";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PersonAvatar } from "@/features/room/components/person-avatar";
import { timeAgo } from "@/features/room/shared/format";
import { AiCard } from "@/features/settings/components/ai-card";
import { CopyField } from "@/features/settings/components/copy-field";
import type { InviteRow, RepoRow } from "@/features/teams/server/settings";
import { REPO_NAME_RE } from "@/features/teams/shared/schemas";
import type { AiConfigView } from "@/features/why/shared/providers";

type Member = { id: string; name: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  approver: "Approver",
  requester: "Requester",
  guest: "Client",
};

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
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="text-destructive" />}
      >
        Revoke
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
            Revoke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LinkRepoCard({ teamId, isOwner }: { teamId: string; isOwner: boolean }) {
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
        command: `npx tollgate-cli init --server ${String(data.serverUrl)} --token ${String(data.token)}`,
      });
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="link" className="scroll-mt-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
          <SignIcon>
            <Terminal />
          </SignIcon>
          Link a repo
        </CardTitle>
        <CardDescription>
          Each developer links the repo on their own machine. The token can raise gates for this
          repo and read their status; it can never approve anything.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {issued ? (
          <div className="flex flex-col gap-3 rounded-xl border border-gate-approved/40 bg-gate-approved-bg p-3">
            <p className="text-sm font-medium text-gate-approved-fg">
              Token created for {issued.repo}. Run this in the repo:
            </p>
            <CodeBlock size="sm" className="bg-background">
              <CodeBlockContent wrap className="pe-11! text-xs break-all">
                {issued.command}
              </CodeBlockContent>
              <CodeBlockActions>
                <CodeBlockCopyButton value={issued.command} />
              </CodeBlockActions>
            </CodeBlock>
            <p className="text-xs text-muted-foreground">
              Shown once. If you lose it, create another token and revoke this one. Then restart
              Claude Code and run <code className="font-mono">npx tollgate-cli test</code>.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setIssued(null)}
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repo-name">Repository</Label>
              <Input
                id="repo-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="acme/billing"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                aria-invalid={name.length > 0 && !valid}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mode</Label>
              <ToggleGroup
                value={[mode]}
                onValueChange={(value: string[]) =>
                  value[0] && setMode(value[0] as "guard" | "delegate")
                }
                variant="outline"
                aria-label="Mode"
              >
                <ToggleGroupItem value="guard">
                  <ShieldCheck /> Guard
                </ToggleGroupItem>
                <ToggleGroupItem value="delegate" disabled={!isOwner}>
                  <Zap /> Delegate
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {mode === "guard"
                  ? "Recommended. Tollgate can only stop commands; after the team approves, Claude Code still asks as usual."
                  : "The team's approval lets that exact command run without Claude Code asking again. Owner only."}
              </p>
            </div>
            <Button type="submit" className="self-start" disabled={!valid || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Create token
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ReposCard({
  teamId,
  repos,
  isOwner,
}: {
  teamId: string;
  repos: RepoRow[];
  isOwner: boolean;
}) {
  const router = useRouter();
  if (repos.length === 0) return null;

  async function revoke(tokenId: string) {
    const { ok } = await postJson(`/api/teams/${teamId}/tokens/${tokenId}`, {}, "DELETE");
    if (ok) {
      toast.success("Token revoked. Commands from that machine are now blocked.");
      router.refresh();
    } else {
      toast.error("Couldn't revoke the token.");
    }
  }

  return (
    <Card id="repos" className="scroll-mt-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
          <SignIcon>
            <FolderGit2 />
          </SignIcon>
          Linked repos
        </CardTitle>
        <CardDescription>Revoke a token if a laptop is lost or someone leaves.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {repos.map((repo) => (
          <section key={repo.id} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 font-mono text-sm font-semibold">
              {repo.name}
              <Badge variant={repo.mode === "delegate" ? "default" : "secondary"}>
                {repo.mode === "delegate" ? "Delegate" : "Guard"}
              </Badge>
            </h3>
            {repo.tokens.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active tokens.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {repo.tokens.map((token) => (
                  <li key={token.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs">{token.prefix}…</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {token.createdBy}
                        {token.mine ? " (you)" : ""} ·{" "}
                        {token.lastUsedAt ? `used ${timeAgo(token.lastUsedAt)}` : "never used"}
                      </p>
                    </div>
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
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function InvitesCard({ teamId, invites }: { teamId: string; invites: InviteRow[] }) {
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
    <Card id="invite" className="scroll-mt-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
          <SignIcon>
            <UserPlus />
          </SignIcon>
          Invite people
        </CardTitle>
        <CardDescription>
          Approvers are teammates. Clients approve from a link on their phone: no install, no Slack
          seat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[role]}
            onValueChange={(value: string[]) =>
              value[0] && setRole(value[0] as "approver" | "guest")
            }
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
          <div className="flex flex-col gap-1.5">
            <CopyField value={link} label="invite link" mono={false} />
            <p className="text-xs text-muted-foreground">Works for 10 people for 3 days.</p>
          </div>
        )}
        {invites.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {ROLE_LABEL[invite.role] ?? invite.role} link · {invite.uses}/{invite.maxUses}{" "}
                  used · expires {timeAgo(invite.expiresAt)}
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
      </CardContent>
    </Card>
  );
}

function MembersCard({ members, viewerId }: { members: Member[]; viewerId: string }) {
  return (
    <Card id="members" className="scroll-mt-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
          <SignIcon>
            <Users />
          </SignIcon>
          Members
        </CardTitle>
        <CardDescription>
          Owners, approvers and clients can vote. Nobody can approve their own agent&apos;s command.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3">
              <PersonAvatar id={member.id} name={member.name} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {member.name}
                {member.id === viewerId && <span className="text-muted-foreground"> (you)</span>}
              </span>
              <Badge variant="outline">{ROLE_LABEL[member.role] ?? member.role}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function SettingsClient({
  teamId,
  viewer,
  members,
  repos,
  invites,
  ai,
}: {
  teamId: string;
  ai: AiConfigView;
  viewer: { id: string; role: string };
  members: Member[];
  repos: RepoRow[];
  invites: InviteRow[];
}) {
  const isOwner = viewer.role === "owner";
  const canLink = viewer.role !== "guest";
  const sections = [
    ...(canLink ? [{ id: "link", label: "Link a repo" }] : []),
    { id: "repos", label: "Linked repos" },
    ...(isOwner ? [{ id: "invite", label: "Invite" }] : []),
    { id: "ai", label: "AI" },
    { id: "members", label: "Members" },
  ];
  return (
    <main className="mx-auto w-full max-w-2xl px-3 py-5 sm:px-4">
      <Stagger className="flex flex-col gap-4">
        {/* Exits to each section: the page is long on a phone. */}
        <StaggerItem>
          <nav aria-label="Jump to" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExitTab className="text-xs">{section.label}</ExitTab>
              </a>
            ))}
          </nav>
        </StaggerItem>
        {canLink && (
          <StaggerItem>
            <LinkRepoCard teamId={teamId} isOwner={isOwner} />
          </StaggerItem>
        )}
        <StaggerItem>
          <ReposCard teamId={teamId} repos={repos} isOwner={isOwner} />
        </StaggerItem>
        {isOwner && (
          <StaggerItem>
            <InvitesCard teamId={teamId} invites={invites} />
          </StaggerItem>
        )}
        <StaggerItem>
          <AiCard teamId={teamId} isOwner={isOwner} initial={ai} />
        </StaggerItem>
        <StaggerItem>
          <MembersCard members={members} viewerId={viewer.id} />
        </StaggerItem>
      </Stagger>
    </main>
  );
}
