# QuantWarden Deployment Guide

QuantWarden runs as a lean Docker Compose stack with a Next.js control plane, a background scan worker, PostgreSQL, and three internal scanning services.

## Prerequisites

- Docker Engine
- Docker Compose v2
- A VM with at least 4 GB RAM recommended for multi-asset scans

## Start the platform

```bash
cp .env.example .env
docker compose up -d --build
```

Open `http://<server-ip>:3000`.

Before deployment, replace `BETTER_AUTH_SECRET` and `SCAN_WORKER_WAKE_SECRET` in `.env`. Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to the URL users will open.

## Default services

| Service | Purpose |
| --- | --- |
| `quantwarden-ui` | Next.js portal and authenticated API |
| `quantwarden-worker` | Scan scheduling, execution, and workflow progression |
| `db` | PostgreSQL data store |
| `db-init` | One-time Prisma schema provisioning |
| `subfinder-api` | Subfinder and Assetfinder subdomain discovery |
| `nmap-api` | TCP port discovery |
| `openssl-api` | TLS, certificate, and PQC analysis |

Only port `3000` is published by default. PostgreSQL, the worker, and scanning APIs communicate over the private Compose network.

## PDF reporting

The Reporting screen generates PDFs entirely on the `quantwarden-ui` server. The browser sends the selected title, subtitle, and report sections; the authenticated API queries fresh scan data and compiles a native A4 document with LaTeX. The Docker image includes `pdflatex`, so there is no browser canvas capture or HTML-to-image rendering step.

After changing reporting code or the LaTeX template, rebuild the UI container:

```bash
docker compose up -d --build quantwarden-ui
```

Local development outside Docker requires a `pdflatex` binary on `PATH`. Set `LATEX_BIN` only when the executable is installed at a non-standard path.

OneForAll is not part of the stack. Subdomain discovery uses the Go Subfinder service and its built-in Assetfinder source.

## Authentication and email

Username and password authentication is enabled by default and requires no email infrastructure.

Email authentication is optional. For a real deployment, set `EMAIL_AUTH_ENABLED=true` and configure an SMTP relay in `.env`, then rebuild the UI.

For local email testing, start the `email-demo` profile:

```bash
docker compose --profile email-demo up -d --build
```

Mailpit is then available at `http://<server-ip>:8025`.

## Scan concurrency

The worker uses bounded concurrency to prevent large onboarding scans from exhausting the host.

| Variable | Default | Purpose |
| --- | ---: | --- |
| `SCAN_WORKER_MAX_CONCURRENT_JOBS` | `6` | Maximum scan items running across all organizations |
| `SCAN_WORKER_MAX_CONCURRENT_JOBS_PER_ORG` | `2` | Maximum scan items running for one organization |
| `OPENSSL_API_PROBE_BATCH_SIZE` | `10` | Maximum parallel OpenSSL probes within one scan item |

Lower these values on small VMs. Increase them only after monitoring CPU, memory, file descriptors, and scan duration.

## Management commands

```bash
docker compose ps
docker compose logs -f
docker compose stop
docker compose down
docker compose up -d --build
```

To inspect an internal service:

```bash
docker compose exec quantwarden-worker node -e "fetch('http://127.0.0.1:8089/healthz').then(r => r.text()).then(console.log)"
docker compose exec nmap-api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8010/').read().decode())"
```

## Project structure

- `quantwarden-ui-main/`: Next.js portal and Node.js scan worker
- `quantwarden-backend-main/`: Go and Python scanning services
- `docker-compose.yml`: Production-oriented Compose stack
- `USER_GUIDE.md`: End-user operating guide
