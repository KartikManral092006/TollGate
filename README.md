<div align="center">

<img src=".github/assets/logo.svg" alt="" width="72" height="72">

# Tollgate

**Your coding agent moves fast. Production waits for your team.**

Tollgate pauses Claude Code before it deploys, migrates, publishes or deletes, and asks your team
in a live room. Approve it, or deny it with a reason, and the agent changes its plan.

[![CI](https://github.com/KartikManral092006/TollGate/actions/workflows/ci.yml/badge.svg)](https://github.com/KartikManral092006/TollGate/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/tollgate-cli?label=tollgate-cli)](https://www.npmjs.com/package/tollgate-cli)
[![Node](https://img.shields.io/badge/node-%E2%89%A520.19-339933)](packages/cli/package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[**Live app**](https://toll-gate-mo7d.vercel.app) ·
[Try it in your browser](https://toll-gate-mo7d.vercel.app/#demo) ·
[Documentation](https://toll-gate-mo7d.vercel.app/docs) ·
[CLI reference](packages/cli/README.md)

</div>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/room-dark.png">
  <img alt="A Tollgate team room. Priya's agent wants to run vercel --prod. The card shows what Priya asked the agent, the calls it made since, that the deploy ships one uncommitted change from an unpushed branch, and how the team decided a similar command before. An approver can deny it with a reason or hold to approve. A list on the right shows five gates waiting and one bypass that needs review." src=".github/assets/room-light.png">
</picture>

<p align="center"><sub>The team room, with made-up demo data. Every screenshot in this README is the real app.</sub></p>

## Contents

- [Why Tollgate](#why-tollgate)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Features](#features)
- [What gets gated](#what-gets-gated)
- [Security and privacy](#security-and-privacy)
- [Built on Nexconn](#built-on-nexconn)
- [Architecture](#architecture)
- [Self-hosting and development](#self-hosting-and-development)
- [FAQ](#faq)
- [Limitations](#limitations)
- [Contributing](#contributing)
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

## Quick start

You need Claude Code and Node.js 20.19 or later.

1. **Create a team** at [toll-gate-mo7d.vercel.app](https://toll-gate-mo7d.vercel.app). Sign-in is
   passwordless.
2. **Link your repo** by typing its name, for example `acme/web`. Tollgate never needs access to
   GitHub.
3. **Connect your computer.** In the repo folder, paste the command the app shows you:

   ```bash
   npx -y tollgate-cli@latest init --server https://toll-gate-mo7d.vercel.app --token tg_…
   ```

4. **Restart Claude Code**, then raise a harmless test gate:

   ```bash
   npx -y tollgate-cli test
   ```

5. **Invite a teammate or client** from Settings to decide it. Nobody can approve their own agent's
   command.

`init` writes `.tollgate.json` (commit it: server, repo and presets) and
`.claude/settings.local.json` (personal, added to `.gitignore`). Your token is stored outside the
repo, in `~/.config/tollgate/` with mode 0600. The [CLI reference](packages/cli/README.md) covers
every command and option.

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

| Outcome              | What the agent experiences                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Approved**         | The command continues through Claude Code's normal permission check.                                                                                                           |
| **Denied**           | It receives the reason ("Back up the table first") and revises its plan.                                                                                                       |
| **Asked a question** | It answers in the description of its next try, and the team decides on the new card.                                                                                           |
| **Nobody answers**   | The gate is **parked** and approvers are reminded. The agent moves on. Once someone approves, the exact same command passes on retry (a single-use grant, valid for 24 hours). |

Commands that don't match a preset run untouched; the hook adds about 50 ms to each call.

## Features

### Decide from anywhere

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/phone-dark.png">
  <img align="right" width="280" alt="The review queue on a phone: a staging deploy, how the team decided it before, the command, and large Deny and Approve buttons." src=".github/assets/phone-light.png">
</picture>

- A live **team room** with gate cards, threaded replies and team chat. It works the same way on a phone.
- **Quorum per preset:** production deploys and infrastructure changes need two approvals.
- **Nobody approves their own agent's command.** Clients approve from an invite link, with
  nothing to install.
- **Hold to approve** on production and high-risk gates, so a stray tap can't approve them.
- **Deny with a reason**, or pick a ready-made one such as "Back up the data first". The agent
  gets it as its next instruction.
- A keyboard-driven **review queue** (`J`/`K` to move, `A` to approve, `D` to deny).
- **"Why?"** explains any command in plain words: built in and free, or with your own AI provider.
- **Approval windows** approve one kind of command for a short time, instead of one call at a time.

<br clear="right">

### Context before the decision

- **What it will do:** read-only checks on the developer's machine show the commit a deploy ships
  (including uncommitted or unpushed work), the exact `name@version` a publish releases, how many
  files an `rm -rf` deletes, pending migrations, or a Terraform plan.
- **Looks through wrappers:** `pnpm db:deploy` is shown as _pnpm db:deploy → prisma migrate deploy_,
  with the migration SQL.
- **The agent's task (opt-in):** the developer's last instruction to the agent and the calls it
  made since.
- **Precedent:** how the team decided the same command before.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/review-dark.png">
  <img alt="The review queue on a desktop: a staging deploy with its precedent, a Why? explanation in plain words on the right, and the keyboard shortcuts." src=".github/assets/review-light.png">
</picture>

### After the decision

- **What happened:** whether the command succeeded or failed, its exit code, how long it took and the
  last lines of output, with secrets removed.
- **Audit log** with search, CSV export and metrics: median decision time, denial rate and
  rubber-stamped approvals.
- **Rules from your decisions:** after 10 approvals in 30 days with no denials, Tollgate suggests
  auto-approving that kind of command. It never suggests this for production, publishing,
  infrastructure or deletes outside the repo.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/audit-dark.png">
  <img alt="The audit log: 118 gates, a median decision time of 5 minutes, 16% denied and 0% rubber-stamped, above a searchable list of gates with who requested each, the outcome, and whether it ran." src=".github/assets/audit-light.png">
</picture>

### Team safety

- **Freeze and incident mode:** auto-approve rules and approval windows pause, and production needs
  more approvals.
- **Emergency bypass** (`TOLLGATE_BYPASS=1`) works offline, but every bypass is reported to the
  team and waits for someone else to review it.
- **Membership controls:** owners can remove members, revoke a lost laptop's token or delete a team.
  Members can leave a team.

## What gets gated

These presets ship with `init`. Teams can add their own in `.tollgate.json`, but the server
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
| `env-file`       | Edits to `.env` files (values are hidden on the card)                        | 1                    |
| `ci-config`      | Edits to `.github/workflows/`, Vercel, Netlify, Fly or Railway config        | 1                    |
| `guard-config`   | Edits to Tollgate's own setup or Claude Code's settings                      | 1                    |
| `mcp-risky`      | MCP tools that delete, deploy, publish, merge, refund, charge or run SQL     | 1                    |

## Security and privacy

- **Fails closed.** If the server can't be reached, a gated command is blocked with a message
  saying why. Tollgate always answers before Claude Code's hook timeout, because Claude Code runs
  the command when a hook times out.
- **Secrets are removed twice.** First on the laptop: known token formats, `KEY=value` secrets,
  passwords in URLs, secret flags, and every value from your `.env*` files. Then again on the
  server. The card shows how many values were hidden.
- **Only gated commands leave your machine.** For those, Tollgate sends the redacted command and
  folder, the branch, the last commit subject, the agent's one-line description of the command,
  and for migrations the newest migration's SQL (at most 2 KB).
- **Guard mode by default.** A team approval removes Tollgate's block, and Claude Code still asks as
  usual. Delegate mode, which skips that prompt for the exact approved command, is opt-in per repo
  and owner-only.
- **Tokens can't approve.** Repo tokens can raise gates and read their status, never approve.
  Grants are single-use and tied to the repo and the exact command.

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Built on Nexconn

The team room runs on the [Nexconn](https://nexconn.ai) Chat and Call SDKs:

| Nexconn feature                 | Where Tollgate uses it                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Group channels                  | One room per team: gate cards, replies and team chat                                      |
| Custom message types + metadata | Gate cards whose status, votes and outcome update live on every device                    |
| Server API, sending as a bot    | Gate cards and decisions posted by the server, not by a person                            |
| System messages                 | "Waiting on you", reminders for parked gates, decisions on parked gates and bypass alerts |
| Online status                   | Who is online to approve, shown in the room                                               |
| Machine translation             | Read a teammate's message in your own language                                            |
| Call SDK (audio)                | Ring an approver or start a huddle on a gate, behind `CALLS_ENABLED`                      |

Postgres is the source of truth. If Nexconn is unavailable, gates, votes and the audit log still
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
| Auth     | Better Auth: email magic link, optional Google and GitHub                                     |
| Realtime | Nexconn Chat, ChatUI and Call SDKs                                                            |
| CLI      | `tollgate-cli`: a single esbuild bundle with no runtime dependencies                          |
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
matcher, redaction and quorum rules are written once and used in all three places.

## Self-hosting and development

**Prerequisites:** Node.js 20.19+, pnpm and Docker.

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

Without an email key, the sign-in link is printed in the terminal running `pnpm dev`. To connect
a repo to your local server, run the `init` command the app shows; it points at
`http://localhost:3001`.

<details>
<summary><strong>Environment variables</strong></summary>

<br>

| Variable                                     | Required | Purpose                                                                            |
| -------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | Yes      | Postgres connection (pooled in production)                                         |
| `DIRECT_URL`                                 | Prod     | Direct Postgres connection for migrations (Neon)                                   |
| `REDIS_URL`                                  | Yes      | Rate limits and locks                                                              |
| `NEXT_PUBLIC_APP_URL`                        | Yes      | The app's public URL; also the server the CLI talks to                             |
| `AUTH_SECRET`                                | Yes      | At least 32 characters                                                             |
| `AUTH_GOOGLE_ID` / `_SECRET`                 | No       | Google sign-in                                                                     |
| `AUTH_GITHUB_ID` / `_SECRET`                 | No       | GitHub sign-in                                                                     |
| `EMAIL_API_KEY`, `EMAIL_FROM`                | Prod     | Resend, for sign-in links and notifications                                        |
| `CONTACT_EMAIL`                              | Prod     | Shown on the privacy policy and terms; production builds fail without it           |
| `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`      | No       | Team room chat, live cards, presence and calls. Without them, chat is unavailable. |
| `NEXCONN_AREA`                               | No       | `SG` (default), `NA` or `SA`                                                       |
| `CALLS_ENABLED`, `CALL_MINUTES_PER_TEAM_DAY` | No       | Audio calls (off by default) and a daily budget per team                           |
| `AI_API_KEY`                                 | No       | Server-wide default for "Why?" (Anthropic)                                         |
| `AI_KEYS_SECRET`                             | No       | Encrypts teams' own AI keys at rest; needed for teams to save one                  |
| `AUTH_IP_HEADER`, `AUTH_TRUSTED_PROXIES`     | No       | Client IP for rate limits behind a proxy                                           |

`.env.example` lists them all. The app checks them at startup and names any that are invalid.

</details>

<details>
<summary><strong>Testing</strong></summary>

<br>

```bash
pnpm test            # unit tests
pnpm typecheck       # route types + tsc
pnpm lint
pnpm format:check

# Integration tests run against a real Postgres. The database name must end in _test;
# the Docker setup creates tollgate_test.
DATABASE_URL=postgresql://tollgate:tollgate@localhost:5436/tollgate_test pnpm db:deploy
TEST_DATABASE_URL=postgresql://tollgate:tollgate@localhost:5436/tollgate_test pnpm test:int
```

CI runs formatting, lint, typecheck and unit tests, applies the migrations, and fails if they
don't match `prisma/schema.prisma`.

</details>

<details>
<summary><strong>Deploying</strong></summary>

<br>

The live app runs on Vercel (`vercel.json`). Each build runs `pnpm db:deploy && pnpm build`, so
migrations are applied before the new version goes live. Set the variables marked _Prod_ above.
`NEXT_PUBLIC_APP_URL` must be the production URL, not localhost; the build fails early if it is.

To release the CLI, bump the version in `packages/cli/package.json` and run `npm publish` in
`packages/cli`. Developers pick it up by running `npx -y tollgate-cli@latest init` again.

</details>

## FAQ

<details>
<summary><strong>Does Tollgate see my code?</strong></summary>

<br>

No. Nothing is sent for commands that don't match a preset. For gated ones, Tollgate sends the
redacted command and the context listed under [Security and privacy](#security-and-privacy),
never your source files.

</details>

<details>
<summary><strong>What happens if the Tollgate server is down?</strong></summary>

<br>

Gated commands are blocked with a message saying the server couldn't be reached, and every other
command runs normally. In a real emergency, a person can start Claude Code with
`TOLLGATE_BYPASS=1`. The bypass is queued on the laptop and reported to the team once the server
can be reached again.

</details>

<details>
<summary><strong>Can the agent approve its own command, or turn Tollgate off?</strong></summary>

<br>

No. Repo tokens can't approve, and nobody can approve their own agent's command. Edits to Tollgate's
setup and to Claude Code's settings are gated themselves (`guard-config`). The bypass variable is
read from Claude Code's environment, which the agent's shell can't set.

</details>

<details>
<summary><strong>Does it work with agents other than Claude Code?</strong></summary>

<br>

Not yet. Tollgate uses Claude Code's hooks (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`).

</details>

<details>
<summary><strong>Do approvers need to install anything?</strong></summary>

<br>

No. Approvers use the web app on a computer or phone. Clients join from an invite link.

</details>

## Limitations

- **Claude Code only**, through its hooks.
- **Not a shell parser or a sandbox.** Tollgate doesn't read Makefiles (`make deploy`), shell
  scripts (`./deploy.sh`), npm lifecycle scripts such as `prepublishOnly`, or workspace scripts
  selected with `--filter`. It guards against an agent's mistakes, not against a person determined
  to get around it on their own machine.
- **The emergency bypass is trusted.** Anyone who can start Claude Code with `TOLLGATE_BYPASS=1`
  can skip the gate. Tollgate makes that visible and reviewable; it can't prevent it.
- **No exit code for successes.** Claude Code reports that a command succeeded but not its exit
  code, so a successful run shows as "succeeded" rather than "exit 0".

## Contributing

Bug reports, ideas and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to
set up the project, the checks a change must pass, and how the code is organised. Please report
security problems privately, as described in [SECURITY.md](SECURITY.md).

## Project background

Tollgate was built solo by [Kartik Manral](https://github.com/KartikManral092006) for the
**Nexconn Build Challenge 2026** (Workplace & Collaboration track). The generic foundation (auth,
the Nexconn token signer, rate limits, Redis locks and CI) was adapted from the author's earlier
challenge project, Margin, written on Nov 1–2 within the challenge window. Everything specific to
Tollgate was built for this entry.

## License

Tollgate, including the web app and the CLI, is released under the [MIT License](LICENSE).
Third-party packages it depends on, such as the Nexconn SDKs, keep their own licenses.
