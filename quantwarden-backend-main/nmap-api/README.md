# Nmap Port Discovery API

A FastAPI service that probes requested TCP ports against a target using a sliding concurrency window.

## What Changed

- The previous Nmap security-intelligence endpoints are gone.
- The API now exposes a single stateless port-discovery endpoint.
- The implementation uses native async TCP connect probes rather than the `nmap` CLI.
- IPv4, IPv6, and domain targets are supported.

## Project Structure

```text
nmap-api/
  main.py
  requirements.txt
  README.md
  scripts/
    setup.sh
    run.sh
  src/
    nmap_api/
      __init__.py
      probe_engine.py
      schemas.py
      service.py
  tests/
    test_port_discovery.py
```

## Prerequisites

1. Python 3.13 or 3.12

## Setup

```bash
cd nmap-api
bash scripts/setup.sh
```

If your default `python3` is 3.14, run setup with an explicit interpreter:

```bash
cd nmap-api
PYTHON_BIN=python3.13 bash scripts/setup.sh
```

## Run

```bash
cd nmap-api
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8010 --reload
```

Quick run script:

```bash
cd nmap-api
bash scripts/run.sh
```

Health check:

```bash
curl http://localhost:8010/
```

## API Usage

### POST `/api/v1/port-discovery`

Request body:

```json
{
  "target": "example.com",
  "port_list": [22, 80, 443],
  "port_ranges": [
    {
      "start": 8000,
      "end": 8100
    },
    {
      "start": 8443,
      "end": 8445
    }
  ],
  "probe_batch_size": 40,
  "probe_timeout_ms": 500
}
```

Rules:

- `target` accepts a domain, IPv4 literal, or IPv6 literal.
- `port_list` and `port_ranges` can be used together.
- At least one of `port_list` or `port_ranges` is required.
- Port inputs are validated to `1..65535`.
- Inputs are unioned, deduplicated, and sorted before probing.
- `probe_batch_size` defaults to `40`.
- `probe_timeout_ms` defaults to `500`.
- Domains are resolved across all returned IPv4 and IPv6 addresses.
- The response returns open ports only.

Example:

```bash
curl -X POST http://localhost:8010/api/v1/port-discovery \
  -H "Content-Type: application/json" \
  -d '{
    "target": "example.com",
    "port_list": [80, 443],
    "port_ranges": [
      {"start": 8080, "end": 8082},
      {"start": 9000, "end": 9001}
    ]
  }'
```

Example response:

```json
{
  "target": "example.com",
  "resolved_addresses": ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"],
  "protocol": "tcp",
  "requested_port_count": 5,
  "probed_port_count": 5,
  "probe_batch_size": 5,
  "probe_timeout_ms": 500,
  "open_ports": [
    {
      "port": 80,
      "addresses": ["93.184.216.34"]
    },
    {
      "port": 443,
      "addresses": ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]
    }
  ]
}
```

## IPv6 Notes

- Literal IPv6 targets are accepted directly, for example `2001:4860:4860::8888`.
- When a hostname resolves to both A and AAAA records, the API probes all resolved addresses.
- The service is TCP-only in v1. UDP is intentionally excluded because timeout-only semantics are not reliable for UDP reachability.

## Tests

Run:

```bash
cd nmap-api
source .venv/bin/activate
pytest
```

## Security Considerations

- Scan only targets you own or are authorized to test.
- Open-port discovery can still be sensitive in some environments.
