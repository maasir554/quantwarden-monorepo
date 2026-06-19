# subfinder-api

Minimal Go REST API skeleton. Current behavior exposes a root health endpoint confirming the server is running on port 8085.

## Run

```bash
cd subfinder-api
go run .
```

Why this command: the server is split across multiple files in the same package, so `go run .` includes all package files.

## Environment variables

The API supports loading variables from a local `.env` file using `godotenv`.

Supported keys:

- `ONEFORALL_API_URL`: optional base URL for the external OneForAll-like API (example: `http://localhost:8002`).

Example `.env`:

```env
ONEFORALL_API_URL=http://localhost:8002
```

## Check

```bash
curl -i http://localhost:8085/
```

Expected response:

```json
{"status":"ok","service":"subfinder-api"}
```

## Discover subdomains (combined)

POST to `/subdomains` with a JSON body containing the root domain. This route runs subfinder + assetfinder in parallel and also tries an optional OneForAll endpoint (`ONEFORALL_API_URL/subdomains`), merges/deduplicates output, and returns a unified list.

If a tool times out (60s cap) or fails, the route falls back to partial results and includes a clear `message` and `timed_out_tools` list.

If OneForAll is not configured or not reachable, the route skips it and returns:

- `info: "one-for-all api not connected"`

```bash
curl -i -X POST http://localhost:8085/subdomains \
	-H "Content-Type: application/json" \
	-d '{"domain":"example.com"}'
```

Example response:

```json
{
	"domain": "example.com",
	"count": 2,
	"subdomains": [
		"a.example.com",
		"b.example.com"
	],
	"sources": {
		"subfinder": 1,
		"assent": 1,
		"oneforall": 0
	},
	"info": "one-for-all api not connected",
	"message": "assetfinder timed out",
	"timed_out_tools": ["assetfinder"]
}
```

## Discover subdomains with subfinder only

POST to `/subfinder` with the same JSON body shape. This route uses only the embedded subfinder engine.

```bash
curl -i -X POST http://localhost:8085/subfinder \
	-H "Content-Type: application/json" \
	-d '{"domain":"example.com"}'
```

## Discover subdomains with assetfinder

POST to `/assetfinder` with the same JSON body shape. This endpoint uses an in-project Assetfinder-style source runner (no external assetfinder binary required).

Note: the upstream `tomnomnom/assetfinder` module is CLI-only, so this route embeds equivalent source-fetch logic directly in the API service.

```bash
curl -i -X POST http://localhost:8085/assetfinder \
	-H "Content-Type: application/json" \
	-d '{"domain":"example.com"}'
```

Response shape:

```json
{
	"domain": "example.com",
	"subdomains": [
		"a.example.com",
		"b.example.com"
	]
}
```
