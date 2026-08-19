# QuantWarden

QuantWarden is a self-hosted cryptographic asset discovery, TLS analysis, CERT-In CBOM, and post-quantum readiness platform. This repository is the PNB Hackathon submission bundle and is prepared for evaluation followed by deployment assistance on infrastructure selected by PNB.

The application has no mandatory dependency on Azure, Vercel, Resend, Google OAuth, or another hosted SaaS. The reference deployment uses Docker Compose, but the same containers can run on a private cloud, another public cloud, an on-premises virtual machine, or an operator workstation.

> Only scan domains, addresses, and services that the deploying organization is authorized to assess. The scanning containers require network and DNS access to their approved targets.

## What is included

- Username and password authentication without an email dependency
- Optional verified-email authentication and invitations through any SMTP relay
- Organization membership, approval modes, roles, and super-administrator controls
- Subdomain discovery with Subfinder and Assetfinder
- Configurable TCP port discovery
- OpenSSL TLS, certificate, cipher, key-exchange, and PQC analysis
- Per-asset and per-port evidence views
- CERT-In CBOM inventory and exports
- PQC posture scoring and organization rollups
- On-demand, scheduled, and recurring scans
- Server-generated PDF reports and optional scheduled email delivery
- Authentication and organization audit logs with text export

## Architecture

QuantWarden uses a three-tier design. Durable application state is kept in PostgreSQL rather than in the application containers.

| Tier | Components | Responsibility |
| --- | --- | --- |
| Presentation and control | `quantwarden-ui` | Next.js interface, authentication, organization APIs, reporting, scan requests, and live progress streams |
| Execution | `quantwarden-worker`, `subfinder-api`, `nmap-api`, `openssl-api` | Scheduling, queue execution, subdomain discovery, port probing, TLS analysis, and result persistence |
| Data | `db`, `db-init` | PostgreSQL persistence and schema provisioning |

The UI never performs long-running scans in a request. It writes jobs to PostgreSQL and sends a best-effort authenticated wake request to the worker. The worker claims jobs, invokes the internal scanner services, and writes results back to PostgreSQL. This separation allows the UI and execution plane to be placed on different infrastructure when required.

### Runtime services

| Service | Internal port | Public by default | Notes |
| --- | ---: | --- | --- |
| `quantwarden-ui` | `3000` | Yes, through the configured host binding | The only application service users access |
| `quantwarden-worker` | `8088`, `8089` | No | Authenticated wake endpoint and health endpoint |
| `subfinder-api` | `8085` | No | Passive subdomain discovery |
| `nmap-api` | `8010` | No | TCP port discovery |
| `openssl-api` | `8020` | No | TLS, certificate, and PQC profiling |
| `db` | `5432` | No | PostgreSQL 15 |
| `caddy` | `80`, `443` | Production profile only | Optional HTTPS reverse proxy |
| `mailpit` | `8025` | Email-demo profile only | Local email capture; never use as a production relay |

## Deployment options

### 1. Docker Compose on one host - recommended reference deployment

This is the simplest path for evaluation, a private VM, or an on-premises server. It runs PostgreSQL, the UI, worker, scanners, and optional HTTPS proxy on one machine while keeping all scanner ports private.

Recommended starting capacity:

- 2 vCPU and 8 GB RAM for normal evaluation workloads
- 4 GB RAM is the practical minimum for a small demonstration with reduced concurrency
- 20 GB or more of persistent disk, expanded according to evidence retention and database backups
- Linux with a recent supported Docker Engine and Docker Compose v2

### 2. Containers on any orchestrator

The same Dockerfiles can be deployed to Kubernetes, OpenShift, Azure Container Apps, AWS ECS, Google Kubernetes Engine, Nomad, or another container scheduler. The platform does not require Compose service discovery as long as the environment variables point to reachable services. Platform-specific manifests are not included in this submission and should be produced from the contracts below using the target organization's approved templates.

Preserve these contracts:

1. The UI, worker, and schema initializer must use the same PostgreSQL database; run `db-init` to successful completion before starting the UI and worker.
2. The worker must reach the three scanner APIs over a private network.
3. The UI must reach the worker wake endpoint, and both must share `SCAN_WORKER_WAKE_SECRET`.
4. Only the UI or an approved ingress/reverse proxy should be internet-facing.
5. One worker replica must continuously run for scans, schedules, and automatic report emails. Keep a single worker unless multi-worker execution has been validated for the target release.
6. PostgreSQL must use persistent storage and an operational backup policy.
7. The UI image includes LaTeX because PDF reports are compiled server-side.

The included Compose database is convenient for a single host. A managed or existing PostgreSQL service can replace it by setting `DATABASE_URL` for `db-init`, `quantwarden-ui`, and `quantwarden-worker`, and omitting the bundled `db` service and its Compose dependencies in the target platform manifest. Use the database provider's required TLS parameters instead of the Compose-only `sslmode=disable` setting.

### 3. Developer or evaluator workstation

Docker Desktop on macOS, Windows, or Linux can run the same Compose stack. Use the HTTP quick start below. Mailpit is available as an optional local inbox.

## Quick start for local evaluation

From the repository root:

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

Open `http://localhost:3000`.

The example configuration is suitable only for local evaluation. Before allowing remote access, replace the database password, session secret, and worker wake secret.

To capture email locally:

```bash
docker compose --profile email-demo up -d --build
```

Mailpit is then available at `http://localhost:8025`. It captures messages locally and does not deliver them to real recipients.

## Production deployment on a VM or physical server

### 1. Prepare the host

Install Docker Engine and the Docker Compose plugin. Copy or check out this complete submission bundle to a stable path such as `/srv/quantwarden/app`.

For a public hostname with automatic Caddy certificates:

- create an `A` record, and an `AAAA` record if IPv6 is used, pointing to the host;
- allow inbound TCP ports `80` and `443`;
- allow outbound DNS, HTTPS, and connections to authorized scan targets;
- do not expose PostgreSQL or ports `8010`, `8020`, `8085`, `8088`, or `8089`.

### 2. Create the runtime configuration

```bash
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 24
```

Use the generated values for `BETTER_AUTH_SECRET`, `SCAN_WORKER_WAKE_SECRET`, and `POSTGRES_PASSWORD`. Update the password inside `DATABASE_URL` to the same value. If a password contains URL-sensitive characters, URL-encode it or use a hexadecimal password.

At minimum, review these production values:

```dotenv
POSTGRES_USER=quantwarden
POSTGRES_PASSWORD=<strong-database-password>
POSTGRES_DB=quantwarden
DATABASE_URL=postgresql://quantwarden:<same-password>@db:5432/quantwarden?sslmode=disable

NEXT_PUBLIC_APP_URL=https://quantwarden.example.org
BETTER_AUTH_URL=https://quantwarden.example.org
BETTER_AUTH_SECRET=<random-session-secret>

UI_BIND_ADDRESS=127.0.0.1
UI_PORT=3000
APP_DOMAIN=quantwarden.example.org
ACME_EMAIL=platform-operations@example.org

SCAN_WORKER_WAKE_URL=http://quantwarden-worker:8088/internal/wake
SCAN_WORKER_WAKE_SECRET=<independent-random-worker-secret>
```

`APP_DOMAIN` must contain only the hostname, without `https://` or a path. `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` must contain the complete external origin.

### 3. Select authentication and email behavior

Username/password authentication is enabled by default and does not require SMTP:

```dotenv
USERNAME_AUTH_ENABLED=true
USERNAME_EMAIL_DOMAIN=accounts.quantwarden.internal
EMAIL_AUTH_ENABLED=false
```

Username accounts are internally backed by deterministic synthetic addresses such as `pnb-admin@accounts.quantwarden.internal`. Users continue to sign in with their usernames.

Choose `USERNAME_EMAIL_DOMAIN` before creating accounts and treat it as persistent identity configuration; changing it later changes how usernames map to internal identities.

To enable verified-email OTP/magic-link authentication, email invitations, and optional scheduled report delivery, connect any standards-compliant SMTP relay:

```dotenv
EMAIL_AUTH_ENABLED=true
SMTP_HOST=smtp.example.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<relay-user-if-required>
SMTP_PASS=<relay-password-if-required>
SMTP_FROM=QuantWarden <no-reply@example.org>
```

Use `SMTP_SECURE=true` for implicit TLS, normally on port `465`. Port `587` normally uses STARTTLS with `SMTP_SECURE=false`. Changing `EMAIL_AUTH_ENABLED` requires rebuilding the UI image because it is both a build-time and runtime option.

QuantWarden uses SMTP directly. A bank-operated relay can replace a public email provider without code changes. Google OAuth and Resend are not required.

Automatic report emails are opt-in and disabled until an administrator creates and enables a schedule. Do not enable them until SMTP delivery has been tested.

### 4. Bootstrap a super administrator

`SUPER_ADMIN_EMAILS` is a comma-separated bootstrap allowlist. For an email account, use its verified address. For a username account, use its synthetic address:

```dotenv
SUPER_ADMIN_EMAILS=pnb-admin@accounts.quantwarden.internal
```

After `pnb-admin` registers and signs in, the administration console becomes available. A super administrator can grant or revoke database-backed super-administrator access for other accounts. Keep at least one controlled bootstrap identity and protect the `.env` file.

### 5. Start HTTPS production services

After DNS points to the host:

```bash
docker compose --profile production up -d --build
docker compose ps
docker compose logs --tail=100 caddy quantwarden-ui quantwarden-worker
```

Caddy obtains and renews the certificate for `APP_DOMAIN`. Verify the public endpoint:

```bash
curl --fail --show-error https://quantwarden.example.org/api/auth/methods
```

If the organization already provides an ingress controller, load balancer, web application firewall, or TLS terminator, omit the `production` profile and proxy the approved private UI binding to port `3000`. Preserve the original `Host` and standard forwarded headers, and set both application URL variables to the public HTTPS origin.

## Configuration reference

### Core settings

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection used by UI, worker, and schema initialization |
| `NEXT_PUBLIC_APP_URL` | Yes | Browser-visible application origin |
| `BETTER_AUTH_URL` | Yes | Authentication callback origin; normally identical to the public app URL |
| `BETTER_AUTH_SECRET` | Yes | Session-signing secret |
| `SCAN_WORKER_WAKE_URL` | Yes | Internal UI-to-worker wake URL |
| `SCAN_WORKER_WAKE_SECRET` | Yes | Shared bearer secret protecting wake requests |
| `USERNAME_AUTH_ENABLED` | No | Enables username/password auth; defaults to `true` |
| `USERNAME_EMAIL_DOMAIN` | No | Internal namespace for username identities |
| `EMAIL_AUTH_ENABLED` | No | Enables email authentication when SMTP is configured; defaults to `false` |
| `SUPER_ADMIN_EMAILS` | No | Bootstrap super-administrator identities |

The internal Compose URLs in `.env.example` are already correct. Change them only when services move to different networks or hosts:

```dotenv
OPENSSL_API_URL=http://openssl-api:8020
NMAP_API_URL=http://nmap-api:8010
SUBFINDER_API_URL=http://subfinder-api:8085
SCAN_WORKER_WAKE_URL=http://quantwarden-worker:8088/internal/wake
```

### Optional discovery-provider credentials

`FB_APP_ID`, `FB_APP_SECRET`, `VT_API_KEY`, and `SPYSE_API_TOKEN` can improve passive discovery coverage when the corresponding sources are available. Core scanning remains operational without them.

### Worker capacity

| Variable | Default | Purpose |
| --- | ---: | --- |
| `SCAN_WORKER_ACTIVE_EXECUTOR_TICK_MS` | `1500` | Job polling interval while active |
| `SCAN_WORKER_ACTIVE_SCHEDULER_TICK_MS` | `10000` | Schedule polling interval while active |
| `SCAN_WORKER_IDLE_SCHEDULER_TICK_MS` | `60000` | Schedule polling interval while idle |
| `SCAN_WORKER_MAX_CONCURRENT_JOBS` | `6` | Global concurrent scan-item cap |
| `SCAN_WORKER_MAX_CONCURRENT_JOBS_PER_ORG` | `2` | Per-organization fairness cap |
| `OPENSSL_API_TIMEOUT_SECONDS` | `3` | Per-probe OpenSSL timeout |
| `OPENSSL_API_REQUEST_TIMEOUT_MS` | `15000` | Worker-to-OpenSSL API request timeout |
| `OPENSSL_API_PROBE_BATCH_SIZE` | `10` | Parallel OpenSSL probes inside a scan item |

For a 2 vCPU/4 GB machine, begin conservatively:

```dotenv
SCAN_WORKER_MAX_CONCURRENT_JOBS=2
SCAN_WORKER_MAX_CONCURRENT_JOBS_PER_ORG=1
OPENSSL_API_PROBE_BATCH_SIZE=4
```

Increase concurrency only after monitoring memory, CPU, open file descriptors, network capacity, target rate limits, and scan duration.

## Database provisioning and persistence

The `postgres_data` named volume contains the database. `docker compose down` preserves it. **Do not run `docker compose down -v` unless permanent database deletion is intended.** Caddy certificate state is similarly stored in `caddy_data` and `caddy_config`.

`db-init` runs `prisma db push --accept-data-loss` from the current Prisma schema. Some scheduling and username-auth tables or columns are also created idempotently at runtime. Therefore:

- back up PostgreSQL before every application/schema upgrade;
- review schema differences before introducing production data;
- use a controlled migration process for a regulated long-term deployment;
- test upgrades and restores in a non-production environment first.

### Backup

Create a PostgreSQL custom-format backup from the repository root:

```bash
mkdir -p backups
docker compose exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/quantwarden.dump
```

Copy backups away from the application host and apply the organization's encryption, retention, and access-control policies.

### Restore

Restoring with `--clean` replaces matching objects. Stop the UI and worker, verify the target database, and take a fresh backup first:

```bash
docker compose stop quantwarden-ui quantwarden-worker
docker compose exec -T db sh -lc 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/quantwarden.dump
docker compose start quantwarden-ui quantwarden-worker
```

## Health checks and operations

### Status and logs

```bash
docker compose ps
docker compose logs --tail=200
docker compose logs -f quantwarden-worker nmap-api openssl-api subfinder-api
```

### Internal service checks

```bash
docker compose exec quantwarden-worker node -e "fetch('http://127.0.0.1:8089/healthz').then(r => r.text()).then(console.log)"
docker compose exec nmap-api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8010/').read().decode())"
docker compose exec openssl-api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8020/').read().decode())"
```

The worker response includes its active/idle mode, running job count, and concurrency limits. A healthy UI can be checked without authentication at `/api/auth/methods`.

### Restart and stop

```bash
docker compose restart quantwarden-ui quantwarden-worker
docker compose stop
docker compose down
```

## Upgrades and rollback

For a source-based installation:

1. Back up PostgreSQL.
2. Stage the new release or submission bundle.
3. Review `.env.example`, Compose, and schema changes.
4. Build and start the new containers.
5. Verify authentication, worker health, a controlled test scan, PDF generation, and SMTP if enabled.

```bash
docker compose build --pull
docker compose --profile production up -d --remove-orphans
```

For an image-based deployment, pin every application image to the same immutable release or commit tag. The included `docker-compose.production.yml` replaces local builds with images from `IMAGE_REGISTRY` at `IMAGE_TAG`.

Application rollback means restoring the previous image set. Database rollback may also require a compatible database backup; do not assume an older application can read a schema changed by a newer release.

## CI/CD

The included GitHub Actions workflow at `.github/workflows/pipeline.yml` provides the current reference pipeline:

- pull requests and pushes to `main` run the UI build, worker TypeScript check, Nmap API tests, and Go scanner tests;
- successful `main` builds publish commit-tagged application images to GitHub Container Registry;
- VM deployment is opt-in through `AZURE_DEPLOY_ENABLED=true`;
- the VM receives only deployment manifests, pulls immutable images, recreates services, and verifies `/api/auth/methods`.

Configure these GitHub repository or environment values when using the bundled Azure job:

| Type | Name | Purpose |
| --- | --- | --- |
| Variable | `AZURE_DEPLOY_ENABLED` | Set to `true` to enable deployment |
| Variable | `AZURE_VM_HOST` | VM hostname or IP; override the demonstration default |
| Variable | `AZURE_VM_USER` | SSH account |
| Variable | `APP_URL` | Public HTTPS origin used for post-deploy verification |
| Secret | `AZURE_VM_SSH_KEY` | Private deployment key |

GitHub secret values cannot be viewed again in the UI after saving; they can only be replaced or deleted. Store the source key in the deployment team's approved secret manager and rotate it according to policy.

The Azure step is only an example delivery target. For another CI system or on-premises registry, retain the same sequence:

1. Run `npm ci`, `npm run lint`, `npm run worker:check`, and `npm run build` in `quantwarden-ui-main`.
2. Run `pytest` in `quantwarden-backend-main/nmap-api`.
3. Run `go test ./...` in `quantwarden-backend-main/subfinder-api`.
4. Build and scan the six application images.
5. Publish immutable, signed images to the approved registry.
6. Back up the database, deploy the pinned image set, and run the health checks.

## Building images independently

Compose is the canonical build definition. Platforms that require separately published images can build the same targets:

```bash
docker build --target db-init -t registry.example/quantwarden-db-init:release quantwarden-ui-main
docker build --target runner -t registry.example/quantwarden-ui:release quantwarden-ui-main
docker build -f quantwarden-ui-main/worker/Dockerfile -t registry.example/quantwarden-worker:release quantwarden-ui-main
docker build -t registry.example/quantwarden-subfinder-api:release quantwarden-backend-main/subfinder-api
docker build -t registry.example/quantwarden-nmap-api:release quantwarden-backend-main/nmap-api
docker build -t registry.example/quantwarden-openssl-api:release quantwarden-backend-main/openssl-api
```

When email authentication is enabled, pass `--build-arg EMAIL_AUTH_ENABLED=true` while building the UI `runner` target.

## Security hardening checklist

- Place the UI behind HTTPS; never publish scanner, worker, or database ports.
- Store `.env`, SMTP credentials, registry credentials, and SSH keys in an approved secret manager.
- Use an independent high-entropy value for each secret.
- Restrict outbound scanning to approved scopes and network segments.
- Apply host, container-runtime, image-scanning, patching, logging, and time-synchronization policies.
- Back up and test PostgreSQL restores.
- Review super-administrator membership and exported audit logs regularly.
- Apply retention rules to scan evidence, audit data, generated reports, and backups.
- Replace the reference `db push` process with reviewed migrations before a regulated production rollout.
- Keep passive-discovery API tokens optional and scoped to the minimum required privileges.

## Troubleshooting

### UI is unavailable

```bash
docker compose ps
docker compose logs --tail=200 quantwarden-ui db-init db caddy
```

Check that `db-init` completed successfully, the database password in `DATABASE_URL` matches `POSTGRES_PASSWORD`, and the public URL variables use the exact deployed origin.

### Scans remain waiting

```bash
docker compose logs --tail=300 quantwarden-worker nmap-api openssl-api subfinder-api
docker compose exec quantwarden-worker node -e "fetch('http://127.0.0.1:8089/healthz').then(r => r.text()).then(console.log)"
```

Confirm the UI and worker share `SCAN_WORKER_WAKE_SECRET`, internal service URLs resolve on the container network, the worker is running continuously, and the host can reach the authorized target.

### HTTPS certificate is not issued

Confirm DNS points to the host, ports `80` and `443` reach Caddy, `APP_DOMAIN` is a bare hostname, and inspect `docker compose logs caddy`. Internal-only deployments should use the organization's existing internal CA or ingress instead of public ACME.

### Email is not delivered

Verify the SMTP hostname from inside the UI and worker networks, credentials, sender policy, port, TLS mode, and relay allowlisting. Rebuild the UI after changing `EMAIL_AUTH_ENABLED`. Mailpit is only for local capture.

### PDF generation fails

The production UI image already includes `pdflatex` and the required LaTeX packages. Rebuild the UI image after reporting-template changes and inspect `quantwarden-ui` logs. Non-container local development requires a compatible `pdflatex` on `PATH`; `LATEX_BIN` may point to a non-standard executable location.

## Repository layout

- `docker-compose.yml` - portable source-build stack
- `docker-compose.production.yml` - immutable image override used by CI/CD
- `deploy/Caddyfile` - optional automatic HTTPS entrypoint
- `.env.example` - complete Compose environment template
- `quantwarden-ui-main/` - Next.js control plane, shared libraries, Prisma schema, and Node scan worker
- `quantwarden-backend-main/` - Go Subfinder service and Python scanner APIs
- `USER_GUIDE.md` - end-user operating guide
- `CLAUDE.md` - deeper developer architecture and data-model notes

For deployment assistance after hackathon evaluation, begin with the reference Compose topology, record the target infrastructure's ingress, database, SMTP, registry, backup, and network-control requirements, and then map the service contracts above without changing application behavior.
