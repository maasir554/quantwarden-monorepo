# QuantWarden UI

Next.js control plane for QuantWarden.

This repo handles:
- authentication and organization UI
- asset management, overview, and explorer
- manual scan creation
- scheduled scan creation
- live scan activity over SSE
- server-side LaTeX PDF reporting

Long-running scan execution does not run inside Vercel. It is handled by the dedicated worker container documented in [`worker/README.md`](worker/README.md).

## Architecture

Production setup:
- `Vercel`
  - runs this Next.js app
  - users click manual scans and create schedules here
  - the app writes scan batches and schedules into Neon
  - the app subscribes to scan activity from the database through SSE
- `Neon Postgres`
  - stores assets, batches, scan items, schedules, and progress state
- `Azure VM`
  - runs backend scan services such as `openssl-api`, `nmap-api`, and `subfinder-api`
  - runs the QuantWarden scan worker container

The app and worker coordinate through:
- shared Neon database state
- a signed wake endpoint for instant manual scans

## Repo Setup

From your local machine:

```bash
git clone <your-repo-url>
cd quantwarden-ui
npm install
```

Run the app locally:

```bash
npm run dev
```

PDF export requires `pdflatex` on `PATH` when running locally. The production Docker image installs the required TeX Live packages automatically. Report generation runs in the authenticated reporting API and does not render or capture HTML in the browser.

## App Environment

For local app development, use your normal root `.env` or `.env.local`.

Authentication defaults to username/password:

```env
USERNAME_AUTH_ENABLED=true
USERNAME_EMAIL_DOMAIN=guest.local
EMAIL_AUTH_ENABLED=false
```

To add email OTP/magic-link sign-in, set `EMAIL_AUTH_ENABLED=true` and configure
`SMTP_HOST`, `SMTP_PORT`, and the optional SMTP credentials before rebuilding.

For the deployed app on Vercel, set:

```env
SCAN_WORKER_WAKE_URL=https://your-vm-or-proxy.example.com/internal/wake
SCAN_WORKER_WAKE_SECRET=replace-with-the-same-secret-used-by-the-worker
SCAN_WORKER_WAKE_TIMEOUT_MS=1500
```

Meaning:
- `SCAN_WORKER_WAKE_URL`
  - app calls this after a manual batch is created
- `SCAN_WORKER_WAKE_SECRET`
  - bearer token shared with the worker
- `SCAN_WORKER_WAKE_TIMEOUT_MS`
  - short timeout for the wake request; the batch still succeeds if wake fails

## Worker Environment on the VM

On the VM, in the repo root, create:

```bash
cp .env.worker.example .env.worker
```

Then fill in `.env.worker`.

Recommended values:

```env
DATABASE_URL=postgres://username:password@host/database?sslmode=require
OPENSSL_API_URL=http://openssl-api:8020
NMAP_API_URL=http://nmap-api:8010
SCAN_WORKER_PORT=8088
SCAN_WORKER_HEALTH_PORT=8089
SCAN_WORKER_WAKE_SECRET=replace-with-the-same-secret-used-by-the-app
OPENSSL_API_TIMEOUT_SECONDS=3
OPENSSL_API_REQUEST_TIMEOUT_MS=15000
OPENSSL_API_PROBE_BATCH_SIZE=10
SCAN_WORKER_ACTIVE_EXECUTOR_TICK_MS=1500
SCAN_WORKER_ACTIVE_SCHEDULER_TICK_MS=10000
SCAN_WORKER_IDLE_EXECUTOR_TICK_MS=1800000
SCAN_WORKER_IDLE_SCHEDULER_TICK_MS=1800000
SCAN_WORKER_ACTIVE_GRACE_MS=60000
SCAN_WORKER_ACTIVE_ORG_LIMIT=100
SCAN_WORKER_MAX_CONCURRENT_JOBS=6
SCAN_WORKER_MAX_CONCURRENT_JOBS_PER_ORG=2
```

Behavior of those defaults:
- manual scans start quickly when the org is idle
- scheduled scans may wait up to about 30 minutes
- active scans still get frequent progress updates

## Worker Deployment on the VM

The worker runs best as Docker on the same VM as your backend scan services.

Fresh VM setup:

```bash
git clone <your-repo-url>
cd quantwarden-ui
git checkout <branch-name>
cp .env.worker.example .env.worker
# edit .env.worker
docker compose -f worker/docker-compose.worker.yml up -d --build
```

If the repo already exists on the VM:

```bash
cd quantwarden-ui
git fetch origin
git checkout <branch-name>
git pull origin <branch-name>
docker compose -f worker/docker-compose.worker.yml down
docker compose -f worker/docker-compose.worker.yml up -d --build
```

## Verification

Worker health:

```bash
curl http://127.0.0.1:8089/healthz
curl http://<vm-ip>:8089/healthz
```

Manual wake test:

```bash
curl -i -X POST "http://<vm-ip>:8088/internal/wake" \
  -H "Authorization: Bearer <SCAN_WORKER_WAKE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"manual_test","orgId":"test-org"}'
```

Container status:

```bash
docker compose -f worker/docker-compose.worker.yml ps
docker compose -f worker/docker-compose.worker.yml logs -f
```

## Updating the VM After Code Changes

From the repo root on the VM:

```bash
git fetch origin
git checkout <branch-name>
git pull origin <branch-name>
docker compose -f worker/docker-compose.worker.yml down
docker compose -f worker/docker-compose.worker.yml up -d --build
```

If only the env file changed:

```bash
docker compose -f worker/docker-compose.worker.yml down
docker compose -f worker/docker-compose.worker.yml up -d
```

If you want a clean rebuild:

```bash
docker compose -f worker/docker-compose.worker.yml down
docker compose -f worker/docker-compose.worker.yml build --no-cache
docker compose -f worker/docker-compose.worker.yml up -d
```

## More Detail

The worker lifecycle, ports, control endpoints, and VM operational commands are documented in:
- [`worker/README.md`](worker/README.md)
