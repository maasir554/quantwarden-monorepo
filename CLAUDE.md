# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

QuantWarden is a post-quantum cryptography (PQC) attack-surface scanner. Users register organizations, add assets (domains/hosts), and run scans that discover subdomains, probe open ports, and analyze TLS/SSL posture for quantum-readiness (ML-KEM key exchange, etc.). Results roll up into a CBOM (Cryptographic Bill of Materials), PQC scores, and reports.

This is a **submission bundle of two independent repos** plus a master compose file:

- `quantwarden-ui-main/` — Next.js 15 control plane + a Node scan worker (execution plane). These share the same `src/lib` codebase and Prisma client.
- `quantwarden-backend-main/` — A polyglot monorepo of stateless scan microservices (Python FastAPI + one Go service).
- `docker-compose.yml` (root) — Master orchestrator that builds and wires everything together; see `README_DEPLOY.md`.

There is no top-level git repo or shared build. Each sub-repo is developed and built on its own.

## Run / build / test

### Whole stack (root)
```bash
cp .env.example .env          # defaults already work for internal Docker networking
docker-compose up -d --build  # UI :3000, worker :8088/:8089, APIs :8000 :8002 :8010 :8020 :8085
```

### UI + worker (`quantwarden-ui-main/`)
```bash
npm install            # runs `prisma generate` via postinstall
npm run dev            # Next dev server (uses .next-dev distDir)
npm run build          # prisma generate && next build
npm run lint           # eslint (eslint-config-next)
npm run worker:check   # typecheck the worker (tsc --noEmit)
npm run worker:start   # build + run the worker locally (worker/bootstrap.cjs)
```
There is no UI test runner configured. The worker has no separate test suite.

### Backend services (`quantwarden-backend-main/`)
```bash
python3 start_monorepo_servers.py          # launches all Python+Go services, auto-resolves port conflicts
python3 start_monorepo_servers.py --setup  # interactive port selection
```
Run a single service manually, e.g. nmap-api:
```bash
cd quantwarden-backend-main/nmap-api
python3 -m uvicorn main:app --host 0.0.0.0 --port 8010 --reload
```
The Go subfinder service: `cd subfinder-api && ONEFORALL_API_URL=http://127.0.0.1:8002 SUBFINDER_API_ADDR=:8085 go run .`

nmap-api is the only service with tests: `cd quantwarden-backend-main/nmap-api && pytest`.

## Architecture: how a scan actually runs

The single most important thing to understand is the **control-plane / execution-plane split**, coordinated entirely through shared Postgres (Neon in prod) state — there is no direct RPC from app to worker except a one-shot "wake" ping.

1. **App (Next.js)** is the control plane. API routes under `src/app/api/orgs/scans/**` create rows in `asset_scan_batch` / `asset_scan` (queued), or create `scan_schedule` rows. The app does **not** execute scans (it's designed to run on Vercel where long jobs aren't allowed).
2. After creating a manual batch, the app calls `src/lib/scan-worker-wake.ts` → `POST {SCAN_WORKER_WAKE_URL}/internal/wake` with a bearer `SCAN_WORKER_WAKE_SECRET`. This only flips the worker into "active" (fast-poll) mode; the batch still succeeds if the wake fails.
3. **Worker (`worker/src/index.ts`)** is the execution plane. It runs two loops — `scheduler` (materializes due schedules into queued batches) and `executor` (claims and runs queued scan items). It has **active mode** (fast polling, ~1.5s) and **idle mode** (~30min) to avoid keeping Neon hot. A wake request or detected work refreshes the active window.
4. The executor claims items via `claimNextPendingScan` and dispatches by `engine`: `portDiscovery` → `port-discovery-runner.ts` (calls nmap-api), `subdomainDiscovery` → `subdomain-discovery-runner.ts` (calls subfinder-api), else `openssl-scan-runner.ts` (calls openssl-api). Runners write progress/results back to Postgres; `refreshScanBatch` recomputes batch status.
5. Stale `running` items (>5min, e.g. from a worker crash) are auto-recovered to `failed` at the top of each executor tick.
6. The UI subscribes to live progress via SSE: `src/app/api/orgs/scans/stream/route.ts` + `src/components/scan-activity-provider.tsx`.

### Automated workflow chains (`src/lib/scan-workflow.ts`)
After each batch step completes, the worker advances per-org workflows stored in `org_scan_workflow`:
- `onboarding`: subdomain_discovery → port_discovery → openssl → done
- `asset_added`: port_discovery → openssl → done

### Shared-code coupling (important)
The worker is **not** a separate package. `worker/tsconfig.json` sets `baseUrl: ".."` with `@/* → src/*` and includes `../src/lib/**/*.ts`, so the worker imports the same `src/lib/*` modules and the same `src/lib/prisma.ts` client the app uses. `worker/bootstrap.cjs` rewrites the `@/` alias at runtime and loads `.env.worker`. **Editing anything in `src/lib/` affects both the app and the worker.**

### Backend microservices
All are stateless HTTP wrappers around security CLIs/libraries, called by the worker (and optionally by the MCP server). FastAPI services expose their schemas under `src/<service>/`. `mcp-monorepo-server/` exposes these same APIs as MCP tools (`nmap_security_intelligence`, `openssl_profile`, `subfinder_combined`, etc.) for AI agents. Service URLs are injected via env (`OPENSSL_API_URL`, `NMAP_API_URL`, `SUBFINDER_API_URL`, ...).

## Data & domain layer

- **Prisma schema**: `quantwarden-ui-main/prisma/schema.prisma`. Core models: `Organization`/`Member`/`Role`/`Invitation`/`JoinRequest` (multi-tenant orgs with RBAC), `Asset`, `AssetScanBatch`/`AssetScan`, `ScanSchedule`/`ScanScheduleRun`, `NmapAsset`/`NmapAssetScan`, `OrganizationPortDiscoveryConfig`. Better Auth models: `User`/`Session`/`Account`/`Verification`/`LoginCode`.
- Some tables (`org_scan_workflow`, scheduling tables) are created/ensured at runtime by the worker via `ensure*` helpers (`scan-workflow-schema.ts`, `scan-schedule-server.ts`) rather than Prisma migrations. Several DB ops use `prisma.$queryRawUnsafe` / `$executeRawUnsafe` against these snake_case tables.
- **Prisma 7 + pg adapter**: `src/lib/prisma.ts` uses `PrismaPg` over a `pg.Pool`, cached on `globalThis` outside production.
- **Auth**: Better Auth with `organization`, `magicLink`, and `username` plugins. Username/password is the default (`USERNAME_AUTH_ENABLED=true`). Email OTP/magic-link and email invitations require both `EMAIL_AUTH_ENABLED=true` and SMTP. Username accounts use an internal synthetic email under `USERNAME_EMAIL_DOMAIN` so existing invite/membership code works unchanged. `/api/auth/methods` exposes enabled modes; password recovery for username accounts is org-admin-only. No Google or Resend.
- **PQC scoring** (`src/lib/pqc-scoring.ts`): turns raw OpenSSL scan data into a 0–100 score / A–F tier across key-exchange (40), symmetric (30), protocol (20), auth (10) plus penalties. `src/lib/cbom.ts`, `pqc.ts`, `reporting.ts` build CBOM/report outputs consumed by the `cbom/`, `posture/`, `reporting/` pages.

## App routing conventions

- Authenticated app lives under `src/app/app/[org_slug]/...`; org-scoped UI pieces are in `_components/`. The public CBOM explorer is under `src/app/cbom/explorer/...`.
- API routes under `src/app/api/`. Auth catch-all is `api/auth/[...all]`. Scan-related endpoints are under `api/orgs/scans/`.

## Config & env notes

- The app/worker contract requires `SCAN_WORKER_WAKE_SECRET` to be **identical** on both sides, and `SCAN_WORKER_WAKE_URL` on the app to point at the worker's control port (`8088`). Worker health is on `8089` (`/healthz`).
- `next.config.ts` deliberately separates dev (`.next-dev`) and prod (`.next`) build dirs to avoid chunk/cache conflicts.
- Templates: root `.env.example`, `quantwarden-ui-main/.env.worker.example`, `quantwarden-backend-main/.env.docker.example`. Worker polling cadence and OpenSSL probe batching are tuned via the `SCAN_WORKER_*` and `OPENSSL_API_*` vars documented in `quantwarden-ui-main/worker/README.md`.
