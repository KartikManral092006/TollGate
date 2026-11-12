# Security policy

Tollgate sits between a coding agent and production, so security reports are taken seriously.
Thank you for reporting problems responsibly.

## Supported versions

| Component                                                                    | Supported                           |
| ---------------------------------------------------------------------------- | ----------------------------------- |
| Hosted app at [toll-gate-mo7d.vercel.app](https://toll-gate-mo7d.vercel.app) | Always the current deployment       |
| `tollgate-cli`                                                               | The latest version published on npm |
| Self-hosted servers                                                          | The latest commit on `main`         |

## Reporting a vulnerability

**Please don't open a public issue, discussion or pull request for a security problem.**

Report it privately through GitHub: open the repository's **Security** tab and choose
**Report a vulnerability**. Include:

- what an attacker could do, and what they need first (an account, a repo token, access to a laptop);
- steps to reproduce, or a proof of concept;
- the affected component (web app, hook API, CLI) and version or commit.

You'll get an acknowledgement as soon as possible. Once the problem is confirmed, a fix is prepared
and you're kept informed. You'll be credited in the fix's release notes unless you'd rather not be.

## Scope

Examples of what's in scope:

- approving a gate without being an eligible member, or approving your own agent's command;
- a repo token doing more than raising gates and reading their status;
- secrets reaching the server or the team room despite redaction;
- reading another team's gates, members or audit log;
- the hook letting a gated command run without a decision while the server is reachable.

Out of scope: the documented limitations in the [README](README.md#limitations), such as commands
hidden in Makefiles or shell scripts, and the emergency bypass (`TOLLGATE_BYPASS=1`), which is
trusted by design and reported to the team.
