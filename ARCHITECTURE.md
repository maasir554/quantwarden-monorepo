# QuantWarden — Architecture Report

> **Hackathon submission — PNB Hack**
> A post-quantum cryptography (PQC) attack-surface scanner that discovers assets, profiles TLS posture, and scores organizations on quantum-readiness. This document captures the system architecture, the design decisions we're proud of, and the engineering practices we followed.

---

## 1. System overview

QuantWarden lets organizations register, add assets (domains/hosts), and run scans that discover subdomains, probe open ports, and analyze TLS/SSL posture for quantum-readiness (ML-KEM key exchange, etc.). Results roll up into a **CBOM** (Cryptographic Bill of Materials), a **0–100 PQC score** with an A–F tier, and exportable reports.

The submission bundle is **three deployment units with no shared build or workspace**, orchestrated by a single `docker-compose.yml`:

| Unit | Stack | Role |
|---|---|---|
| `quantwarden-ui-main/` | Next.js 15 (App Router) + Node 22 scan worker | Control plane (app) + execution plane (worker), sharing one `src/lib/` and one Prisma client |
| `quantwarden-backend-main/` | Python FastAPI ×4 + Go ×1 | Stateless scan-engine microservices wrapping security CLIs/libraries |
| `docker-compose.yml` (root) | — | Master orchestrator: db, db-init, UI, worker, Mailpit, 5 backend APIs, MCP server |

Coordination between units is **entirely via shared Postgres state plus a one-shot wake ping** — there is no direct RPC from app to worker for scan work. This was a deliberate choice to keep the app deployable on serverless platforms (Vercel) while scans run on a long-lived worker.

---

## 2. The control-plane / execution-plane split

This is the single most important architectural decision and shapes everything else.

### App (Next.js) = control plane
API routes under `src/app/api/orgs/scans/**` create rows in `asset_scan_batch` / `asset_scan` (status `queued`) or `scan_schedule` rows. The app **never executes scans** — it's designed to run on Vercel where long-lived jobs are impossible. After creating a manual batch it sends a single bearer-authenticated `POST /internal/wake` to the worker (`src/lib/scan-worker-wake.ts`); the wake is **best-effort** (failure is logged, batch still queues and will be picked up on the next poll).

### Worker (`worker/src/index.ts`) = execution plane
A long-running Node process with two independent loops:

- **Scheduler loop** — materializes due `scan_schedule` rows into queued batches via `runSchedulerMaintenanceCycle`, then nudges the executor.
- **Executor loop** — calls `listOrganizationsWithActiveScanWork` → `claimNextPendingScan(orgId)` per org, dispatches each claimed item by `engine`, and advances automated workflows.

The worker has **two polling modes** to avoid keeping the Postgres connection hot:
- **Active mode**: executor tick ~1500ms, scheduler ~10000ms. Entered on wake or when work is detected. Held for `activeGraceMs` (60s) after the last job.
- **Idle mode**: ~30min ticks. Scheduled scans can take up to ~30min to start; manual scans are near-instant via the wake ping.

> **Best practice — cost-aware polling.** The idle/active dual-mode design keeps database connections quiet when there's no work, which matters on serverless Postgres (Neon) where idle compute is billed. A wake ping flips the worker into fast-polling only when there's actual work to do.

---

## 3. Scan execution model

### Engines and runners
The executor dispatches by the `engine` field on `asset_scan_batch`:

| `engine` | Runner | Backend service | Purpose |
|---|---|---|---|
| `subdomainDiscovery` | `subdomain-discovery-runner.ts` | subfinder-api (Go) → one-for-all-subdomains | Find subdomains of a root domain |
| `portDiscovery` | `port-discovery-runner.ts` | nmap-api (Python) | Probe open ports + resolve IP |
| `openssl` (default) | `openssl-scan-runner.ts` | openssl-api (Python) | TLS/SSL handshake profiling |

Runners write progress and `resultData` back to `asset_scan` rows; `refreshScanBatch` recomputes the parent batch's `completedAssets`/`failedAssets`/`status`.

### Stale recovery
At the top of every executor tick, `recoverStaleScanItems` marks any `running` scan older than 5 minutes **that isn't in this worker's in-memory `runningJobs` map** as `failed`. This auto-recovers from worker crashes without manual intervention.

> **Best practice — self-healing workers.** No operator action is needed after a crash. The next tick reclaims stuck work and recomputes batch status, so the system converges to a correct state on its own.

### Batch creation and the per-org lock
`createScanBatch` (`scan-batch-create.ts`) runs inside a single Prisma transaction that takes a **Postgres advisory lock** keyed by `hashtext(orgId)`:

```sql
SELECT pg_advisory_xact_lock(hashtext($1)::bigint)
```

This serializes batch creation per org. Within that lock it:
1. Counts existing `queued`/`running` batches → computes `queuePosition` (0 = runs immediately).
2. Filters assets by engine (`subdomainDiscovery` requires `type='domain' AND isRoot=true`; `portDiscovery` allows domain+IP; `openssl` requires domain).
3. Excludes assets already in an active scan.
4. Validates batch shape (`single` = exactly 1 asset, `group` ≥ 2, `full` = all scannable).
5. Inserts the `asset_scan_batch` (status `queued`) + child `asset_scan` rows (status `pending`). For `openssl`, one `asset_scan` per (asset × open port); for the other engines, one per asset.

The result tells the caller whether the batch was **queued behind** an active one (`queued: true, queuePosition: N`). The UI surfaces this as "Position #N in queue."

> **Best practice — correctness over brokers.** We use Postgres itself as the queue with advisory locks for concurrency control, avoiding the operational burden of running a separate message broker while still getting atomic enqueue + dedup.

### Automated workflow chains
Beyond manual batches, the worker advances per-org workflows stored in the runtime-managed `org_scan_workflow` table (`scan-workflow.ts`):

- **`onboarding`**: `subdomain_discovery → port_discovery → openssl → done`
- **`asset_added`**: `port_discovery → openssl → done`

After each step's batch completes, `advanceOrgWorkflows` creates the next step's batch. This fires when an org finishes setup or adds a new root asset — zero client involvement.

> **Best practice — zero-touch automation.** Once an asset is added, the entire discovery-to-assessment pipeline runs without any user interaction. The user just sees results appear as the workflow progresses.

---

## 4. Worker queue mechanics

The "queue" is not a separate broker — **Postgres itself is the queue**. `asset_scan_batch.status` transitions `queued → running → completed/failed/cancelled`, and `asset_scan.status` transitions `pending → running → completed/failed`.

`claimNextPendingScan(orgId)` atomically claims the next `pending` scan for an org (marking it `running`) so multiple workers could in principle share the load, though the default deployment runs one worker.

**Concurrency control** is layered:
- **Per-org advisory lock** during batch *creation* (prevents duplicate batches).
- **Per-org active-batch detection** in `createScanBatch` returns a 409 "already active" error path if you try to start a batch on assets already being scanned — the UI shows the lock banner via `activity.lock`.
- **In-process `runningJobs` map** in the worker prevents double-launching the same scanId within one worker and drives the 5-min stale-recovery logic.

The `ScanActivityProvider` (React context) consumes this state via two channels:
- **REST**: `GET /api/orgs/scans/activity?orgId=` returns the full `OrgScanActivityPayload` (active batches, queued count, upcoming scheduled runs, latest completed batch, recent history, all failures, lock state).
- **SSE**: `GET /api/orgs/scans/stream?orgId=` pushes `snapshot`/`batch_update`/`item_update`/`lock_update`/`heartbeat` events so the UI updates live without polling.

> **Best practice — real-time UX without polling spam.** A single SSE connection per org drives all live progress (batch/item/lock updates, heartbeats) with automatic reconnection and stream rotation. The UI never polls on a timer for scan state.

---

## 5. RBAC and multi-tenancy

### Data model
Organizations are the tenancy boundary. Core models (`prisma/schema.prisma`):

- `Organization` (`id, name, slug, isPublic, discoverable`) — slug is unique, used in routes `/app/[org_slug]/...`.
- `Member` (`organizationId, userId, role`) — the join table. `role` is a **string** (e.g. `"owner"`, `"admin"`, `"member"`) stored by Better Auth's organization plugin, not a FK.
- `Role` (`organizationId, name, permissions`) — org-scoped custom roles. `permissions` is a **JSON string** of feature flags: `{"team": bool, "scan": bool, "asset": bool}`.
- `Invitation` (`email, role, status, expiresAt, inviterId`) — email-keyed invites.
- `JoinRequest` (`userId, status`) — for discoverable orgs.

### Permission resolution
`getOrgMemberAccess` (`org-scan-permissions.ts`) is the central check. It joins `member` to `role` on `(orgId, roleId-or-roleName)`, then derives:

- **Privileged** = role id/name is `owner`/`admin`/`administrator` → gets *all* capabilities.
- Otherwise, capabilities come from the role's parsed `permissions` JSON:
  - `canManageTeam` = privileged **or** `permissions.team`
  - `canScan` = privileged **or** `permissions.scan`
  - `canManageAssets` = privileged **or** `permissions.asset`
  - `canManageRoles` = privileged **or** `permissions.team`

`getOrgScanAccess` is the trimmed variant used by scan endpoints (returns just `canScan`). Every `api/orgs/scans/**` route calls this before creating batches; a 403 is returned without scan permission.

> **Best practice — permission checks at the boundary.** Every scan API route calls `getOrgScanAccess` before doing work — there is no path to enqueue a scan without a verified `canScan` check. Org isolation is enforced at the data layer (`organizationId` on every asset/batch/schedule), not just in the UI.

### Auth (dual-mode)
Better Auth (`src/lib/auth.ts`) with `organization` + `magicLink` + `username` plugins. Two coexisting sign-in styles:

- **Email** — OTP/magic-link over SMTP (`src/lib/mailer.ts`). **Optional**, gated on `SMTP_HOST` being set. Unset → email disabled entirely.
- **Guest** — username + password (`src/lib/guest-auth.ts`). Guests get a **synthetic email** `username@$GUEST_EMAIL_DOMAIN` so the email-keyed invite/inbox/membership machinery works unchanged. `/api/auth/methods` tells the UI which modes are enabled.

> **Best practice — one code path for two auth modes.** Instead of forking the invite/membership/inbox logic for email vs. email-free users, guests get a synthetic email under a configurable domain. The entire email-keyed machinery works unchanged, halving the surface area for bugs.

The `user.username` column and several scan tables are **not** provisioned by Prisma migrations — they're ensured at worker startup via `ensureGuestAuthSchema()` / `ensureWorkflowTable()` using `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` against snake_case names. Docker's `db-init` runs `prisma db push` (schema-first), and the worker layers runtime tables on top.

Guest password recovery is **org-admin-only** (`/api/orgs/members/reset-password`) since guests have no email. No Google OAuth, no Resend — intentionally zero third-party dependencies for the submission.

> **Best practice — zero third-party service dependencies.** The entire stack runs with nothing external: no Google OAuth, no Resend, no managed email. The bundled Mailpit container catches all mail for demos at `:8025`. For production, point `SMTP_HOST` at an internal relay. For air-gapped, unset it and run guest-only. Same code, three deployment tiers.

---

## 6. Data layer

- **Prisma 7** with the `pg` adapter (`src/lib/prisma.ts`): `PrismaPg` over a `pg.Pool`, cached on `globalThis` outside production to survive Next HMR.
- A large fraction of scan/workflow/schedule operations use `prisma.$queryRawUnsafe` / `$executeRawUnsafe` against snake_case runtime tables (`org_scan_workflow`, `org_scan_schedule`, `org_scan_schedule_run`, `organization_port_discovery_config`) that either have no Prisma model or are ensured at runtime. This is a deliberate trade-off for schema flexibility without migration churn.
- `next.config.ts` splits dev (`.next-dev`) and prod (`.next`) build dirs to avoid cache/chunk conflicts during local development.

> **Best practice — schema flexibility without migration debt.** Runtime-managed tables (workflow state, schedule runs, guest auth columns) are ensured with `IF NOT EXISTS` at startup, so the system bootstraps a fresh database and upgrades an existing one through the same code path. No migration files to keep in sync, no drift.

---

## 7. PQC scoring and CBOM

Raw OpenSSL scan data is transformed by `src/lib/pqc-scoring.ts` into a 0–100 score and A–F tier across four weighted dimensions:

| Dimension | Weight |
|---|---|
| Key exchange | 40 |
| Symmetric ciphers | 30 |
| Protocol versions | 20 |
| Authentication | 10 |

Plus penalties for weak/legacy findings. `src/lib/cbom.ts`, `pqc.ts`, and `reporting.ts` build the CBOM and report outputs consumed by the `cbom/`, `posture/`, and `reporting/` pages. The public CBOM explorer lives at `src/app/cbom/explorer/...` (unauthenticated); org-scoped views are under `/app/[org_slug]/`.

> **Best practice — transparent, weighted scoring.** The PQC score isn't a black box — it's a documented weighted sum across four dimensions with explicit penalties, so a security team can trace any score back to the exact findings that produced it.

---

## 8. Backend microservices

All five services are **stateless HTTP wrappers** around security CLIs/libraries, called by the worker (and optionally by the MCP server for AI agents):

| Service | Language | Port | Wraps |
|---|---|---|---|
| nmap-api | Python/FastAPI | 8010 | `nmap` CLI (port discovery) |
| openssl-api | Python/FastAPI | 8020 | OpenSSL TLS profiling |
| pyssl-api | Python/FastAPI | 8000 | Python SSL analysis |
| subfinder-api | Go | 8085 | subfinder + assetfinder, calls one-for-all |
| one-for-all-subdomains | Python/FastAPI | 8002 | OneForAll subdomain enumeration (vendored) |

`mcp-monorepo-server/` exposes these as MCP tools (`nmap_security_intelligence`, `openssl_profile`, `subfinder_combined`, etc.) for AI agents. Service URLs are injected via env (`OPENSSL_API_URL`, `NMAP_API_URL`, `SUBFINDER_API_URL`).

> **Best practice — polyglot best-tool-for-job.** Each backend service uses the language that fits its wrapped tool: Go for subfinder's concurrency model, Python for FastAPI's speed-of-development on CLI wrappers, Node for the worker's shared TS codebase with the app. Services are stateless and independently deployable.

---

## 9. Deployment topology

```
docker-compose up -d --build
        │
        ├─ db (postgres:15) ────┐
        ├─ db-init (one-shot) ──┘  prisma db push; app+worker wait on service_completed_successfully
        ├─ quantwarden-ui (:3000)       depends_on: db-healthy, db-init-success
        ├─ quantwarden-worker (:8088/:8089)  depends_on: db-healthy, db-init-success
        ├─ mailpit (:8025/:1025)
        ├─ nmap-api (:8010)  openssl-api (:8020)  pyssl-api (:8000)
        ├─ subfinder-api (:8085) → oneforall-api (:8002)
        └─ mcp-monorepo-server (internal)
```

The app/worker contract requires `SCAN_WORKER_WAKE_SECRET` to be **identical** on both sides, and `SCAN_WORKER_WAKE_URL` to point at `...:8088/internal/wake` (control port); health is on `8089` (`/healthz`).

> **Best practice — one-command bring-up.** `cp .env.example .env && docker-compose up -d --build` starts the entire 10-container stack with a working demo config (Mailpit catches all email, guest auth enabled, internal service URLs pre-wired). The `db-init` one-shot provisions the schema before the app and worker start, so they never query a schemaless database.

---

## 10. Engineering practices we followed

### Code sharing without a monorepo tool
The worker is **not** a separate package. `worker/tsconfig.json` sets `baseUrl: ".."` with `@/* → src/*` and includes `../src/lib/**/*.ts`, so the worker imports the same `src/lib/*` modules and the same `src/lib/prisma.ts` client the app uses. `worker/bootstrap.cjs` rewrites the `@/` alias at runtime. **Editing anything in `src/lib/` affects both the app and the worker** — a coupling we enforce by running both `npm run build` (app) and `npm run worker:check` (worker) before shipping.

### Verification order
- App/UI changes → `npm run lint` → `npm run build` (the build is the app's typecheck).
- Worker changes → `npm run worker:check` (`tsc --noEmit`).
- `src/lib/` changes → **both**, then restart the worker.

### Best-effort wake, guaranteed delivery
The wake ping is best-effort by design: if it fails, the batch is still queued and will be picked up on the next idle poll (worst case ~30min). This means a transient network blip between app and worker never loses work — it only delays it.

### Live UI without polling
A single SSE stream per org (`/api/orgs/scans/stream`) drives all live progress with automatic reconnection (exponential backoff capped at 15s) and stream rotation every ~4min to avoid proxy timeouts. The `ScanActivityProvider` React context deduplicates subscriptions across components, so multiple components on the same page share one connection.

### Secrets hygiene
- Real `.env` files are gitignored across the repo; only `.env.example` templates are tracked.
- `SCAN_WORKER_WAKE_SECRET` is a shared bearer token, never logged in full.
- No API keys for third-party services are required (subfinder tokens are optional and blank by default).

---

## 11. Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (user)                                │
│  /app/[org_slug]/...   cbom/explorer   auth/sign-in                 │
└───────────────┬─────────────────────────────────────────────────────┘
                │  REST + SSE
┌───────────────▼─────────────────────────────────────────────────────┐
│              NEXT.JS APP (control plane :3000)                       │
│  api/auth/*  api/orgs/scans/**  api/orgs/assets  api/orgs/cbom      │
│  ScanActivityProvider (SSE consumer)  RBAC: getOrgScanAccess        │
└───────┬───────────────────────────┬──────────────────────────────────┘
        │ POST /internal/wake        │ shared Postgres
        │ (best-effort)              │ (asset_scan_batch, asset_scan,
        ▼                            │  scan_schedule, org_scan_workflow)
┌───────────────────────┐    ┌───────▼──────────────────────────────────┐
│  WORKER (exec plane)  │    │           POSTGRES :5432                  │
│  scheduler loop       │────│  org-scoped advisory locks                │
│  executor loop        │    │  runtime-ensured tables                   │
│  stale recovery       │    └───────────────────────────────────────────┘
│  workflow advancer    │
└───┬──────┬──────┬─────┘
    │      │      │
    ▼      ▼      ▼
 subfinder nmap  openssl   ← stateless backend microservices
  (Go)    (Py)   (Py)
```

---

*This document reflects the codebase as submitted. Detailed operational gotchas and developer commands live in `AGENTS.md`; the full data model and auth internals are in `CLAUDE.md`.*
