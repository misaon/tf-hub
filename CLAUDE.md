# CLAUDE.md

This project follows [AGENTS.md](./AGENTS.md) — architecture, conventions, and the non-negotiable code
requirements. Read it before making changes.

Rules for AI assistants working in this repository:

- Never run `git commit` or `git push` on your own. Finish the work, run the gates, report — the developer
  reviews and commits.
- Before reporting work as done, all gates must pass: `bun run lint`, `bun run fmt:check`, `bun run knip`,
  `bun run typecheck`, `bun test`.
- Do not add code comments (see the comments policy in AGENTS.md) and do not name the company anywhere.
- Never edit `src/api/generated/` by hand — change `scripts/update-openapi.ts` or the server and rerun
  `bun run generate`.
