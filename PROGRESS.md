# Tollgate progress

Plan: [PLAN.md](PLAN.md). Deadline Nov 22, 23:59 AoE.

## Gates (kill checks, Nov 3)

| Gate | Check                                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T0   | Claude Code hook spike (§8.1 a–d)                       | **Passes, with one hard rule.** (a) The deny reason reaches the model verbatim. "allow" runs a command with no pre-approval (Delegate mode works). The hook fires even when Bash is pre-allowed. (b) **On timeout Claude Code runs the command (fails open)**, so the hook must always answer first: it parks at timeout − 15 s, plus a watchdog. (c) bypassPermissions: not run (the classifier blocks nested bypass sessions); **Kartik to run**, see Next. (d) PermissionRequest: see the docs note below |
| T1   | G4 stream render                                        | **Open.** Needs the new Nexconn app                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| T2   | `createMessagesQuery` returns metadata?                 | **Open.** Needs the new Nexconn app                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| T3   | Second Nexconn app bills $0                             | **Open (Kartik).** Console > Billing                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T4   | First-hand prior-art check                              | **Open (Kartik)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T5   | Two entries per person allowed?                         | **Open (Kartik).** hackathon@nexconn.ai                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T6   | Call + ChatUI in one engine                             | **Install half passes.** With pnpm `overrides`, call 26.2.1 resolves to the single chat/engine 26.2.1 copy, and everything call imports (`__install__`, 6 engine enums) exists in 26.2.1. **Live half open:** run `/dev/nexconn` as tgalice + tgbob (after T7)                                                                                                                                                                                                                                               |
| T7   | Call subscription is $0 / free minutes; server Call API | **Open (Kartik).** Console > Call > Call Subscription. Until then `CALLS_ENABLED=0`                                                                                                                                                                                                                                                                                                                                                                                                                          |

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
2. Room UI (`/teams/[id]`): thread, gate cards with live metadata, vote/deny composer, 375 px.
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
