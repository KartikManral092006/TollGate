# Contributing to Tollgate

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/KartikManral092006/TollGate/issues) using
  one of the templates. For a large change, describe it in an issue before writing code, so we can
  agree on the approach first.
- **Security problems:** don't open a public issue. Follow [SECURITY.md](SECURITY.md).

## Set up

Follow [Self-hosting and development](README.md#self-hosting-and-development) in the README:
install with pnpm, copy `.env.example` to `.env`, start Postgres and Redis with `pnpm db:up`,
apply migrations with `pnpm db:deploy` and run `pnpm dev`.

## Making a change

1. Branch from `main`.
2. Keep the change focused: one fix or feature per pull request.
3. Add or update tests:
   - logic in `features/*/shared` or `features/*/server` gets unit tests in `tests/unit/`;
   - anything that depends on database behaviour (transactions, cascades, locks) gets an
     integration test in `tests/integration/`.
4. Run the same checks as CI:

   ```bash
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test
   TEST_DATABASE_URL=postgresql://tollgate:tollgate@localhost:5436/tollgate_test pnpm test:int
   ```

5. For UI changes, check the page at phone width (375 px), in light and dark mode, and with the
   keyboard. Put screenshots in the pull request.

## How the code is organised

- `app/` holds routes only. Logic lives in `features/<name>/`, split into `server/`, `client/`,
  `components/` and `shared/`.
- Code in `features/*/shared` is bundled into the browser **and** into the CLI, so it must not
  import Node-only or server-only modules.
- The CLI (`packages/cli`) talks to the server only through the hook API in
  `features/gates/shared/hook-api.ts`. Older CLI versions stay in use for a while, so add fields in
  a backwards-compatible way.
- Secrets are redacted on the laptop and again on the server. A change that sends new data from
  the laptop must go through both.

## Database changes

- Edit `prisma/schema.prisma`, then create a migration with `pnpm db:migrate`.
- Never edit a migration that has already been merged; add a new one.
- CI fails if the migrations and the schema disagree.

## Commit messages

Write the subject as a short imperative sentence that says what changes for the user, for example
"Let owners delete a team and members leave one". Use the body to explain why.

## License

By contributing, you agree that your contributions are licensed under the project's
[MIT License](LICENSE).
