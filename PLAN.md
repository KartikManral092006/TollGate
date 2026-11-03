# Tollgate: full project plan

> **Your team decides before your coding agent does something you can't undo.**
> Nexconn Build Challenge 2026 · Workplace & Collaboration track · solo build by Kartik Manral
> Plan written Nov 3, 2026 · Submission deadline **Nov 22, 23:59 AoE**

---

## 0. Context

Tollgate is a **second, separate project** for the **Workplace & Collaboration** track. **Margin continues unchanged** in Social & Community: same repo at `~/Desktop/Margin`, same Nexconn app, same plan.

Separation rules:

- Tollgate gets its own folder (`~/code/tollgate`), its own git repo, its own Nexconn app and App Key, its own database, its own deployment and its own PROGRESS.md.
- Nothing in Margin is modified. Generic code is **copied** from Margin into Tollgate (§6.3), never shared through a package, so neither project can break the other.

A 25-agent workflow (research, ideation, adversarial judging, synthesis) ranked five concepts:

| Concept      | Score (out of 50) |
| ------------ | ----------------- |
| **Tollgate** | **28.7**          |
| Sidecar      | 28.0              |
| Baton        | 28.0              |
| Shiftcast    | 25.7              |
| Quorum       | 25.3              |

Tollgate won on two counts: demo strength and fit to the official rubric weights. **Baton** is the designated fallback if Tollgate fails its Nov 7 go/no-go (§14).

Margin's foundation (auth, Nexconn signer, token route, rate limits, Redis locks, CI) was built Nov 1–2, inside the challenge window. Tollgate starts from a copy of it. **Both write-ups must disclose the shared foundation.**

**Two-project risk.** Two solo entries in 20 days roughly halves the time for each. Polish carries 50% of the rubric, and traction needs daily user work.

- Budget about 60% of your time for Tollgate and 40% for Margin, or the reverse. Decide by Nov 7, after Tollgate's go/no-go.
- Check that the rules allow one person to submit two projects (§18).

---

## 1. Challenge facts

Source: https://reskilll.com/hack/nexconn/, read from the page's JS bundle on Nov 2.

| Item             | Value                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Track text       | "Direct messaging and team project threads". Sample ideas: DMs for teams, project discussion threads, shift handover channel                                                                                       |
| Hard requirement | Must use the Nexconn **Chat SDK** (ChatUI counts). "The app must show real, measurable SDK usage." Projects without it are disqualified                                                                            |
| Rubric           | **50%** completeness & UX · **30%** innovation & scenario value · **20%** business & growth. Traction is "a significant bonus", counted as **active users on your Nexconn App Key**, plus screenshots and feedback |
| Submission       | (1) PDF write-up: problem, Nexconn-powered features, **App Key**; (2) public demo video; (3) live URL; (4) public GitHub repo; traction proof is optional                                                          |
| Prior work       | Allowed, but the write-up must say what existed before and what was built during the challenge                                                                                                                     |
| Team             | 1–4 people (solo is fine); the team leader picks the track                                                                                                                                                         |
| Dates            | Deadline Nov 22, 23:59 AoE · judging Nov 23–27 · results Dec 1                                                                                                                                                     |
| Prizes           | 5 overall: $2,000 / $1,250 / $750 / $500 / $500, plus 2 years of the Nexconn plan and cloud credits                                                                                                                |
| Support          | github.com/NexconnAI-Dev/hackathon · hackathon@nexconn.ai                                                                                                                                                          |

**What follows from the rubric:** a narrow, polished, working product beats a wide one. Every Nexconn feature should visibly power a moment in the product, and the demo and write-up should point to each one.

---

## 2. Problem

**Pain:** the only person who can stop a coding agent's irreversible action is whoever happens to be at the keyboard. The team knowledge that would stop it ("don't drop that column, finance reads it") sits with people who aren't watching. When an agent does something wrong, the discussion happens afterwards, in DMs.

**Evidence** (each item is labelled with how strong it is):

- **Stack Overflow Developer Survey 2025** (https://survey.stackoverflow.co/2025/ai): verified, large sample, self-reported.
  - Only **17.3%** agree that AI agents improved team collaboration; **42.2%** disagree.
  - **66%** cite output that is "almost right, but not quite".
  - **86.9%** are concerned about agent accuracy.
- **Agent PRs are accepted less often than human PRs.**
  - Claude Code 83.8% vs 91.0% for humans (arXiv 2509.14745).
  - Devin 61.6%, Codex 77.9%, Copilot 68.0% (arXiv 2602.08915).
  - The two studies filter differently, so the numbers can't be compared directly.
- **Replit's agent deleted a production database during a code freeze** (July 2025). Widely reported. **Find a primary source before citing it.**
- **Herbsleb & Mockus (IEEE TSE 2003):** distributed work took about 2.5x longer. This supports parked gates across timezones, but it is old data from one company.
- **Freelancer–client approval pain:** weak evidence (Usersnap survey only). Treat it as a hypothesis.

**What is not proven yet:** whether _teams_ want approval before an agent acts. The week-1 interviews (§11.1) test exactly that, with a kill rule.

---

## 3. Users

| Segment                                                                                                               | Why they care                                                                                          | How to reach them                                                    |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **Small remote teams (2–6)** running Claude Code with real credentials (staging/prod DB, deploy CLIs, publish tokens) | One person's agent can break a resource the whole team shares                                          | Claude Code / agentic-coding Discords, r/ClaudeAI, r/developersIndia |
| **OSS co-maintainers**                                                                                                | Publish and release actions affect every user of the package                                           | GitHub, project Discords                                             |
| **Freelancer + client pairs**                                                                                         | The client is the natural approver for "deploy to prod?" and today that approval happens over WhatsApp | Kartik's freelance contacts, r/freelance                             |
| **Campus and hackathon teams**                                                                                        | They are building right now and share staging databases                                                | Graphic Era clubs and PBL teams                                      |

**Not targeted:**

- Solo developers. Claude Code Remote Control and similar tools already cover them.
- Enterprises. They already pay for Slack and use Slack-based tools.

**Traction honesty:** expect **tens** of users, not hundreds.

---

## 4. Prior art and how Tollgate differs

Verify every row first-hand on Nov 3. These descriptions came from the workflow's judges and are not confirmed yet.

| Tool                                          | What it does                               | What Tollgate adds                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code Remote Control                    | The owner approves prompts remotely        | Multiple humans, a thread, deny-with-reason, parked grants                                                                                                                   |
| claude-remote-approver, Happier, Omnara       | Single-user mobile approval                | Same as above, plus client approvers                                                                                                                                         |
| claude-gate (Slack), AFKlaude (Slack/Discord) | Approval buttons in a chat you already use | No Slack seat needed; client approvers by magic link; parked grants across timezones; Guard-mode security; the conversation goes back to the agent                           |
| GitHub branch protection / Environments       | Server-side gates on git and CI            | Covers local agent side effects GitHub never sees (deploy CLIs, DB migrations, publish, cloud deletes). **Check what Environments' required reviewers cover on free plans.** |

Tollgate's differentiators:

1. **The conversation decides.** The deny reason becomes the agent's next instruction.
2. **Parked gates and single-use grants**, so approvals work across timezones.
3. **Non-developer approvers** through magic link.
4. **Guard mode by default**, with local redaction first.

The gap is narrow. The write-up says so plainly in a prior-art table.

---

## 5. Product

### 5.1 One-liner

Before your coding agent touches prod, a shared database, a package registry or cloud resources, it asks your team in a live thread. The team's conversation decides, the agent obeys the outcome, and approvals still work when nobody is awake.

### 5.2 Core concepts

| Term                                | Meaning                                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Team**                            | A group of people, with one Nexconn group channel (the thread space)                                                                                                        |
| **Repo link**                       | A repo connected to a team through a hashed, revocable hook token                                                                                                           |
| **Preset**                          | A risk rule: command pattern, environment label, and quorum _n_ (default 1 approver who isn't the requester; prod presets need 2)                                           |
| **Gate**                            | One proposed risky command. Shown as the `TG:Gate` card that anchors a thread                                                                                               |
| **Vote**                            | One decision per person per gate: approve or deny (with reason)                                                                                                             |
| **Park**                            | No decision in time. The agent gets "parked as TG-n" and carries on with other work                                                                                         |
| **Grant**                           | A parked gate approved later. Single use, bound to the command hash, expires after 24 h                                                                                     |
| **Guard mode** (default)            | Tollgate can only **deny or park**. After an approval, Claude Code's normal permission flow still runs                                                                      |
| **Delegate mode** (opt-in per repo) | The team's approval returns **allow** for that exact hashed command                                                                                                         |
| **Huddle**                          | A group audio call (Nexconn Call SDK) tied to one gate, started from its card. Logged as a `TG:Huddle` card in the thread and in the audit. Talking never decides; votes do |
| **Ring**                            | A 1:1 audio call from the requester to a named approver for an urgent gate. Logged the same way as a huddle                                                                 |

### 5.3 Default presets (shipped in `init`)

| Preset         | Example patterns                                                                         | Quorum                     |
| -------------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| prod-deploy    | `vercel --prod`, `fly deploy` (prod app), `railway up --environment production`          | 2                          |
| staging-deploy | `fly deploy -a *-staging`, `vercel` (preview with shared env)                            | 1                          |
| db-migrate     | `prisma migrate deploy`, `drizzle-kit push`, `psql … -c "DROP\|ALTER\|DELETE\|TRUNCATE"` | 1 (2 when the env is prod) |
| publish        | `npm publish`, `pnpm publish`, `cargo publish`, `twine upload`                           | 1                          |
| infra          | `terraform apply\|destroy`, `pulumi up\|destroy`, `aws … delete-*`, `gcloud … delete`    | 2                          |
| destructive-fs | `rm -rf` outside the repo root                                                           | 1                          |

Users can edit presets in `.tollgate.json`. The server is authoritative for quorum, so a local edit can't lower it.

### 5.4 User stories (MVP)

1. As a **requester**, I install Tollgate in one command, invite a teammate, and my agent's risky commands wait for the team.
2. As an **approver**, I get a push, open the card on my phone, see exactly what will run (redacted), ask "Why?", and approve or deny with a reason.
3. As a **requester**, when my teammate denies with a reason, my agent receives that reason and revises its plan without me retyping anything.
4. As a **requester in another timezone**, a gate nobody answers gets parked. My teammate approves it in their morning, I get a push, and the retry passes immediately.
5. As a **client**, I approve "deploy to prod" from a magic link. I don't install anything and I don't need a Slack seat.
6. As a **team**, we can open `/audit` and see who approved what, why, and when.
7. As a **judge**, I can press "Simulate agent" on the landing page and see the whole loop on my laptop and phone without installing anything.
8. As an **approver**, I tap **Huddle** on a prod card, talk it through with my teammates, and then vote.
9. As a **requester** with an urgent prod gate, I tap **Ring Ana** and her phone or laptop rings in the browser.
10. As a **teammate on desktop**, I DM another teammate about a gate without leaving Tollgate (ChatUI, only if spike T6 passes).

### 5.5 Explicitly out of scope

- ChatUI anywhere except desktop DMs. It doesn't support portrait mobile or render metadata, so the room and gate cards stay on the raw SDK. Desktop DMs use ChatUI only if spike T6 passes (§6.1).
- Video calls. Calls are audio only.
- Calls outside a gate (huddle, ring) or a DM context.
- Open channels and KV.
- Webhooks.
- Moderation.
- Agents other than Claude Code. Mark them as "planned".
- pgvector.
- Native apps.
- Translation, unless there is spare time.

---

## 6. Architecture

```
 Developer machine                         Tollgate server (Next.js 16, long-running container)
 ┌───────────────────────────┐            ┌───────────────────────────────────────────────┐
 │ Claude Code               │            │ /api/hook/gates   (Bearer hook token)          │
 │  └ PreToolUse hook (Bash) │──HTTPS───▶ │ /api/gates/:id/{vote,park,why}  (session)      │
 │     tollgate-hook (Node)  │◀─poll 1s── │ /api/teams, invites, audit, simulate           │
 │     • preset match        │            │ Postgres (source of truth)  Redis (locks, RL)  │
 │     • local redaction     │            │ Nexconn REST signer ──▶ bot sends TG:Gate,     │
 └───────────────────────────┘            │   sets metadata, system push, stream msgs      │
                                          └───────────────┬───────────────────────────────┘
                                                          │ Nexconn cloud
                                    ┌─────────────────────┴─────────────────────┐
                                    ▼                                           ▼
                           Laptop browser (React room,               Phone browser (same room,
                           raw @nexconn/chat SDK,                     375 px, push,
                           Call SDK audio, ChatUI DMs*)               Call SDK audio)
                                                       * only if spike T6 passes
```

**Rules:**

- **Postgres is the source of truth.** Nexconn message metadata is a live mirror for the UI. On reload, the client rebuilds card state from `GET /api/teams/:id/gates` if history doesn't return metadata.
- **Only the bot user sends `TG:*` messages, through the server API.** The bot never connects, so it doesn't count toward MAU. Bot messages are recognised by sender ID, never by display name (an existing Margin decision).
- **The hook never waits past its timeout.** It always returns an explicit decision; with no decision, it parks.
- **Hosting:** a long-running container with managed Postgres and Redis over TLS. No serverless, because of connections and polling (an existing Margin decision).
- **The server never creates calls.** The browser calls `startCall` only after the server returns a **call permit**. A permit checks membership, takes a per-gate Redis lock (one huddle per gate), checks the team's daily minute budget, and respects the `CALLS_ENABLED` kill switch.
- **The bot never joins calls.** It only posts and updates `TG:Huddle` cards.

### 6.1 Stack (inherited from Margin)

- Next.js 16.4 (App Router, Cache Components, `proxy.ts`), React 19.3, Tailwind 4, shadcn/ui
- Prisma 7.10.1 + Postgres 17, ioredis, pino
- Better Auth (magic link + Google; add GitHub), Resend email
- Nexconn packages, all browser-only and loaded through dynamic `import()`. The exact pins depend on spike T6 (§13):
  - **Peer-dependency facts (npm, Nov 3):**
    - `@nexconn/call@26.2.1` (latest) requires `chat` and `engine` at exactly **26.2.0**.
    - `chat@26.2.1` requires `engine =26.2.1`.
    - `chatui@26.2.5` requires `chat` and `engine` at `^26.2.1`.
    - Call and ChatUI therefore can't be installed together without forcing versions.
  - **If T6 passes:**
    - Packages: `engine` and `chat` at 26.2.1, plus `call` at 26.2.1 with npm `overrides` for its peers, plus `chatui` at 26.2.5 and `lit`.
    - ChatUI is used for desktop DMs only.
  - **If T6 fails:**
    - Packages: `engine` and `chat` at 26.2.0, plus `call` at 26.2.1. This is the clean install.
    - No ChatUI. DMs are built as our own raw-SDK view.
  - Record the outcome and the pins in PROGRESS.md.
- Vitest (unit + integration), GitHub Actions CI

### 6.2 Repo layout

Tollgate is created in its own folder and git repo. `~/code` keeps it out of iCloud, which evicted Margin's files in `~/Desktop` on Nov 2.

Nothing is shared at runtime with Margin:

| Resource                     | Margin                       | Tollgate                                                                                                                                                                        |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folder / git repo            | `~/Desktop/Margin`           | `~/code/tollgate` (new `git init`, new GitHub repo)                                                                                                                             |
| Nexconn app / App Key        | Existing app                 | **New app** in the Nexconn Console, so MAU and traction are counted separately and test users don't mix. Check that the free 10k-MAU offer applies to a second app and bills $0 |
| Local Postgres / Redis ports | 5435 / 6380                  | **5436 / 6381** (`compose.yaml` project name `tollgate`), so both run side by side                                                                                              |
| Dev server port              | 3000                         | **3001**                                                                                                                                                                        |
| Bot and test users           | devalice, devbob, marginbot  | tgalice, tgbob, tollgatebot                                                                                                                                                     |
| Email sender                 | `login@mail.joinmargin.tech` | A new domain or subdomain for Tollgate, with its own Resend sender                                                                                                              |
| Production URL / host        | joinmargin.tech              | A separate domain and container                                                                                                                                                 |
| `.env`                       | Margin's                     | A fresh `.env` and new secrets. **Never copy Margin's `.env` or App Secret**                                                                                                    |

```
~/code/tollgate/
  app/
    (marketing)/page.tsx         # landing + Simulate agent + QR
    (app)/teams/[id]/page.tsx    # the room (thread + gate cards)
    (app)/teams/[id]/audit/      # decision log
    (app)/teams/[id]/settings/   # members, presets, repo tokens
    (app)/teams/[id]/dm/         # desktop DMs (ChatUI if T6 passes, else raw SDK)
    invite/[token]/              # accept invite (guest approver path)
    api/hook/gates/route.ts      # POST create gate (Bearer hook token)
    api/hook/gates/[id]/route.ts # GET status (Bearer hook token)
    api/gates/[id]/{vote,park,why,huddle,ring}/route.ts
    api/calls/[id]/{joined,ended}/route.ts
    api/teams/…, api/invites/…, api/simulate/route.ts
    api/nexconn/token/route.ts   # reused
  features/
    auth/ email/ nexconn/        # reused / adapted
    teams/                       # Team, Membership, team-chat (from lectures/room-chat)
    gates/                       # gate service, quorum, grants, redaction (server copy)
    room/                        # React room components on raw SDK
    call/                        # call permits (server), Call engine boot, huddle bar, incoming-call sheet
    dm/                          # ChatUI mount or raw-SDK fallback (desktop)
  packages/cli/                  # `tollgate` npm package: init + hook binary
  lib/                           # env, db, redis, logger, ids, rate-limit, http (readJsonBody)
  prisma/schema.prisma
  tests/unit, tests/integration
  docs/nexconn.md, PROGRESS.md
```

### 6.3 What is copied from Margin (one-time copy, Margin untouched)

Copy the files below from `~/Desktop/Margin` into the new repo. Margin's files are only read, never moved or edited. After the copy the two codebases evolve independently. If a bug fix in a copied file matters to both, apply it to each repo by hand.

**Copy as-is:**

- `lib/{env.schema,env,env.client,db,redis,logger,ids,rate-limit,rate-limit.server,request-guard}.ts`
- `features/auth/**`: add the GitHub provider and update the route list
- `features/email/server/resend.ts`
- `proxy.ts`: update the matcher and protected paths
- `features/nexconn/server/{sign,client,errors,index,api,tokens}.ts`
- `features/nexconn/shared/{ids,codes,config,token-request}.ts`
- `app/api/nexconn/token/route.ts`
- `compose.yaml`, `docker/postgres/init`
- `.github/workflows/ci.yml`
- `docs/nexconn.md`
- The matching unit tests

**Adapt:**

- `features/nexconn/client/engine.ts` and `registrations.ts`:
  - Register `TG:Gate`, `TG:Huddle` and `TG:Recap` in one call. If ChatUI is used, ChatUI makes that call internally, so pass every `TG:*` type to it.
  - Boot order with Call: `NCCallEngine.install()` → `NCEngine.initialize` → `NCCallEngine.initialize({})` → `setCallEventHandler` (straight away, or `onCallReceived` never fires) → `NCEngine.connect`. Any call API used before `connect` succeeds fails with `80012`.
- `features/nexconn/shared/messages.ts`: keep the helpers, use the `TG:*` zod schemas.
- `features/lectures/server/room-chat.ts` and its Redis lock become `features/teams/server/team-chat.ts`: an idempotent, lazy group create and join, with a per-team lock and a per-user budget.
- `features/lectures/server/lectures.ts`: keep the race-safe find-or-create, join transaction and exact count patterns for Team.
- `features/lectures/server/http.ts` moves to `lib/http.ts` (`readJsonBody`, the 8 KB cap).
- The dev lab (`features/nexconn/dev/nexconn-lab.tsx`, `app/dev/nexconn`, `app/api/dev/nexconn`): use it for the Day-1 spikes.
- The integration concurrency tests: rewrite them for votes and grants.

**Not copied** (Margin-only):

- `features/lectures/shared/youtube.ts`, `features/lectures/server/{open,oembed}.ts`
- `app/open`
- `features/player/**`
- `app/(app)/lectures/**`, the lecture components
- The YouTube, oEmbed and lecture tests
- The Margin marketing copy
- Margin's PROGRESS.md (Tollgate starts its own)
- Margin's migrations: Tollgate starts with a fresh `0001_init`
- `.env`, `.next`, `node_modules`, `tsconfig.tsbuildinfo`, `lib/generated`

**Copy method.** Run `rsync` with an explicit include list of the files above, then `git init`. Never `cp -r` the whole Margin folder: that would drag along `.git`, `.env` and build output.

**Keep these Margin decisions:** Cache Components needs `await connection()`, secrets are required at call time, the App Key is delivered through the token route, Nexconn IDs are letters and digits only, group sends are never auto-retried, and `safeCallbackPath` checks every redirect.

---

## 7. Data model (Prisma, fresh migrations, auth tables kept)

```prisma
model Team {
  id            String   @id            // 32 alnum (lib/ids)
  name          String
  nexconnGroupId String? @unique        // created lazily
  createdById   String
  createdAt     DateTime @default(now())
  memberships   Membership[]
  repos         RepoLink[]
  gates         Gate[]
}

model Membership {
  teamId  String
  userId  String
  role    TeamRole   // owner | approver | requester | guest
  joinedAt DateTime @default(now())
  @@id([teamId, userId])
}

model RepoLink {
  id        String @id
  teamId    String
  name      String           // e.g. "acme/billing"
  mode      GateMode @default(guard)  // guard | delegate
  presets   Json             // server-authoritative preset list incl. quorum
  tokens    HookToken[]
}

model HookToken {
  id         String   @id
  repoId     String
  tokenHash  String   @unique        // sha256; plaintext shown once at init
  createdBy  String
  lastUsedAt DateTime?
  revokedAt  DateTime?
}

model Gate {
  id          String   @id
  code        Int                   // TG-17 (per team sequence)
  teamId      String
  repoId      String
  requesterId String
  preset      String
  env         String                // prod | staging | other
  command     String                // redacted
  cwd         String
  branch      String?
  context     String   @db.VarChar(2048) // redacted, truncated
  redactions  Int
  cmdHash     String                // sha256(command+cwd+repo+gateId)
  quorum      Int
  status      GateStatus @default(pending) // pending|approved|denied|parked|expired
  decidedAt   DateTime?
  denyReason  String?
  messageUid  String?               // Nexconn message for metadata updates
  createdAt   DateTime @default(now())
  votes       Vote[]
  grant       Grant?
  @@unique([teamId, code])
}

model Vote {
  gateId   String
  userId   String
  decision VoteDecision   // approve | deny
  reason   String?
  createdAt DateTime @default(now())
  @@id([gateId, userId])
}

model Grant {
  id        String   @id
  gateId    String   @unique
  cmdHash   String
  expiresAt DateTime            // +24 h
  usedAt    DateTime?           // single use
}

model CallSession {
  id           String   @id            // permit id; callId set once the call starts
  callId       String?  @unique         // Nexconn callId (= room id)
  teamId       String
  gateId       String?                  // set for huddle and ring
  kind         CallKind                 // huddle | ring
  startedById  String
  calleeIds    String[]
  status       CallStatus @default(permitted) // permitted | live | ended | failed
  maxSec       Int      @default(900)
  startedAt    DateTime?
  endedAt      DateTime?
  durationSec  Int?
  participants Json?                    // userIds that joined
  messageUid   String?                  // TG:Huddle card
  createdAt    DateTime @default(now())
}
```

**Invariants:**

- Each vote and its quorum evaluation happen in **one transaction**, with a row lock on the gate.
- Status moves only `pending → approved | denied | parked → (approved | expired)`.
- A grant is consumed with `UPDATE … WHERE usedAt IS NULL AND expiresAt > now()` and must report 1 row changed.
- The requester can't vote on their own gate.
- At most one `permitted` or `live` huddle per gate. This is enforced by a Redis lock plus a partial unique index on `gateId WHERE kind = huddle AND status IN (permitted, live)`.
- Call minutes per team per day are summed from `CallSession.durationSec`, with an open call counted at `maxSec`.

---

## 8. Interfaces

### 8.1 Claude Code hook contract

Verify all of this on Day 1. It is the riskiest unknown in the project.

Registration, written by `tollgate init` into `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "npx tollgate hook", "timeout": 300 }]
      }
    ]
  }
}
```

- **Input:** JSON on stdin, including `tool_name`, `tool_input.command`, `cwd`, `session_id`, `hook_event_name`.
- **Output to deny:**
  ```json
  {
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "Denied by Ana in TG-17: rename, don't drop; back up first."
    }
  }
  ```
- **Output with no match, or Guard-mode approval:** exit 0 with no decision, so Claude Code's normal flow runs.
- **Output in Delegate-mode approval:** `permissionDecision: "allow"`.

**Day-1 hook questions:**

- (a) Does the deny reason reach the model?
- (b) What are the default and maximum `timeout` values, and what happens when the hook times out?
- (c) Does PreToolUse fire in auto-accept and `--dangerously-skip-permissions` sessions?
- (d) PermissionRequest as an alternative event: when does it fire?

**Fallback** if the hook contract fails: a `tollgate run -- <cmd>` wrapper with parked gates only.

**Hook algorithm:**

1. Read stdin. If `tool_name ≠ Bash`, exit 0.
2. Load `.tollgate.json`, match the command against the presets, and exit 0 if nothing matches.
3. Redact locally: known secret formats, `KEY=value` env assignments, URLs with credentials, values from `.env*`. Count the redactions.
4. Build the context, at most 2 KB: for migrations, the pending SQL (truncated); for deploys, the target app or env.
5. If there is a local grant cache hit for `cmdHash`, exit 0, or allow in Delegate mode. The server re-checks the grant either way.
6. `POST /api/hook/gates`, which returns `{id, code, status}`.
7. Poll `GET /api/hook/gates/:id` every second until it is decided or `timeout − 15 s` has passed.
8. Approved: exit 0 in Guard mode, or allow in Delegate mode. Denied: deny with the reason. Undecided: `POST …/park`, then deny with "Parked as TG-n. Continue with other work; retry after approval."
9. If anything errors, **deny** (fail closed) with a clear message. A local `TOLLGATE_BYPASS=1` env var, which gets audited, exists as an emergency escape.

### 8.2 HTTP API

| Method & path                                                  | Auth                          | Purpose                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/hook/gates`                                         | Bearer hook token             | Create a gate. The server re-redacts, applies the authoritative preset and quorum, writes the row, the bot sends `TG:Gate` plus @mentions and push                                                                     |
| `GET /api/hook/gates/:id`                                      | Bearer hook token (same repo) | `{status, denyReason?, grantId?}`                                                                                                                                                                                      |
| `POST /api/hook/gates/:id/park`                                | Bearer hook token             | Mark the gate parked                                                                                                                                                                                                   |
| `POST /api/hook/grants/consume`                                | Bearer hook token             | `{cmdHash}`, then `{ok}`; single use                                                                                                                                                                                   |
| `POST /api/gates/:id/vote`                                     | Session + membership          | `{decision, reason?, quotedMessageUid?}`, then a quorum check in a transaction, then a metadata update                                                                                                                 |
| `POST /api/gates/:id/why`                                      | Session + membership          | Streams an LLM explanation into the thread (`RC:StreamMsg`); cached per gate                                                                                                                                           |
| `POST /api/gates/:id/huddle`                                   | Session + membership          | Returns a call permit `{permitId, calleeIds, maxSec}` (online approvers, excluding the caller). Checks the lock, budget and kill switch. If a huddle is already live, returns its `callId` so the client joins instead |
| `POST /api/gates/:id/ring`                                     | Session + membership          | `{userId}`. The callee must be a team member with approver rights. Rate limit: 3 per gate per hour. Returns a 1:1 permit. If the callee is offline, sends a system push (or email) instead                             |
| `POST /api/calls/:permitId/joined`                             | Session (permit owner)        | `{callId}`. Marks the call live. The bot posts a `TG:Huddle` card with metadata                                                                                                                                        |
| `POST /api/calls/:id/ended`                                    | Session (participant)         | `{participants, durationSec}`. Marks the call ended and updates the card's metadata. A sweeper ends calls with no update for more than `maxSec + 60 s`                                                                 |
| `POST /api/teams`                                              | Session                       | Create a team (owner)                                                                                                                                                                                                  |
| `POST /api/teams/:id/chat`                                     | Session + membership          | Idempotent Nexconn group ensure and join (adapted from Margin)                                                                                                                                                         |
| `POST /api/teams/:id/invites`                                  | Owner                         | Create an invite link (role approver or guest)                                                                                                                                                                         |
| `POST /api/invites/:token/accept`                              | Session (magic link)          | Join the team                                                                                                                                                                                                          |
| `POST /api/teams/:id/repos`, `…/tokens`, `DELETE …/tokens/:id` | Owner                         | Link a repo, mint a token (plaintext shown once), revoke                                                                                                                                                               |
| `GET /api/teams/:id/gates`                                     | Membership                    | Audit and state rebuild (paginated)                                                                                                                                                                                    |
| `POST /api/simulate`                                           | None (rate limited)           | Runs a scripted agent against a sandbox team through the same gate service                                                                                                                                             |
| `GET /api/nexconn/token`                                       | Session                       | Reused from Margin                                                                                                                                                                                                     |

Every route uses `readJsonBody` (the 8 KB cap), zod validation and Redis rate limits (per token, per user, per IP).

### 8.3 Nexconn messages and metadata

| Type                                | Sender                      | Content (zod)                                                                        | Metadata keys (≤ 32 characters each)                                                                                                                             |
| ----------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TG:Gate` (custom, `hasMetadata`)   | Bot, through the server API | `{gateId, code, preset, env, repo, branch, cmd, ctx, redactions, quorum, requester}` | `st` (pending/approved/denied/parked/expired), `q` ("1/2"), `v01…v09` ("userId:a" or "userId:d"), `seen` (CSV of user IDs), `exp` (grant expiry), `by` (decider) |
| `TG:Huddle` (custom, `hasMetadata`) | Bot, through the server API | `{callId, gateId, code, kind, startedBy}`                                            | `st` (live/ended), `n` (participant count), `dur` (seconds). The card's **Join** button calls `joinCall(callId)`                                                 |
| `TG:Recap` (custom, stretch)        | Bot                         | One message per agent run (Stop hook): gates raised and their outcomes               | —                                                                                                                                                                |
| Text reply with quote/reference     | User, through the SDK       | The deny reason or discussion; the quoted card links it to the gate                  | —                                                                                                                                                                |
| `RC:StreamMsg`                      | Bot, through the server API | The "Why?" explanation, labelled "explainer, not the agent"                          | —                                                                                                                                                                |
| System channel message + push       | Server                      | "TG-17 waiting on you", "TG-17 approved, retry now"                                  | —                                                                                                                                                                |

Metadata writes are **debounced** and always follow the Postgres commit. Clients subscribe to `onMessageMetadataUpdated`.

### 8.4 Nexconn feature → product moment (goes into the write-up)

| Feature                               | Moment                                          | Status (PROGRESS.md gates)    | Fallback                           |
| ------------------------------------- | ----------------------------------------------- | ----------------------------- | ---------------------------------- |
| Group channels                        | The team thread space                           | Create/join worked in the lab | —                                  |
| Custom message types                  | Gate cards                                      | **Verified** (G1/G2)          | —                                  |
| Message metadata                      | Live card state on every device                 | **Verified** (G3)             | Postgres rebuild                   |
| Server-API send as bot                | Cards without the bot counting toward MAU       | **Verified**                  | —                                  |
| Quote/reference reply                 | The deny reason becomes the agent's instruction | Untested                      | Plain reply carrying the gate code |
| @mentions                             | Route each gate to its approvers                | Untested                      | Name in the text, plus push        |
| Stream messages                       | "Why?"                                          | **G4 untested**               | One message                        |
| System messages + push                | "Waiting on you" / "approved"                   | Untested                      | Resend email (already built)       |
| Call SDK, 1:1 audio                   | **Ring an approver** on an urgent gate          | **T6/T7 untested**            | System push + email                |
| Call SDK, group audio                 | **Gate huddle** from the card                   | **T6/T7 untested**            | Discussion in the thread only      |
| Direct channels (+ ChatUI on desktop) | DMs between teammates                           | **T6 untested**               | Our own raw-SDK DM view            |
| History query                         | Load past threads                               | Untested in production        | Postgres audit                     |
| Read receipts (stretch)               | "Seen by"                                       | Untested                      | `seen` metadata                    |
| Online status (stretch)               | "Who can approve now"                           | Untested, cap unknown         | Heartbeat last-seen                |
| Translation (stretch)                 | Client reads the card in their own language     | **Verified** (G5)             | Cut                                |

### 8.5 CLI (`packages/cli`, published as `tollgate`)

- `npx tollgate init`:
  1. Asks for the server URL, defaulting to production.
  2. Opens a browser for sign-in, then picks or creates a team.
  3. Links the repo, mints a token, and stores it in the OS keychain if available. Otherwise it uses `~/.config/tollgate/tokens.json` with permissions 0600, keyed by repo. **Never store it in the repo.**
  4. Writes the hook into `.claude/settings.json`, writes `.tollgate.json` (presets), and prints invite links.
- `npx tollgate hook`: the hook binary (§8.1).
- `npx tollgate status` / `revoke` / `test`.
  - `test` fires a harmless sample gate (`echo tollgate-test`, matched by a test preset) to check the setup end to end.

---

## 9. Security model

| Threat                                                                     | Mitigation                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secrets leaking into chat                                                  | Redact locally before sending, redact again on the server, cap context at 2 KB, show the redaction count on the card, document "What leaves your machine" in the README, and unit-test the redaction corpus                                                                                                                                                        |
| Stolen hook token                                                          | Store only the sha256, scope it to one repo, make it revocable, rate-limit it, and show last-used. A token can only _create_ gates and read its own repo's gates; it can never vote                                                                                                                                                                                |
| Forged approval                                                            | Votes need a session plus membership. The requester can't approve their own gate. Quorum is counted in a transaction. The server's presets are authoritative                                                                                                                                                                                                       |
| Replayed approval                                                          | A grant is bound to `cmdHash`, single use, and expires after 24 h. The hash includes cwd, repo and gateId                                                                                                                                                                                                                                                          |
| Tollgate as a remote shell                                                 | Guard mode is the default: it only denies or parks, and Claude Code's normal permission flow still runs. Delegate mode is opt-in per repo, owner only, and shown in the UI                                                                                                                                                                                         |
| Server down blocks all work                                                | Fail closed by default, plus an audited `TOLLGATE_BYPASS=1` escape for emergencies                                                                                                                                                                                                                                                                                 |
| Rubber-stamping                                                            | Narrow presets, scoped grants (stretch), and a published rubber-stamp metric (approval in under 3 s)                                                                                                                                                                                                                                                               |
| LLM prompt injection through the command or context                        | "Why?" only explains and never decides. Its output is labelled. It gets only redacted context, and output is length-capped                                                                                                                                                                                                                                         |
| Abuse of the Simulate endpoint                                             | IP rate limit, a sandbox team, and no real Nexconn users created per visitor                                                                                                                                                                                                                                                                                       |
| Call abuse or a surprise call bill (billing starts when a call is created) | Every call needs a server permit, and callees must be team members. Other controls: a per-team daily minute cap (env), `maxSec` 900 with the client calling `endCall` and the sweeper as a backstop, audio only, the mic requested only on click, and a global `CALLS_ENABLED` kill switch. Simulate mode never places real calls; it shows a scripted huddle card |
| Silent call takeover (`acceptCall` while in a call ends the current one)   | If the user is already in a call, the incoming-call sheet asks them to confirm before accepting                                                                                                                                                                                                                                                                    |
| Margin issues that still apply                                             | Open redirects (`safeCallbackPath`), CSRF (same-origin checks), body caps, set `AUTH_IP_HEADER` on the host                                                                                                                                                                                                                                                        |

---

## 10. UI and screens

Mobile-first at 375 px with no horizontal scroll. Built on the raw SDK. ChatUI appears only in desktop DMs, and only if T6 passes.

1. **Landing** (`/`): headline, a 20-second looping clip, a **Simulate agent** button, a QR code to open the simulated room on a phone, the install command, and a "What leaves your machine" link.
2. **Room** (`/teams/[id]`) is the hero screen. The video's first frame and the app's first screen are this view, so judges see a communication app first.
   - Thread list (gate cards and discussion), newest at the bottom.
   - **Gate card:**
     - Code and environment badge (PROD in red)
     - Command (monospace, redacted), the context snippet in a collapsible section
     - Quorum progress, "seen by" avatars
     - Buttons: **Approve**, **Deny…** (opens the composer quoting the card), **Why?**, **Park**, **Huddle**
     - On urgent or prod gates, approver avatars get a **Ring** button
     - Live colour changes: pending (amber), approved (green), denied (red), parked (grey)
   - Huddle bar: pinned above the composer while a huddle is live, with participants, a timer, mute and leave.
   - Incoming-call sheet: Accept / Decline at 375 px, naming the gate ("Kartik is ringing you about TG-18").
   - Composer: quote reply, @mentions.
3. **Audit** (`/teams/[id]/audit`): a filterable table of gates, decisions, reasons, deciders and timestamps. Export as CSV.
4. **Settings:** members and roles, invite links (approver or guest), linked repos, tokens (create/revoke, last used), mode (Guard/Delegate), presets.
5. **DMs** (`/teams/[id]/dm`, desktop): direct channels with teammates. ChatUI is used if T6 passes, otherwise our own raw-SDK view. On phones, use the raw-SDK view or hide the DM link.
6. **Invite accept:** magic-link sign-in, then straight into the room. A guest sees only that team.
7. **Empty states and errors:** mic permission denied (show how to allow it; ring falls back to push), calls disabled (hide Huddle/Ring), no gates yet (prompt to run `npx tollgate test`), Nexconn unavailable (the UI keeps working from Postgres, read-only), expired invite.

---

## 11. Go-to-market and traction

### 11.1 Validation interviews (Nov 3–7): 8 people, 15 minutes each

Recruit from r/ClaudeAI, Claude Code and agentic-coding Discords, r/developersIndia, Graphic Era teams, freelance contacts, and other Nexconn entrants (only if the rules allow).

Script:

1. "Do you run Claude Code (or another agent) on a project other people depend on? What credentials can it reach?"
2. "Has an agent, or a teammate's script, ever done something you wish someone had vetoed? Walk me through it."
3. "Who on your team would have caught it?"
4. "Would you wait about 2 minutes for a teammate to approve a prod deploy or migration? What about overnight?"
5. "For freelancers: how does your client approve deploys today?"
6. "Can I install it with you next week?" (This is the commitment signal.)

**Kill rule (Nov 7):** fewer than 3 people with a concrete incident who _also_ agree to try it means pivoting to Baton (§14).

### 11.2 Launch sequence

| When                      | Action                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nov 12–16 (private alpha) | Install with 5 design-partner teams (≥ 2 people each) plus 2–3 freelancer–client pairs over screen share. Talk daily and fix what they hit within 24 h. Every install invites an approver |
| Nov 17–18 (public)        | Show HN, r/ClaudeAI, dev.to write-up, X and LinkedIn with a 20-second clip ("my teammate's phone stopped my agent dropping a column")                                                     |
| Nov 21 (Sat)              | r/webdev Showoff Saturday, r/developersIndia                                                                                                                                              |
| Nov 17 / 20 / 22          | Console MAU screenshots and an in-app feedback form. Collect testimonials                                                                                                                 |
| Nov 23–27                 | Keep the URL stable and keep onboarding. Make no risky deploys                                                                                                                            |

Read each community's self-promotion rules first and always say you built the tool.

### 11.3 Business viability (for the 20% criterion)

- **Free:** 1 team, 3 approvers, 30-day audit.
- **Team** (about $5 per approver per month): unlimited audit, scoped grants, Slack/Discord notification forwarding, SSO later.
- **Agency** (freelancers): unlimited client guest approvers.

Expansion path: Cursor, Codex CLI and Gemini CLI hooks, then CI and human `tollgate run`.

The pricing is illustrative. State it as a hypothesis, not as validated.

---

## 12. Success metrics (targets by Nov 22)

| Metric                                                                | Target             |
| --------------------------------------------------------------------- | ------------------ |
| Real connected users (Console MAU minus devalice, devbob and the bot) | ≥ 40 (stretch 100) |
| Active teams (≥ 2 people, gates on ≥ 3 different days)                | ≥ 6                |
| Real gates raised                                                     | ≥ 150              |
| Median time to decision while an approver is online                   | ≤ 2 min            |
| Gates denied or modified                                              | 5–30%              |
| Rubber-stamp rate (approval in under 3 s)                             | ≤ 30%              |
| Parked gates resolved within 12 h                                     | ≥ 70%              |
| Installs whose second person connects within 48 h                     | ≥ 40%              |
| Written testimonials                                                  | ≥ 5                |

These targets are my own estimates, not benchmarks. Instrument them in Postgres from day one, as `GateEvent` rows or derived queries.

---

## 13. Schedule (solo, riskiest first)

### Week 1: kill checks, foundation, validation

| Date            | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Done when                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Mon Nov 3**   | Kill checks: (1) hook spike (§8.1 questions a–d), in a scratch folder; (2) G4 stream render, using a scratch page against the new Tollgate Nexconn app (Margin's dev lab is only read for reference); (3) `createMessagesQuery` returns metadata?; (4) the second Nexconn app bills $0; (5) first-hand prior-art check; (6) ask the organisers whether two entries per person are allowed; (7) **T6 package spike:** in a scratch folder, install chat and engine 26.2.1 + call 26.2.1 (with `overrides`) + chatui 26.2.5. T6 passes only if a ChatUI DM renders **and** a 1:1 audio call connects laptop → phone; (8) **T7 call billing:** activate Call in the Console and confirm $0 and the free minutes; also check whether the REST API has any call-log or kick endpoint. Start recruiting interviewees | Results recorded as gates T0–T7 in Tollgate's own PROGRESS.md                                                       |
| Tue Nov 4       | Create `~/code/tollgate` and `git init`. Copy the generic files from Margin (§6.3). Pin the Nexconn packages from the T6 result (§6.1). Set ports 5436/6381/3001. Create the new Nexconn app and a fresh `.env`. Push to a new GitHub repo. Deploy the skeleton on HTTPS. Measure the delay from metadata write to update on a real phone, and test `getUserMedia` on that phone (iOS Safari). **Margin is not touched**                                                                                                                                                                                                                                                                                                                                                                                       | Tollgate's health check is green locally and in production. CI is green. Margin still runs on 3000 at the same time |
| Wed Nov 5       | Prisma models (§7), HookToken mint/hash/revoke, `POST/GET /api/hook/gates`. Choose the LLM provider and spending cap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Unit tests pass                                                                                                     |
| Thu Nov 6       | Bot sends `TG:Gate` with metadata. Vote route with a transactional quorum. Metadata mirror                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Integration test: concurrent votes count quorum once                                                                |
| Fri Nov 7       | CLI `init` and `hook`: matching, redaction, polling, deny before timeout, park. **Go/no-go** on interviews and the hook spike                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | A real Claude Code session raises a gate and gets a deny reason                                                     |
| Sat–Sun Nov 8–9 | Room UI v1: thread, cards with live state, composer, history                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Works at 375 px                                                                                                     |

### Week 2: finish the core loop and put it in real hands

| Date              | Work                                                                                                                                                                                                          | Done when                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Mon Nov 10        | Deny with reason (quote reply goes back to the agent), @mentions                                                                                                                                              | The agent revises from the reply text                                                                           |
| Tue Nov 11        | "Why?" stream (or the single-message fallback), system push (or the email fallback). **Ring:** call permits, the 1:1 audio call, the incoming-call sheet, and `CallSession` logging                           | Both devices update together. Laptop rings phone, and the call shows in the thread                              |
| Wed Nov 12        | Invites, guest approvers through magic link, GitHub sign-in. **Alpha goes to design partners**                                                                                                                | First outside team installed                                                                                    |
| Thu Nov 13        | Parked gates, grants (single use, 24 h), push on approval                                                                                                                                                     | The re-run passes on the grant; replay is rejected                                                              |
| Fri Nov 14        | **Huddle:** the group audio call from the card, the `TG:Huddle` card with live metadata, the huddle bar, and the sweeper. Simulate agent, QR. Delegate mode only if there is time (it is now on the cut list) | Three people in one huddle with the card live on every device. A judge's path works without installing anything |
| Sat–Sun Nov 15–16 | Fix what partners hit, `/audit` (including calls), metrics queries, settings page. Desktop DMs (ChatUI if T6 passed)                                                                                          | **≥ 3 real teams have used it**                                                                                 |

### Week 3: polish, launch, submit

| Date              | Work                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Mon–Tue Nov 17–18 | Public launch posts. Security pass: token scope, replay, redaction corpus, rate limits, `AUTH_IP_HEADER`                         |
| Wed Nov 19        | **Feature freeze.** Only bugs and UX after this. Stretch goals only if everything is green (read receipts, Recap, scoped grants) |
| Thu Nov 20        | Record the demo video in several takes on the live deployment (§15)                                                              |
| Fri Nov 21        | PDF write-up (§16), README, MAU screenshots, Showoff Saturday post                                                               |
| **Sat Nov 22**    | Buffer. Tag the submission commit. Submit all 4 items before 23:59 AoE                                                           |
| Nov 23–27         | Stable deployment, support users, no risky changes                                                                               |

---

## 14. Risks and fallback

| Risk                                                                         | Likelihood     | Mitigation                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demand isn't there                                                           | Medium         | Nov 7 kill rule, then pivot to Baton                                                                                                                                                                                        |
| The hook contract doesn't support long waits or deny reasons                 | Medium         | Day-1 spike. Fallback: the `tollgate run --` wrapper with parked gates only                                                                                                                                                 |
| G4 streams, push or @mentions fail                                           | Medium         | A fallback for each in §8.4. Decide by Nov 4                                                                                                                                                                                |
| A vendor ships multi-person approval                                         | Low–medium     | Lead with client approvers, parked grants and the decision record. Keep the prior-art table current                                                                                                                         |
| Security incident                                                            | Low            | §9. Guard mode by default, fail closed                                                                                                                                                                                      |
| LLM cost or privacy                                                          | Low            | Haiku-class model, cache answers, monthly cap, redacted input, "Why?" opt-in per team                                                                                                                                       |
| Nexconn plan bills money                                                     | Low            | Check the Console shows $0 before onboarding anyone                                                                                                                                                                         |
| Judges read it as a dev tool                                                 | Medium         | The thread is the first screen and the first video frame. Pitch it as "team threads where humans and agents negotiate risky work"                                                                                           |
| Too much scope for one person                                                | High           | Cut list: translation → online status → read receipts → Recap → ChatUI DMs → Delegate mode → Huddle. The core loop and Ring are never cut                                                                                   |
| Call and ChatUI peer conflict                                                | Known          | T6 spike. If the overrides break anything, drop ChatUI and pin engine and chat to 26.2.0 with call 26.2.1                                                                                                                   |
| Call costs money                                                             | Medium         | T7 before any real call. Server permits, a per-team minute cap, `maxSec`, and the `CALLS_ENABLED` kill switch                                                                                                               |
| WebRTC or `getUserMedia` unreliable on iOS Safari                            | Medium         | Test on a real phone on Nov 4. Ring falls back to system push. Huddles fall back to the thread                                                                                                                              |
| One call per user (`80002`), and `acceptCall` silently ends the current call | Known          | Confirm before accepting while in a call. Show "in a call" on avatars                                                                                                                                                       |
| iCloud evicting files                                                        | Happened Nov 2 | The new repo lives in `~/code`                                                                                                                                                                                              |
| Two projects split the solo time                                             | High           | Decide the time split on Nov 7. Each project gets its own feature freeze and submission checklist. If one is behind on Nov 17, put the remaining days into the stronger entry rather than submitting two half-finished ones |
| The rules forbid two entries per person                                      | Unknown        | Ask hackathon@nexconn.ai or the GitHub issues on Nov 3                                                                                                                                                                      |

**Baton fallback:** if Tollgate fails on Nov 7, switch to Baton on the same infrastructure (team rooms, server-sent custom cards with a metadata state machine, push).

- Unresolved asks become `BT:Loop` cards that the next timezone must **catch, bounce or drop**.
- Uncaught loops escalate once at their deadline.
- Recruit **pairs** (freelancer + client, or maintainers on different continents) rather than whole teams.
- Pull loops in from GitHub review requests.
- Lead with "seen is not caught."
- Everything before the Nov 7 checkpoint (repo, auth, rooms, card and metadata plumbing) carries over unchanged.

---

## 15. Demo video script (60–90 s, real latency, any time skip labelled)

| Time    | Shot                                                                                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–5 s   | Title: "Your agent is about to touch staging. Who decides?" Three panes: terminal, laptop browser, phone                                                                                                                                                        |
| 5–15 s  | In the terminal, the prompt "apply the billing migration to staging". The agent runs `npx prisma migrate deploy`, and the terminal shows `Tollgate: waiting on team · TG-17 (0/1)`                                                                              |
| 15–25 s | The card appears on the laptop and the phone at the same moment: staging (shared DB), `DROP COLUMN invoices.legacy_total`, "1 secret redacted", "seen by" filling in                                                                                            |
| 25–35 s | The teammate taps **Why?** on the phone and the explanation streams in on both screens                                                                                                                                                                          |
| 35–45 s | The teammate replies, quoting the card: "Deny. Rename, don't drop, and back up first." The card turns red on every screen. The agent receives the reason and rewrites the migration. TG-18 is approved and the terminal continues                               |
| 45–55 s | The agent attempts `fly deploy` to prod (quorum 2, one approval in). Kartik taps **Ring Ana**. Ana's phone rings, they talk for about 10 s (the `TG:Huddle` card shows the call live), then she approves on the card. It turns green and the terminal continues |
| 55–65 s | Labelled time skip: at 23:40 IST the agent attempts `vercel --prod`, and with nobody online the gate is **parked**. At 09:05 Berlin time, the client approves from their phone. Kartik's phone shows a push, and the re-run passes instantly on the grant       |
| 65–75 s | The audit log (with the call row), then a caption: "Nexconn: custom messages · live metadata · streams · system push · voice calls"                                                                                                                             |
| 75–90 s | Traction: real teams, gate count, a testimonial quote, the MAU screenshot                                                                                                                                                                                       |

---

## 16. Write-up outline (PDF)

1. Problem and evidence (§2), with honest strength labels
2. Who it's for (§3)
3. How it works: architecture diagram and core loop
4. **Nexconn feature → product moment table** (§8.4) and the **App Key**. This covers the Chat SDK (cards, metadata, streams, push, DMs), the Call SDK (ring and huddle) and, if T6 passed, ChatUI
5. Security model summary (§9)
6. Prior art and differentiation (§4)
7. Traction: users, teams, gates, decision times, testimonials, screenshots (with sample sizes)
8. Business model (§11.3)
9. **Prior-work disclosure:** the generic foundation (auth, Nexconn signer and token route, rate limits, CI) was first built Nov 1–2 for Kartik's other entry, Margin, inside the window, and copied into Tollgate. Everything Tollgate-specific was built Nov 3–22. Margin's write-up mentions the same shared foundation
10. Roadmap: other agents, CI and human `run`, Slack/Discord forwarding

---

## 17. Verification

- **Unit tests (Vitest):**
  - Preset matcher (table-driven)
  - Redaction corpus (AWS keys, GitHub tokens, JWTs, `postgres://user:pass@`, `KEY=value`, `.env` paths)
  - `cmdHash` binding
  - The quorum state machine (all transitions, requester can't vote)
  - Grant single use and expiry
  - Hook-token hashing and scope
  - Hook decision logic (deny before timeout, fail closed, bypass)
  - zod schemas for `TG:*`
  - Call permit rules: non-member, callee not an approver, budget exhausted, kill switch off, an existing live huddle returns its `callId`
- **Integration tests (`pnpm test:int`, real Postgres):**
  - 10 concurrent votes reach quorum exactly once
  - A grant consumed twice gives one success
  - A non-member vote gets 403
  - A token from repo A reading a gate from repo B gets 404
  - Parked, then approved, then grant consumed
  - 10 concurrent huddle requests on one gate give exactly one permit
- **Live end-to-end** on a sandbox repo with a real Claude Code session:
  - A migration raises a gate.
  - The card appears on the laptop and on a phone at 375 px.
  - Deny with reason makes the agent revise.
  - Approve continues.
  - Park, then approve later, then the re-run passes.
  - Delegate mode allows.
  - Simulate agent works signed out.
  - A Nexconn outage leaves the UI read-only.
  - Ring connects laptop → phone at 375 px.
  - A 3-person huddle shows a live `TG:Huddle` card on every device.
  - A call auto-ends at `maxSec`.
  - Call duration and participants appear in `/audit`.
  - `CALLS_ENABLED=false` hides Huddle and Ring.
  - Accepting while in a call asks for confirmation.
  - Desktop DMs work (ChatUI if T6 passed).
- **CI:** format, lint, typecheck, unit and integration tests, Prisma drift check, build without secrets, client-bundle secret scan. All inherited from Margin.
- **Each day:** update PROGRESS.md with gate results, decisions and open issues, as Margin does.

---

## 18. Open questions (answer by Nov 7)

1. Who are the 5 design-partner teams, by name?
2. Which irreversible action do your users actually fear most? Lead the demo with that.
3. Which LLM provider for "Why?", and what is the monthly spending cap?
4. **Can one person submit two projects (Margin in Social & Community, Tollgate in Workplace)?** Can each have its own App Key? Ask on Nov 3 through hackathon@nexconn.ai or github.com/NexconnAI-Dev/hackathon.
5. Does the free 10k-MAU Nexconn offer cover a second app at $0?
6. What is the time split between Margin and Tollgate after Nov 7?
7. What evidence would convince you Tollgate is the wrong idea? Write it down before the interviews.
8. What does Call cost on the Tollgate app? Are the challenge's free minutes a one-off allowance or monthly, and is there a plan fee? (T7)
9. Does Nexconn have a server-side Call API (call logs, force end)? If not, the time cap relies on the client plus the sweeper.
10. Does PreToolUse's `timeout` (§8.1 b) leave enough time for a Ring → talk → vote cycle on a prod gate, or does that gate usually end up parked?
