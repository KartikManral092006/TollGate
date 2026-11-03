# Tollgate progress

Plan: [PLAN.md](PLAN.md). Deadline Nov 22, 23:59 AoE.

## Gates (kill checks, Nov 3)

| Gate | Check                                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0   | Claude Code hook spike (§8.1 a–d)                       | **Passes, with one hard rule.** (a) The deny reason reaches the model verbatim. "allow" runs a command with no pre-approval (Delegate mode works). The hook fires even when Bash is pre-allowed. (b) **On timeout Claude Code runs the command (fails open)**, so the hook must always answer first: it parks at timeout − 15 s, plus a watchdog. (c) Documented: hooks fire in every permission mode, and a deny blocks even with `--dangerously-skip-permissions` (Kartik to confirm once, see Next). (d) PermissionRequest only fires when a prompt would show, so it is worse as a mandatory gate; staying on PreToolUse. Docs: default timeout 600 s, no documented max; `"onFailure": "block"` (2.1.295+) makes a failed or timed-out hook block. `init` now sets it plus a `statusMessage` |
| T1   | G4 stream render                                        | **Open.** Needs the new Nexconn app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T2   | `createMessagesQuery` returns metadata?                 | **Open.** Needs the new Nexconn app                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T3   | Second Nexconn app bills $0                             | **Open (Kartik).** Console > Billing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| T4   | First-hand prior-art check                              | **Open (Kartik)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T5   | Two entries per person allowed?                         | **Open (Kartik).** hackathon@nexconn.ai                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T6   | Call + ChatUI in one engine                             | **Install half passes.** With pnpm `overrides`, call 26.2.1 resolves to the single chat/engine 26.2.1 copy, and everything call imports (`__install__`, 6 engine enums) exists in 26.2.1. **Live half open:** run `/dev/nexconn` as tgalice + tgbob (after T7)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| T7   | Call subscription is $0 / free minutes; server Call API | **Open (Kartik).** Console > Call > Call Subscription. Until then `CALLS_ENABLED=0`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

If T6's live half fails: drop `@nexconn/chatui`, pin engine/chat to 26.2.0 (call 26.2.1 installs cleanly then), and build DMs on the raw SDK.

## Day 1 (Nov 3): foundation and gate core

Copied from Margin's GitHub `main` (00ae08b, day 9), because the local `~/Desktop/Margin` files are iCloud-evicted (`dataless`) and unreadable. Margin was not modified.

Done:

- Scaffold: Margin's generic foundation (auth, Nexconn signer/client/token route, rate limits, request guard, env, CI), rebranded. Ports 5436/6381/3001. GitHub sign-in on the server (button lands with invites, Nov 12).
- Schema `0001_init`: Team, Membership, Invite, RepoLink, HookToken, Gate, Vote, Grant, CallSession (+ auth tables).
- Shared gate logic (also for the CLI bundle): presets and matcher (§5.3), redaction, quorum state machine, command hash, hook API schemas.
- Server: gate create (atomic TG-n, server re-redaction, authoritative quorum), poll, park, vote (row lock, one transaction), grants (single use, 24 h, bound to repo + cmdHash), hook tokens (sha256, repo-scoped, revocable), teams, invites (row-locked uses), team chat (lazy group), call permits (huddle, ring, budget, kill switch, sweeper).
- Nexconn: `TG:Gate` / `TG:Huddle` cards from the bot with metadata mirror; engine boots Call in the documented order; T6 lab at `/dev/nexconn`.
- Pages: landing, home (teams + create), invite accept.

Verified: format, lint, typecheck, 249 unit tests, 11 integration tests (real Postgres), production build. Live smoke against the dev server: hook create → poll → park → grant (none) with a real token; client quorum 1 raised to 2 for a prod migrate; DB password redacted; bad token and session-less vote get 401.

## CLI and hook (Nov 3)

`packages/cli` publishes as **`tollgate-cli`** (the npm name `tollgate` is taken); the binary is `tollgate`.

- `init --token --server`: checks the token (`GET /api/hook/whoami`), stores it in `~/.config/tollgate/tokens.json` (0600, keyed by repo root), writes `.tollgate.json` (committed: server, repo, presets) and registers the hook in `.claude/settings.local.json` (per developer, added to `.gitignore`).
- The hook runs on **every** Bash call, so `init` copies the esbuild bundle to `~/.config/tollgate/bin/` and registers `node …/tollgate.mjs hook`. That takes 51 ms for a non-risky command; `npx` would add about 1 s.
- `hook`:
  1. Matches presets, redacts locally (patterns plus `.env*` values) and adds context (newest migration SQL, last commit).
  2. Redeems a grant first, then raises the gate and polls every 1 s.
  3. Parks at timeout − 15 s. A watchdog denies at timeout − 5 s.
  4. Fails closed on errors or a missing token or config. `TOLLGATE_BYPASS=1` is audited to `audit.log`.
- `status`, `test` (gate for `echo tollgate-test`), `unlink`.

End-to-end check with a real Claude Code session (Haiku) against the dev server:

- TG-1 `npm publish --access public` was denied by a teammate 3 s later. The agent received the reason ("dry-run first"), followed it, and also spotted that `.env` would be published.
- TG-2 was its `--dry-run` attempt. Nobody answered, so it was parked at 45 s and the agent moved on.
- Fix from this run: presets now take `unless` patterns, and deploy, publish and infra skip `--dry-run`.

## Design system and team room (Nov 3)

UI stack, from a research pass (sources checked against npm and the shadcn changelog):

- shadcn on **Base UI** primitives (`base-nova`). shadcn made Base UI the default in July 2026. Its Drawer is native, so there's no dependency on the unmaintained `vaul`.
- shadcn **chat components**: `message-scroller`, `message`, `bubble`, `marker`. Plus `code-block` for commands.
- **Motion** 14.9 for card state changes.
- `radix-ui` removed.

Gate-state tokens (`--gate-{pending,approved,denied,parked}` with `-fg` and `-bg`) are in `app/globals.css`. Text and background pairs meet WCAG AA in both themes. Every state also has an icon and a word. Fonts: Geist and Geist Mono. There's a theme toggle and a system default.

The room (`/teams/[id]`) is the hero screen:

- The thread holds gate cards and chat lines, separated by day.
- Gate cards show: a status stripe, the PROD badge, the full wrapped command with a copy button, the redaction count, collapsible context, quorum dots, and voters.
- Deny opens a Base UI drawer. The reason is required, with quick-reason chips.
- Approve and deny buttons are 44 px.
- With Nexconn, the room is live: the group is joined lazily, history loads, and a `TG:*` message or metadata change triggers a refetch. Without Nexconn it polls every 4 s, so it works before keys are set.

Checked in headless Chrome at 375 px (light and dark) and 1280 px: no horizontal overflow; the deny drawer works.

- Fixed: dev magic links weren't visible, because pino output from route handlers doesn't reach `next dev` under Turbopack. They're now also printed with `console.warn` (development only).

## Settings and audit log (Nov 3)

- **Settings** (`/teams/[id]/settings`):
  - Link a repo: shows the full `npx tollgate-cli init --server … --token …` command once, with copy. Guard or Delegate; Delegate is owner only.
  - Linked repos, with active tokens shown by prefix only, who created each, last used, and revoke with a confirmation.
  - Invite links for teammates (approvers) or clients (guests), with a revoke option (`DELETE /api/teams/:id/invites/:inviteId`).
  - Members with their roles.
- **Audit log** (`/teams/[id]/audit`):
  - Metrics from PLAN.md §12: gates, median decision time, deny rate, rubber-stamp rate (approval within 3 s). They're computed in `features/gates/shared/metrics.ts`.
  - Status filters and search.
  - CSV export: RFC 4180, with spreadsheet formula injection neutralised.
  - A table on desktop and stacked rows on phones. Each row links back to the card in the room.

Checked in headless Chrome at 375 px (light and dark) and 1280 px: no horizontal overflow and no page errors.

## Call UI (Nov 3)

The Nexconn Call SDK in the room, behind `CALLS_ENABLED=1` and a live Nexconn connection. With either off, the Call SDK isn't even loaded.

- **"Talk it through"** on every open gate: _Huddle with the team_ (group audio) or _Ring <name>_ (1:1 audio to a voting member). When a huddle is live, the button becomes **Join huddle · n in**.
- **Flow:** server permit (`/api/gates/:id/{huddle,ring}`) → `startCall` with the gate and permit in `extra` → `/api/calls/:permit/joined` (the bot posts the `TG:Huddle` card) → on hang-up or end, `/api/calls/:permit/ended` with the duration.
- **Incoming-call sheet:** names the caller and the gate. If you're already in a call, it says answering will switch, because the SDK's `acceptCall` silently ends the current call.
- **Call bar:** timer, a "ends in" warning in the last minute, mute (`enableMicrophone`) and hang-up. The client ends the call at the permit's `maxSec`; the server sweeper is the backstop.
- **Not yet tested live:** this needs T7 (calling enabled at $0) and two devices on the real App Key.

## Decisions

- **One deny vetoes.** Anyone who knows why it's dangerous can stop it; approvals need quorum.
- **Who votes:** owner, approver, guest (clients). Requester-role members and the gate's own requester can't.
- **One open huddle per gate** is enforced by the gate's row lock in the permit transaction, not a partial unique index (Prisma's preview `partialIndexes` syntax for `IN` is unverified).
- **cmdHash = sha256([repo, cwd, command])** of the raw command, computed by the hook. No gateId (the retry doesn't know it); the grant row carries the gate. Grants are also scoped to the repo.
- **DATABASE_URL hosts stay visible**, only the password is redacted, so approvers see which database is targeted.
- Nexconn failures never fail a hook or vote request: cards and metadata are sent in `after()`; Postgres is the truth.
- Calls are counted at `maxSec` until they report a real duration (billing starts at create).

## Next

1. Nov 4: Kartik creates the Tollgate Nexconn app and fills `.env`; run T1, T2, T6 live, T7; deploy the skeleton on HTTPS; new GitHub repo.
2. Live test with the real Nexconn keys: team chat, gate cards over Nexconn, then a ring laptop → phone once T7 confirms $0.
3. T0 (c), for Kartik: in a scratch repo linked with `init`, run `claude --dangerously-skip-permissions` and ask it to run `npm publish`. Check that the gate still appears and a deny still blocks.
4. Call UI: huddle bar, Ring button, incoming-call sheet; permits are ready server-side.

## Local setup

```bash
cp .env.example .env            # then set AUTH_SECRET and the NEW Tollgate Nexconn keys
pnpm install
pnpm db:up                      # Postgres 5436, Redis 6381
pnpm db:deploy
pnpm dev                        # http://localhost:3001
TEST_DATABASE_URL=postgresql://tollgate:tollgate@localhost:5436/tollgate_test pnpm test:int
```
