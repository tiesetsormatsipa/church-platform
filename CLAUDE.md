# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Start every session by reading `docs/HANDOVER.md` (current status, next steps, open
  questions). Finish every session by updating it.
- Before using a framework API you are unsure about, read the installed version's docs:
  Next.js ships its docs in `apps/web/node_modules/next/dist/docs/`, and Base UI in
  `packages/ui/node_modules/@base-ui/react/docs/`. For NestJS and Prisma, read the type
  definitions in `node_modules`. Do not rely on memory: these are Next 16, Nest 12,
  Prisma 7, Zod 4, Tailwind 4 and TypeScript 6.
- Prisma refuses destructive commands (`migrate reset`, `db push --force-reset`) from AI
  agents without the user's explicit consent. Ask the user, and never set
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` yourself. Tests do not need it (they use
  throwaway databases).
- Docker Hub may rate-limit in cloud sandboxes. `mirror.gcr.io/library/<image>` works for
  official images. Tag them to the names used in `infra/docker/compose.dev.yml`.
- Run long test suites with a timeout and read the tail of the output. Don't claim success
  without the output.
- Milestones are fast-forwarded to `main` only after the full gate passes (AGENTS.md §11).
