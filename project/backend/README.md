# backend

Bun + Elysia + Drizzle (libSQL/Turso).

## Setup

```bash
bun install
cp .env.example .env   # set DATABASE_URL (+ DATABASE_AUTH_TOKEN for Turso)
bun run db:migrate     # apply migrations to the local db
bun run db:seed        # optional sample data
```

## Run

```bash
bun run dev            # watch mode on $PORT (default 3001)
```

- OpenAPI docs: `/openapi` (spec at `/openapi/json`)
- Health probes: `/health/live`, `/health/ready`

## Conventions

Responses use one envelope — success `{ data }`, failure
`{ error: { code, message, details? } }`. Each resource is a module under
`src/modules/<name>/` (`model.ts` schemas · `service.ts` Drizzle access ·
`index.ts` Elysia controller). See `.claude/skills/backend/SKILL.md`.

## Scripts

`dev` · `start` · `test` · `typecheck` · `db:generate` · `db:migrate` ·
`db:push` · `db:seed`
