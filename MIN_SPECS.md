# QuantWarden — Minimum Specs

Grounded in measured container memory (idle), image sizes on disk, and the actual scan workload (bounded probe batches, not full-range nmap). Numbers are for the full `docker-compose` stack on a single host.

---

## Server side (single host running all 10 containers)

### Measured idle memory (no scans running)

| Container | Idle RAM | Notes |
|---|---|---|
| quantwarden-ui | ~256 MB | Next.js prod runtime, Node 22 |
| quantwarden-worker | ~213 MB | Node, two loops, idle mode |
| oneforall-api | ~104 MB | Python + OneForAll; spikes hardest during enumeration |
| openssl-api | ~45 MB | Python/FastAPI |
| pyssl-api | ~40 MB | Python/FastAPI |
| mcp-monorepo-server | ~42 MB | Python, optional for UI |
| nmap-api | ~35 MB | Python; `nmap` CLI spawned per scan |
| subfinder-api | ~27 MB | Go binary |
| db (postgres:15) | ~25 MB cold | Grows to 200–500 MB under scan load |
| mailpit | ~16 MB | Go, demo only |
| **Total idle** | **~0.8 GB** | |

### Under load
- **OneForAll** is the spike leader: concurrent DNS resolution + HTTP crawling across many subdomain sources can push it to ~400–800 MB during an active enumeration.
- **nmap-api** is bounded by config: max 10 probes per batch, max 2000 ms timeout, default port preset (not full 0–65535). Per-scan memory stays modest (~50–150 MB including the `nmap` child process).
- **openssl-api** is bounded: 10 probes per batch, 3 s timeout. Light.
- **Postgres** grows with concurrent connections + `work_mem` per query + JSON `resultData` writes. Expect 200–500 MB during active scanning.
- **Worker + UI** stay roughly flat; they're I/O-bound, not CPU-bound.

### Build peak (the real memory ceiling)
`docker-compose up --build` runs multi-stage builds. The UI image (1.73 GB) runs `npm ci` (~1 GB `node_modules`) + `next build` across ~150 routes. The `next build` step alone can use **1.5–2 GB** RAM. The worker image (1.56 GB) compiles TS. Build is the peak — if you build on the same host you serve from, size for build, not just runtime.

### Disk

| Item | Size |
|---|---|
| Docker images (unique layers, deduped) | ~5 GB |
| UI `node_modules` (in build stage, transient) | ~1 GB |
| OneForAll data files (baked into image) | ~53 MB |
| Postgres data volume (starts empty) | grows with scan results |
| Buildkit cache | 1–3 GB |
| **Total to start** | **~8–10 GB** |

### Minimums

| Tier | vCPU | RAM | Disk | When |
|---|---|---|---|---|
| **Absolute min (demo)** | 2 | 4 GB | 20 GB | Build first (`docker-compose build`), then `up`. Small org, a few assets, small domains. OneForAll on a large zone may OOM. |
| **Recommended (real use)** | 4 | 8 GB | 40 GB | Build + run on same box comfortably. Concurrent scans, larger asset counts, headroom for OneForAll spikes. |
| **Split build/run** | 2 | 2 GB | 10 GB | Build images elsewhere, push to registry, run-only host. Runtime idle ~0.8 GB + scan headroom. |

### OS / platform
- Docker Engine + Compose plugin (v2). Tested on Ubuntu (per `README_DEPLOY.md`); also runs on macOS/Windows via Docker Desktop.
- Node 22 inside containers (`.node-version`: 22.22.2) — no host Node required for Docker flow.
- For **local dev without Docker** (`npm run dev`): Node 22 on host, a reachable Postgres (5432), and the backend APIs running via `python3 start_monorepo_servers.py`. Dev server is lighter on RAM than a prod build but needs the same backing services.

### Network
- Outbound internet egress is required for **actual scanning** (DNS resolution, TLS handshakes to target hosts). The platform UI itself is local-only.
- Inbound: only host port 3000 (UI) needs to be reachable by users. 8025 (Mailpit) optional for demo. 5432 (db) and the backend API ports are for debugging.

---

## Client side (browser)

### What the client runs
A Next.js 15 / React 19 SPA. First-load shared JS is ~102 KB; page-specific chunks range up to ~400 KB (heavier pages: asset explorer, dashboard, reporting). Total JS for a heavy page: ~500–600 KB.

Client-side libraries that matter for resource use:
- **recharts** — chart rendering (dashboard/posture pages)
- **framer-motion** — animations
- **jspdf + html2canvas + html-to-image** — client-side PDF/image report generation (memory spike during export)
- **EventSource (SSE)** — one persistent connection per org for live scan progress

### Minimums

| Requirement | Minimum | Recommended |
|---|---|---|
| Browser | Evergreen Chrome/Firefox/Safari/Edge (last 2 versions). Needs `EventSource` support — all modern browsers have it. | Same |
| Device RAM | 4 GB device (browser tab ~200–400 MB) | 8 GB device |
| CPU | Any modern dual-core | — |
| Network to server | Broadband (UI assets are small; SSE needs a stable connection) | — |
| Screen | Responsive down to mobile, but designed for desktop dashboards | 1280×800+ |

### Notes
- Report PDF export is the heaviest client operation: `html2canvas` rasterizes the report DOM into a canvas, then `jspdf` encodes it. For large reports this can briefly use a few hundred MB of tab memory. Not a steady-state cost.
- The UI degrades gracefully when backend scan services are down (toasts surface "service unavailable", SSE `service_unavailable` events with countdown). So a weak client doesn't break the app — it just shows fewer live updates.

---

## What you do NOT need
- No Google OAuth, no Resend, no external email SaaS — mail is optional (Mailpit for demo, or unset `SMTP_HOST` for guest-only).
- No external message broker (Redis/RabbitMQ) — Postgres is the queue.
- No CDN or object storage — assets/scan results live in Postgres.
- No paid API keys for basic operation — subfinder tokens (FB/VT/Spyse) are optional and blank by default; subdomain discovery still works via OneForAll + assetfinder + subfinder passive sources.
