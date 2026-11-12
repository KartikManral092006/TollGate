<div align="center">

# Tollgate

**Your coding agent moves fast. Production waits for your team.**

Tollgate pauses Claude Code before it deploys, migrates, publishes or deletes, and asks your team in a live room.
Approve it, or deny it with a reason, and the agent changes its plan.

[![CI](https://github.com/KartikManral092006/TollGate/actions/workflows/ci.yml/badge.svg)](https://github.com/KartikManral092006/TollGate/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/tollgate-cli?label=tollgate-cli)](https://www.npmjs.com/package/tollgate-cli)
[![Node](https://img.shields.io/badge/node-%E2%89%A520.19-339933)](packages/cli/package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[Live app](https://toll-gate-mo7d.vercel.app) ·
[Try it in your browser](https://toll-gate-mo7d.vercel.app/#demo) ·
[Docs](https://toll-gate-mo7d.vercel.app/docs) ·
[CLI](packages/cli/README.md)

</div>

---

## Contents

- [Why Tollgate](#why-tollgate)
- [How it works](#how-it-works)
- [Features](#features)
- [Get started](#get-started)
- [What gets gated](#what-gets-gated)
- [Security and privacy](#security-and-privacy)
- [Built on Nexconn](#built-on-nexconn)
- [Architecture](#architecture)
- [Run it locally](#run-it-locally)
- [Testing](#testing)
- [Deploying](#deploying)
- [Limitations](#limitations)
- [Project background](#project-background)
- [License](#license)

## Why Tollgate

Coding agents now run real commands: `vercel --prod`, `prisma migrate deploy`, `npm publish`,
`terraform apply`. Claude Code's permission prompt asks **one person, at one laptop, right now**.
That doesn't fit how teams make risky changes:

- The person who should decide is often not the one running the agent: a lead, an ops engineer,
  or the client who owns the production database.
- A plain "no" stops the agent but doesn't tell it what to do instead.
- Approvals in a chat app or on GitHub don't see what happens on a developer's machine: deploy
  CLIs, database migrations, package publishes and cloud deletes.

Tollgate puts a gate in front of those commands only. Everything else runs as before.

## How it works

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Claude Code
    participant Hook as tollgate hook (laptop)
    participant Server as Tollgate server
    participant Team as Team room (web / phone)

    Agent->>Hook: wants to run "pnpm db:deploy"
    Hook->>Hook: match presets, look inside scripts, redact secrets
    Hook->>Server: raise gate TG-42
    Server->>Team: live gate card + notification
    Team->>Server: approve, or deny with a reason
    Server-->>Hook: decision
    alt approved
        Hook-->>Agent: allow (Claude Code's own check still applies)
        Agent->>Hook: command finished
        Hook->>Server: outcome (exit code, duration, last lines)
    else denied
        Hook-->>Agent: the reason, as the agent's next instruction
    end
```

A gate ends in one of four ways:

| Outcome              | What the agent experiences                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Approved**         | The command continues through Claude Code's normal permission check.                                                                                                       |
| **Denied**           | It receives the reason ("Back up the table first") and revises its plan.                                                                                                   |
| **Asked a question** | It answers in the description of its next try, and the team decides on the new card.                                                                                       |
| **Nobody answers**   | The gate is **parked** and approvers are reminded. The agent moves on. Once someone approves, the exact same command passes on retry (a single-use grant, valid 24 hours). |

Commands that don't match a preset run untouched; the hook adds about 50 ms.

## Features

**Deciding**

- A live **team room** with gate cards, threaded replies and team chat; it works the same on a phone.
- **Quorum per preset**: production deploys and infrastructure changes need two approvals.
- **Nobody approves their own agent's command.** Clients can approve from an invite link, with no install.
- **Hold to approve** on production and high-risk gates, so a stray tap can't approve them.
- A keyboard-driven **review queue**, and a **"Why?"** explanation of any command (built in and free,
  or your own AI provider).

**Context for approvers**

- **What it will do:** read-only checks on the developer's machine show the commit a deploy ships,
  the exact `name@version` a publish releases, how many files an `rm -rf` deletes, pending
  migrations, or a Terraform plan.
- **Looks through wrappers:** `pnpm db:deploy` is shown as _pnpm db:deploy → prisma migrate deploy_,
  with the migration SQL.
- **The agent's task (opt-in):** the developer's last instruction to the agent and the calls it made since.
- **Precedent:** how the team decided the same command before.

**After the decision**

- **What happened:** succeeded or failed, exit code, duration and the last lines of output,
  with secrets removed.
- **Audit log** with search, CSV export and metrics: median decision time, denial rate,
  rubber-stamped approvals.
- **Rules from your decisions:** after 10 approvals in 30 days with no denials, Tollgate suggests
  auto-approving that kind of command. It never suggests this for production, publishing,
  infrastructure or deletes outside the repo.

**Team safety**

- **Freeze and incident mode:** rules and approval windows pause, and production needs more approvals.
- **Emergency bypass** (`TOLLGATE_BYPASS=1`) works offline, but every bypass is reported to the team
  and waits for someone else to review it.
- **Approval windows:** approve a kind of command for a short time instead of one call at a time.
- Owners can remove members, delete a team, and revoke a lost laptop's token.

## Get started

You need a Tollgate server (the [hosted one](https://toll-gate-mo7d.vercel.app) or
[your own](#run-it-locally)), Claude Code, and Node.js 20.19 or later.

1. **Sign in and create a team.** Sign-in is passwordless: Tollgate emails you a link (Google and
   GitHub sign-in appear when the server has them configured).
2. **Link your repo.** Type its name as on GitHub (for example `acme/web`). Tollgate never needs
   access to GitHub.
3. **Connect your computer.** In the repo folder, paste the command the app shows you:

   ```bash
   npx -y tollgate-cli@latest init --server https://toll-gate-mo7d.vercel.app --token tg_…
   ```

4. **Restart Claude Code**, then raise a harmless test gate:

   ```bash
   npx -y tollgate-cli test
   ```

5. **Invite a teammate or client** from Settings to decide it. You can't approve your own agent's command.

`init` writes `.tollgate.json` (commit it: server, repo and presets) and
`.claude/settings.local.json` (personal, added to `.gitignore`). Your token is stored outside the
repo in `~/.config/tollgate/` (mode 0600). See the [CLI README](packages/cli/README.md) for every
command and option.

## What gets gated

The defaults below ship with `init`. Teams can add their own in `.tollgate.json`, but the server
decides the quorum, so editing the file locally can't lower it.

| Preset           | Examples                                                                     | Approvals needed     |
| ---------------- | ---------------------------------------------------------------------------- | -------------------- |
| `prod-deploy`    | `vercel --prod`, `fly deploy`, `railway up --environment production`         | 2                    |
| `staging-deploy` | `fly deploy -a app-staging`, `railway up --environment staging`              | 1                    |
| `db-migrate`     | `prisma migrate deploy`, `prisma db push`, `drizzle-kit push`, `psql … DROP` | 1 (2 for production) |
| `publish`        | `npm publish`, `pnpm publish`, `cargo publish`, `twine upload`               | 1                    |
| `infra`          | `terraform apply`, `pulumi up`, `aws … delete-*`, `gcloud … delete`          | 2                    |
| `destructive-fs` | `rm -rf` outside the repo                                                    | 1                    |
| `opaque`         | `curl … \| sh`, `base64 -d \| sh`, `eval "$CMD"`                             | 1                    |
| `env-file`       | edits to `.env` files (values hidden on the card)                            | 1                    |
| `ci-config`      | edits to `.github/workflows/`, Vercel, Netlify, Fly or Railway config        | 1                    |
| `guard-config`   | edits to Tollgate's own setup or Claude Code's settings                      | 1                    |
| `mcp-risky`      | MCP tools that delete, deploy, publish, merge, refund, charge or run SQL     | 1                    |

## Security and privacy

- **Fails closed.** If the server can't be reached, a gated command is blocked with a message
  saying why. Tollgate always answers before Claude Code's hook timeout, because Claude Code runs the
  command if a hook times out.
- **Secrets are removed twice.** On the laptop (known token formats, `KEY=value` secrets, passwords
  in URLs, secret flags, and every value from your `.env*` files) and again on the server.
  The card shows how many values were hidden.
- **Only gated commands leave your machine.** For those, Tollgate sends the redacted command and folder, the branch,
  the last commit subject, the agent's one-line description of the command, and for migrations the newest
  migration's SQL (at most 2 KB).
- **Guard mode by default.** A team approval removes Tollgate's block; Claude Code still asks as
  usual. Delegate mode, which skips that prompt for the exact approved command, is opt-in per repo and owner-only.
- **Tokens can only raise gates.** Repo tokens can raise gates and read their status. They can never
  approve anything. Grants are single-use and tied to the repo and the exact command.
- **Not a sandbox.** Tollgate guards against an agent's mistakes, not against a person determined to
  get around it on their own machine. See [Limitations](#limitations).

## Built on Nexconn

The team room runs on the [Nexconn](https://nexconn.ai) Chat and Call SDKs:

| Nexconn feature                 | Where it's used in Tollgate                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Group channels                  | One room per team: gate cards, replies and team chat                                      |
| Custom message types + metadata | Gate cards whose status, votes and outcome update live on every device                    |
| Server API, sending as a bot    | Gate cards and decisions posted by the server, not by a person                            |
| System messages                 | "Waiting on you", reminders for parked gates, decisions on parked gates and bypass alerts |
| Online status                   | "Who can approve now" in the room                                                         |
| Machine translation             | Read a teammate's message in your own language                                            |
| Call SDK (audio)                | Ring an approver or start a huddle on a gate, behind `CALLS_ENABLED`                      |

Postgres stays the source of truth. If Nexconn is unavailable, gates, votes and the audit log still
work, and the room refreshes on its own.

## Architecture

```text
Claude Code ──hook──▶ tollgate-cli (Node, on the laptop)
                         │  HTTPS, repo token
                         ▼
                    Next.js app (Vercel) ── Postgres (Prisma) · Redis (rate limits, locks)
                         │
                         ├── Nexconn Chat / Call ── team room on web and phone
                         └── Resend ── sign-in links and email notifications
```

| Layer    | Stack                                                                                         |
| -------- | --------------------------------------------------------------------------------------------- |
| Web app  | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Base UI / shadcn, Motion, GSAP |
| Data     | PostgreSQL with Prisma 7, Redis (ioredis)                                                     |
| Auth     | Better Auth: email magic link, Google, GitHub                                                 |
| Realtime | Nexconn Chat, ChatUI and Call SDKs                                                            |
| CLI      | `tollgate-cli`: one esbuild bundle, zero runtime dependencies on the laptop                   |
| Quality  | Vitest (unit and Postgres integration), ESLint, Prettier, GitHub Actions                      |

```text
app/            Routes: marketing site and docs, the app, and the API (including /api/hook/*)
features/       One folder per feature (gates, room, review, audit, teams, settings, …),
                split into server/, client/, components/ and shared/
packages/cli/   The tollgate-cli package: init, status, test, unlink and the hook
prisma/         Schema and migrations
tests/          unit/ and integration/ (real Postgres)
```

Code in `features/*/shared` runs in the browser, on the server and in the CLI bundle. The preset
matcher, redaction and quorum rules are written once and used in all three.

## Run it locally

**Prerequisites:** Node.js 20.19+, pnpm, Docker.

```bash
git clone https://github.com/KartikManral092006/TollGate.git
cd TollGate
pnpm install

cp .env.example .env
# Set AUTH_SECRET in .env, e.g. to the output of: openssl rand -base64 32

pnpm db:up        # Postgres on :5436 and Redis on :6381 (Docker)
pnpm db:deploy    # apply migrations
pnpm dev          # http://localhost:3001
```

Without an email key, the sign-in link is printed in the terminal running `pnpm dev`. To connect a
repo to your local server, run the `init` command the app shows. It points at
`http://localhost:3001`.

<details>
<summary><strong>Environment variables</strong></summary>

| Variable                                     | Required | Purpose                                                                           |
| -------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | Yes      | Postgres connection (pooled in production)                                        |
| `DIRECT_URL`                                 | Prod     | Direct Postgres connection for migrations (Neon)                                  |
| `REDIS_URL`                                  | Yes      | Rate limits and locks                                                             |
| `NEXT_PUBLIC_APP_URL`                        | Yes      | The app's public URL; also the server the CLI talks to                            |
| `AUTH_SECRET`                                | Yes      | At least 32 characters                                                            |
| `AUTH_GOOGLE_ID` / `_SECRET`                 | No       | Google sign-in                                                                    |
| `AUTH_GITHUB_ID` / `_SECRET`                 | No       | GitHub sign-in                                                                    |
| `EMAIL_API_KEY`, `EMAIL_FROM`                | Prod     | Resend, for sign-in links and notifications                                       |
| `CONTACT_EMAIL`                              | Prod     | Shown on the privacy policy and terms; production builds fail without it          |
| `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`      | No       | Team room chat, live cards, presence and calls. Without them, chat is unavailable |
| `NEXCONN_AREA`                               | No       | `SG` (default), `NA` or `SA`                                                      |
| `CALLS_ENABLED`, `CALL_MINUTES_PER_TEAM_DAY` | No       | Audio calls (off by default) and a daily budget per team                          |
| `AI_API_KEY`                                 | No       | Server-wide default for "Why?" (Anthropic)                                        |
| `AI_KEYS_SECRET`                             | No       | Encrypts teams' own AI keys at rest; needed for teams to save one                 |
| `AUTH_IP_HEADER`, `AUTH_TRUSTED_PROXIES`     | No       | Client IP for rate limits behind a proxy                                          |

`.env.example` lists them all. The app checks them at startup and names any that are invalid.

</details>

## Testing

```bash
pnpm test            # unit tests
pnpm typecheck       # route types + tsc
pnpm lint
pnpm format:check

# Integration tests run against a real Postgres. The database name must end in _test.
# The Docker setup creates tollgate_test.
DATABASE_URL=postgresql://tollgate:tollgate@localhost:5436/tollgate_test pnpm db:deploy
TEST_DATABASE_URL=postgresql://tollgate:tollgate@localhost:5436/tollgate_test pnpm test:int
```

CI runs formatting, lint, typecheck and unit tests, applies the migrations, and fails if they don't
match `prisma/schema.prisma`.

## Deploying

The live app runs on Vercel (`vercel.json`): each build runs `pnpm db:deploy && pnpm build`, so
migrations are applied before the new version goes live. Set the variables marked _Prod_ above.
`NEXT_PUBLIC_APP_URL` must be the production URL, not localhost; the build fails early if it isn't.

To release the CLI: bump `packages/cli/package.json`, then run `npm publish` in `packages/cli`.
Developers pick it up by running `npx -y tollgate-cli@latest init` again.

## Limitations

- **Claude Code only**, through its hooks. Other agents aren't supported yet.
- **Not a shell parser or a sandbox.** It doesn't read Makefiles (`make deploy`), shell scripts
  (`./deploy.sh`), npm lifecycle scripts such as `prepublishOnly`, or workspace scripts selected with
  `--filter`.
- **The emergency bypass is trusted.** Anyone who can start Claude Code with `TOLLGATE_BYPASS=1`
  can skip the gate. Tollgate makes that visible and reviewable; it can't prevent it.
- **Exit codes for successes:** Claude Code reports that a command succeeded but not its exit code,
  so a successful run shows as "succeeded" rather than "exit 0".

## Project background

Tollgate was built solo for the **Nexconn Build Challenge 2026** (Workplace & Collaboration track).
The generic foundation (auth, the Nexconn token signer, rate limits, Redis locks and CI) was adapted
from the author's earlier challenge project, Margin, written on Nov 1–2 within the challenge window.
Everything specific to Tollgate was built for this entry.

Bugs and ideas are welcome as [GitHub issues](https://github.com/KartikManral092006/TollGate/issues).
Please report security problems privately to the maintainer rather than in a public issue.

## License

Tollgate, including the web app and the CLI, is released under the [MIT License](LICENSE).
Third-party packages it depends on, such as the Nexconn SDKs, keep their own licenses.
