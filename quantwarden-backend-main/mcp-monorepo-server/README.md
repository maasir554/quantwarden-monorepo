# QuantWarden MCP Server

Stateless MCP server that lets AI agents call your monorepo backend APIs.

## Exposed tools

- `list_services`
- `check_services_health`
- `nmap_port_discovery`
- `pyssl_analysis`
- `openssl_profile`
- `subfinder_combined`
- `subfinder_only`
- `assetfinder_only`
- `monorepo_api_request` (generic HTTP wrapper)

## Prerequisites

1. Python 3.10+
2. Monorepo backend services running (recommended via `python3 start_monorepo_servers.py`)

## Setup

```bash
cd mcp-monorepo-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run (stdio MCP server)

```bash
cd mcp-monorepo-server
source .venv/bin/activate
python server.py
```

## Optional service URL overrides

Default URLs:

- `ONEFORALL_API_URL=http://127.0.0.1:8002`
- `SUBFINDER_API_URL=http://127.0.0.1:8085`
- `PYSSL_API_URL=http://127.0.0.1:8000`
- `NMAP_API_URL=http://127.0.0.1:8010`
- `OPENSSL_API_URL=http://127.0.0.1:8020`

Set env vars before launch if ports differ.

```bash
ONEFORALL_API_URL=http://127.0.0.1:9002 \
SUBFINDER_API_URL=http://127.0.0.1:9085 \
PYSSL_API_URL=http://127.0.0.1:9000 \
NMAP_API_URL=http://127.0.0.1:9010 \
OPENSSL_API_URL=http://127.0.0.1:9020 \
python server.py
```

## Ready-To-Use Client Configs

Prebuilt config templates are available in `config-examples/`:

- `config-examples/claude_desktop_config.json`
- `config-examples/cursor_mcp.json`

Workspace config for VS Code is also included at:

- `../.vscode/mcp.json`

### Claude Desktop

1. Open your Claude Desktop MCP config file.
2. Merge in `config-examples/claude_desktop_config.json` under `mcpServers`.
3. Replace `<ABSOLUTE_PATH_TO_REPO>` with your real repo path.
4. Restart Claude Desktop.

### Cursor

1. Open Cursor MCP settings/config.
2. Paste `config-examples/cursor_mcp.json`.
3. Replace `<ABSOLUTE_PATH_TO_REPO>` with your real repo path.
4. Restart Cursor.

### VS Code (workspace)

The workspace already includes `.vscode/mcp.json` configured for this machine path.
If your repo path differs, update the `command` and `args` paths.
