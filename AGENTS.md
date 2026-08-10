# AGENTS.md

Compact guide for OpenCode sessions. The deeper architecture narrative lives in `CLAUDE.md`; this file captures commands, boundaries, and gotchas an agent would otherwise get wrong. Where this file and `CLAUDE.md` disagree, this file is correct (two corrections noted below).

## Layout

Submission bundle, **not a git repo** (no top-level `.git`). Two independent sub-repos + a master compose, with no shared build/workspace:

- `quantwarden-ui-main/` — Next.js 15 app (control plane) + Node scan worker (execution plane) sharing one `src/lib/` and one Prisma client. Node 22 (`.node-version`).
- `quantwarden-backend-main/` — Python FastAPI services plus the Go Subfinder service.
- `docker-compose.yml` (root) — builds and wires everything; see `README.md`.

## Commands

Whole stack (from repo root):
```bash
cp .env.example .env && docker-compose up -d --build
```
Only UI port 3000 is published by default. Mailpit port 8025 is available through the `email-demo` profile; worker and scanner ports stay internal.

UI + worker (from `quantwarden-ui-main/`):
```bash
npm install          # postinstall runs `prisma generate`
npm run dev          # Next dev (distDir .next-dev; `dev:turbo` = turbopack)
npm run build        # prisma generate && next build  — this IS the app typecheck
npm run lint         # eslint (eslint-config-next, flat config)
npm run worker:check # tsc --noEmit on the worker — the ONLY explicit typecheck script
npm run worker:start # worker:build && node worker/bootstrap.cjs (local worker)
```
There is **no `tsc` script for the app** and **no UI test runner**. The only test suite in the whole bundle is `cd quantwarden-backend-main/nmap-api && pytest`.

Backend (from `quantwarden-backend-main/`): `python3 start_monorepo_servers.py` (core services, auto-resolves port conflicts; `--setup` for interactive). Single service e.g. nmap-api: `cd nmap-api && python3 -m uvicorn main:app --host 0.0.0.0 --port 8010 --reload`. Go subfinder: `cd subfinder-api && SUBFINDER_API_ADDR=:8085 go run .`.

## Verification order

- App/UI changes → `npm run lint` → `npm run build`.
- Worker changes → `npm run worker:check`.
- `src/lib/` changes → **both**, then restart the worker (see coupling below).

## Critical: `src/lib/` is shared with the worker

The worker is **not** a separate package. `worker/tsconfig.json` sets `baseUrl: ".."`, `paths: { "@/*": ["src/*"] }`, and `include: ["src/**/*.ts", "../src/lib/**/*.ts"]`. It compiles to `worker/dist/`; `worker/bootstrap.cjs` rewrites `@/` → `worker/dist/src/` at runtime. **Editing anything in `quantwarden-ui-main/src/lib/*.ts` affects both the app and the worker** — rebuild/restart both, and re-run both checks.

## Env / runtime gotchas

- **Worker env loading differs local vs Docker.** `worker/bootstrap.cjs` loads `.env` and `.env.local` from the `quantwarden-ui-main/` repo root — **not** `.env.worker`. `.env.worker` is only consumed by `worker/docker-compose.worker.yml` (as `env_file`). For local `npm run worker:start`, put worker vars in `.env`/`.env.local`. (CLAUDE.md says bootstrap loads `.env.worker` — incorrect.)
- **Worker wake contract.** Root `.env.example` points `SCAN_WORKER_WAKE_URL` at `http://quantwarden-worker:8088/internal/wake`. `SCAN_WORKER_WAKE_SECRET` must be identical on app and worker; health is on internal port `8089` (`/healthz`).
- **Docker DB schema uses `prisma db push`, not migrations.** The `db-init` one-shot container runs `npx prisma db push` straight from `prisma/schema.prisma`; app + worker wait on `service_completed_successfully`. The `prisma/migrations/20260409_scan_scheduler` dir is **not** used by the Docker flow. Some tables (`org_scan_workflow`, schedule tables) and `user.username` columns are instead ensured at runtime by the worker via `ensure*` helpers using `$queryRawUnsafe` / `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` against snake_case names — so don't expect Prisma models for those.
- **Build needs a dummy `DATABASE_URL`.** `src/lib/prisma.ts` throws if unset, and Next's "Collecting page data" imports it at build time. The Dockerfile sets `postgresql://build:build@127.0.0.1:5432/build` for the build step only; for local `npm run build`, set any non-empty `DATABASE_URL` in `.env`.
- **`prisma.config.ts` loads `dotenv/config`** — local Prisma CLI reads `DATABASE_URL` from `quantwarden-ui-main/.env`.
- **Auth defaults to username/password.** `USERNAME_AUTH_ENABLED` defaults to `true`. Email OTP/magic-link and email invitations require `EMAIL_AUTH_ENABLED=true` plus SMTP. Username accounts use a synthetic email under `USERNAME_EMAIL_DOMAIN` for the email-keyed invite/inbox/membership machinery. `/api/auth/methods` reports enabled modes. No Google or Resend; username password recovery is org-admin-only.

## Scan execution model (essential for touching scan code)

App is control plane: `src/app/api/orgs/scans/**` create `asset_scan_batch`/`asset_scan` rows (or `scan_schedule` rows) and **never run scans** (Vercel-safe). Worker is execution plane with two loops — `scheduler` (materializes due schedules) and `executor` (claims via `claimNextPendingScan`, dispatches by `engine`: `portDiscovery`→`port-discovery-runner.ts`, `subdomainDiscovery`→`subdomain-discovery-runner.ts`, else `openssl-scan-runner.ts`). Runners write results back to Postgres; `refreshScanBatch` recomputes batch status. Stale `running` items (>5min and not in this worker's in-memory `runningJobs`) are auto-recovered to `failed` each tick. App→worker communication is **only** a one-shot bearer wake ping (`src/lib/scan-worker-wake.ts`); all other coordination is via shared Postgres. Live UI progress is SSE (`api/orgs/scans/stream` + `src/components/scan-activity-provider.tsx`). Per-org workflow chains live in `src/lib/scan-workflow.ts` (`onboarding`: subdomain→port→openssl; `asset_added`: port→openssl).

Worker tuning vars (defaults in `worker/src/config.ts`): active executor 1500ms, active scheduler 10000ms, idle 1800000ms, grace 60000ms, org limit 100, global concurrency 6, and per-org concurrency 2. OpenSSL batching: `OPENSSL_API_PROBE_BATCH_SIZE=10`, `OPENSSL_API_TIMEOUT_SECONDS=3`, `OPENSSL_API_REQUEST_TIMEOUT_MS=15000`. Full list in `quantwarden-ui-main/.env.worker.example` and `worker/README.md`.

## Routing

Authenticated app under `src/app/app/[org_slug]/...` (org UI pieces in `_components/`); public CBOM explorer at `src/app/cbom/explorer/...`; API routes under `src/app/api/` (auth catch-all `api/auth/[...all]`, scan endpoints `api/orgs/scans/**`).

## Pointers

- `CLAUDE.md` — full architecture, data models, PQC scoring weights, auth internals.
- `quantwarden-ui-main/worker/README.md` — worker ops, health/wake curl examples, VM Docker flow.
- `quantwarden-backend-main/README.md` — backend service manual startup, venv resolution, MCP server tools.
- `.env.example` (root), `quantwarden-ui-main/.env.worker.example`, `quantwarden-backend-main/.env.docker.example` — env templates.
