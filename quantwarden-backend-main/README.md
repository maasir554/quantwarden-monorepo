# QuantWarden scanning services

The production scan path uses three stateless services:

| Service | Port | Purpose |
| --- | ---: | --- |
| `subfinder-api` | 8085 | Subfinder and built-in Assetfinder discovery |
| `nmap-api` | 8010 | TCP port discovery |
| `openssl-api` | 8020 | TLS, certificate, and PQC profiling |

OneForAll has been removed from the runtime because its discovery behavior was unreliable. PySSL is retained only as a developer tool and is not used by the application scan flow.

## Docker Compose

Start the core backend services:

```bash
docker compose up -d --build
```

Start the optional PySSL and MCP developer tools as well:

```bash
docker compose --profile developer-tools up -d --build
```

## Local launcher

The launcher starts Subfinder, port discovery, and OpenSSL with automatic port conflict handling:

```bash
python3 start_monorepo_servers.py
```

Use `--setup` for interactive port selection.

```bash
python3 start_monorepo_servers.py --setup
```

The launcher looks for `.venv/bin/python` or `venv/bin/python` inside each Python service and falls back to `python3`.

## Run one service

```bash
cd subfinder-api
SUBFINDER_API_ADDR=:8085 go run .
```

```bash
cd nmap-api
python3 -m uvicorn main:app --host 0.0.0.0 --port 8010 --reload
```

```bash
cd openssl-api
python3 -m uvicorn main:app --host 0.0.0.0 --port 8020 --reload
```

## Health checks

```bash
curl http://127.0.0.1:8085/
curl http://127.0.0.1:8010/
curl http://127.0.0.1:8020/
```

## Tests

The backend test suite is under `nmap-api`:

```bash
cd nmap-api
pytest
```
