# Tollgate progress

Plan: [PLAN.md](PLAN.md). Deadline Nov 22, 23:59 AoE.

## Gates (kill checks, Nov 3)

| Gate | Check                                                   | Result                                                                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0   | Claude Code hook spike (§8.1 a–d)                       | **Open.** Needs a real Claude Code session in a scratch repo                                                                                                                                                                                                   |
| T1   | G4 stream render                                        | **Open.** Needs the new Nexconn app                                                                                                                                                                                                                            |
| T2   | `createMessagesQuery` returns metadata?                 | **Open.** Needs the new Nexconn app                                                                                                                                                                                                                            |
| T3   | Second Nexconn app bills $0                             | **Open (Kartik).** Console > Billing                                                                                                                                                                                                                           |
| T4   | First-hand prior-art check                              | **Open (Kartik)**                                                                                                                                                                                                                                              |
| T5   | Two entries per person allowed?                         | **Open (Kartik).** hackathon@nexconn.ai                                                                                                                                                                                                                        |
| T6   | Call + ChatUI in one engine                             | **Install half passes.** With pnpm `overrides`, call 26.2.1 resolves to the single chat/engine 26.2.1 copy, and everything call imports (`__install__`, 6 engine enums) exists in 26.2.1. **Live half open:** run `/dev/nexconn` as tgalice + tgbob (after T7) |
| T7   | Call subscription is $0 / free minutes; server Call API | **Open (Kartik).** Console > Call > Call Subscription. Until then `CALLS_ENABLED=0`                                                                                                                                                                            |

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
3. CLI `packages/cli`: `init` (link repo, token in keychain/0600 file, write hook + `.tollgate.json`) and `hook` (match, redact, poll, park, fail closed, `TOLLGATE_BYPASS`). Needs T0 first.
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
