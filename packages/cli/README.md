# tollgate-cli

Your team approves before your coding agent does something you can't undo.

`tollgate-cli` installs a [Claude Code](https://claude.com/claude-code) `PreToolUse` hook. When the agent is about to run a risky shell command (a prod deploy, a database migration, `npm publish`, `terraform apply`, an `rm -rf` outside the repo), the hook posts it to your team's Tollgate room and waits:

- **Approved:** the command continues, through Claude Code's normal permission check (Guard mode, the default).
- **Denied with a reason:** the agent receives the reason as its next instruction and revises its plan.
- **A teammate asks a question:** the agent receives it and answers in the description of its next try; the team sees that answer on the new card and decides then.
- **Nobody answers in time:** the gate is **parked** and approvers who haven't voted get a reminder (and one more an hour later). The agent moves on, and once a teammate approves, the exact same command passes on retry (single use, 24 h).

Every other command runs untouched; the hook adds about 50 ms.

It also gates what an agent could do instead of running the command:

- **File edits** to Tollgate's own setup (`.claude/settings*.json`, `.tollgate.json`, the token), deploy and CI files (`.github/workflows/`, `.gitlab-ci.yml`, `vercel`/`netlify`/`fly`/`railway` config) and `.env` files. The card shows the change; `.env` values are hidden.
- **MCP tools** whose names delete, deploy, publish, merge, refund, charge, transfer or run SQL (`mcp__github__merge_pull_request`, `mcp__supabase__execute_sql`).

An approval covers that exact edit or call only. Custom presets take `"tool": "edit"` or `"tool": "mcp"`; edit patterns match `edit <path>` (`write <path>` for a new file), MCP patterns match `mcp__server__tool {json arguments}`.

## Set up

1. In your team's Tollgate room, open **Settings › Repos › Link a repo** and copy the command it shows.
2. Run it in the repo:

   ```bash
   npx -y tollgate-cli@latest init --server https://your-tollgate.example --token tg_…
   ```

3. Restart Claude Code in the repo, then check the whole loop:

   ```bash
   npx -y tollgate-cli test
   ```

`init` writes:

| File                          | Commit it?                                                       |
| ----------------------------- | ---------------------------------------------------------------- |
| `.tollgate.json`              | Yes: server, repo and presets, shared by the team                |
| `.claude/settings.local.json` | No (added to `.gitignore`): your personal hook registration      |
| `~/.config/tollgate/`         | Never in a repo: your token (file mode 0600) and the hook bundle |

## What the hook can see through

Agents rarely type the risky command itself. The hook looks at what a command really runs:

- **Package scripts:** `pnpm db:deploy`, `npm run release`, `yarn deploy`, `bun run x` are looked up in the nearest `package.json` (with `pre`/`post` scripts and scripts that call other scripts), so the card shows _pnpm db:deploy → prisma migrate deploy_ with the migration SQL.
- **Lists and wrappers:** every part of `a && b; c | d` is checked on its own, so `npm publish && echo --dry-run` is still a publish. Prefixes like `VAR=x`, `env`, `sudo`, `npx`, `pnpm exec`, `dotenv --` and literal `bash -c '…'`, `eval '…'`, `( … )` and `$( … )` are looked inside.
- **Code nobody can read first:** `curl … | sh`, `base64 -d | sh`, `bash <(curl …)` and commands built from a variable (`eval "$CMD"`) are gated as _opaque_.

Tollgate is not a shell parser and not a sandbox. It does **not** read Makefiles (`make deploy`), shell files (`./deploy.sh`), npm lifecycle scripts like `prepublishOnly`, or workspace scripts selected with `--filter`. It guards against an agent's mistakes, not against someone determined to get around it on their own machine.

## What leaves your machine

Only for commands that match a preset: the command and working directory after **local redaction** (known token formats, `KEY=value` secrets, passwords in URLs, secret flags, and every value from your `.env*` files), Claude Code's one-line description of the command (shown to approvers as the agent's reason), your git branch, the last commit subject, and for migrations the newest migration's SQL (capped at 2 KB). For a gated edit, the path and the change (capped at 80 lines); for a gated MCP call, the tool name and its arguments, redacted the same way. The card shows how many values were hidden. The server redacts everything again.

## Commands

| Command  | What it does                                                        |
| -------- | ------------------------------------------------------------------- |
| `init`   | Link this repo, store the token, write the presets and hook         |
| `status` | Show the link, presets and token check                              |
| `test`   | Raise a harmless gate for `echo tollgate-test`                      |
| `unlink` | Forget this repo's token on this machine (revoke it in the web app) |
| `hook`   | The hook itself; Claude Code calls it with JSON on stdin            |

After upgrading from 0.2.3 or earlier, run `init` again: it re-registers the hook for file edits and MCP tools.

## Safety notes

- **Fails closed.** If the server can't be reached, a risky command is blocked, with a message saying why.
- **Always answers before Claude Code's hook timeout.** Claude Code runs the command if a hook times out, so Tollgate parks the gate 15 s early and has a watchdog as well.
- **Emergency bypass.** Start Claude Code with `TOLLGATE_BYPASS=1`. Every bypass is logged to `~/.config/tollgate/audit.log`. The agent can't set this itself: the hook reads Claude Code's environment, not the Bash tool's shell.
- **Delegate mode** (opt-in per repo, owner only) makes a team approval skip Claude Code's own prompt for that exact command.

Requires Node 20.19 or later.
