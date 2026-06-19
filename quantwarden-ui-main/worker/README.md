# QuantWarden Scan Worker

Background scheduler and scan executor for QuantWarden organizations.

This worker is the execution plane. The Next.js app remains the control plane.

The worker is responsible for:
- materializing due schedules into queued batches
- claiming queued scan items
- running OpenSSL scans
- running Nmap-backed port discovery
- writing progress and results back into Neon

## Runtime Model

The worker runs in two modes:

- `active mode`
  - fast polling
  - used while scans are active or immediately after a manual wake
- `idle mode`
  - coarse polling
  - used to avoid keeping Neon hot all the time

Current intended behavior:
- manual scans wake the worker almost instantly
- scheduled scans can start within about 30 minutes
- progress updates stay frequent while scans are active

## Ports

- `8088`
  - control port
  - accepts `POST /internal/wake`
- `8089`
  - health port
  - serves `GET /healthz`
  - also responds on `GET /`

## Required Environment

Create this file in the repo root on the VM:

- `/path/to/quantwarden-ui/.env.worker`

You can start from:

```bash
cp .env.worker.example .env.worker
```

Recommended contents:

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
```

Meaning:
- `DATABASE_URL`
  - Neon database used by the app
- `OPENSSL_API_URL`
  - OpenSSL backend service reachable from the VM / Docker network
- `NMAP_API_URL`
  - Nmap port-discovery backend service reachable from the VM / Docker network
- `SCAN_WORKER_PORT`
  - wake/control endpoint port
- `SCAN_WORKER_HEALTH_PORT`
  - health endpoint port
- `SCAN_WORKER_WAKE_SECRET`
  - bearer token the app uses to wake the worker
- `SCAN_WORKER_ACTIVE_*`
  - fast polling while active
- `SCAN_WORKER_IDLE_*`
  - slow polling while idle

## App-side Environment

The deployed app must also know how to wake the worker.

Set these in Vercel:

```env
SCAN_WORKER_WAKE_URL=https://your-vm-or-proxy.example.com/internal/wake
SCAN_WORKER_WAKE_SECRET=replace-with-the-same-secret-used-by-the-worker
SCAN_WORKER_WAKE_TIMEOUT_MS=1500
```

## First-Time VM Setup

Assumes Docker is already available on the VM.

Fresh setup:

```bash
git clone <your-repo-url>
cd quantwarden-ui
git checkout <branch-name>
cp .env.worker.example .env.worker
# edit .env.worker
docker compose -f worker/docker-compose.worker.yml up -d --build
```

If the repo already exists:

```bash
cd quantwarden-ui
git fetch origin
git checkout <branch-name>
git pull origin <branch-name>
cp .env.worker.example .env.worker  # only if .env.worker does not exist yet
# edit .env.worker if needed
docker compose -f worker/docker-compose.worker.yml up -d --build
```

## Day-to-Day Operations

From the repo root on the VM:

Start or recreate the worker:

```bash
docker compose -f worker/docker-compose.worker.yml up -d --build
```

Stop the worker:

```bash
docker compose -f worker/docker-compose.worker.yml down
```

Restart without rebuilding:

```bash
docker compose -f worker/docker-compose.worker.yml restart
```

Rebuild cleanly:

```bash
docker compose -f worker/docker-compose.worker.yml down
docker compose -f worker/docker-compose.worker.yml build --no-cache
docker compose -f worker/docker-compose.worker.yml up -d
```

Update after pulling new code:

```bash
git fetch origin
git checkout <branch-name>
git pull origin <branch-name>
docker compose -f worker/docker-compose.worker.yml down
docker compose -f worker/docker-compose.worker.yml up -d --build
```

If only `.env.worker` changed:

```bash
docker compose -f worker/docker-compose.worker.yml down
docker compose -f worker/docker-compose.worker.yml up -d
```

## Health and Debugging

Check container state:

```bash
docker compose -f worker/docker-compose.worker.yml ps
docker compose -f worker/docker-compose.worker.yml logs -f
```

Local health checks on the VM:

```bash
curl http://127.0.0.1:8089/healthz
curl http://127.0.0.1:8089/
```

Remote health check:

```bash
curl http://<vm-ip>:8089/healthz
```

Expected health response:

```json
{
  "ok": true,
  "status": "alive",
  "mode": "idle",
  "runningJobs": 0,
  "timestamp": "..."
}
```

Manual wake test:

```bash
curl -i -X POST "http://<vm-ip>:8088/internal/wake" \
  -H "Authorization: Bearer <SCAN_WORKER_WAKE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"manual_test","orgId":"test-org"}'
```

Expected wake response:

```json
{
  "ok": true,
  "mode": "active",
  "orgId": "test-org",
  "batchId": null
}
```

If wake fails:
- verify `.env.worker`
- verify `SCAN_WORKER_WAKE_SECRET`
- verify port `8088` is open and mapped
- verify app and worker use the exact same secret

## Docker Compose File

Worker compose file:
- [`worker/docker-compose.worker.yml`](docker-compose.worker.yml)

That file:
- builds the worker image from this repo
- publishes ports `8088` and `8089`
- reads envs from `../.env.worker`

If you merge this into another Docker stack, update:
- `env_file`
- service naming
- any Docker-network service URLs for `OPENSSL_API_URL` and `NMAP_API_URL`
