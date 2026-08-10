# QuantWarden MCP developer bridge

This optional developer tool exposes the scanner APIs as MCP tools. It is not required by the QuantWarden application.

Available tools include:

- Subfinder and Assetfinder discovery
- TCP port discovery
- OpenSSL profiling
- Legacy PySSL analysis
- Generic requests to configured scanner services

## Local setup

```bash
cd mcp-monorepo-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python server.py
```

## Docker profile

From `quantwarden-backend-main`:

```bash
docker compose --profile developer-tools up -d --build
```

The MCP process communicates with Subfinder, Nmap, OpenSSL, and optional PySSL through their internal service URLs.
