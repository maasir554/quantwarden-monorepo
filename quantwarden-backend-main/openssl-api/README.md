# OpenSSL API

Deep OpenSSL CLI-based TLS profiling service.

## Endpoint

- `POST /api/v1/openssl-profile`

## Request body

```json
{
  "target": "example.com",
  "port": 443,
  "timeout_seconds": 3,
  "probe_batch_size": 10,
  "include_raw_debug": false
}
```
timeout of 3 secs per probe is generally enough for public servers. maximum recommend is 5 secs.

## Notes

- Always runs in deep profile mode.
- Supports domain, IPv4, and IPv6 targets.
- Probes are executed with a sliding window. `probe_batch_size` controls max concurrent in-flight probes (default `10`).
- Response includes TLS version support, accepted ciphers in offer order, suite decomposition, certificate summary, and OIDs.
- Response also includes:
  - `certificate_chain`: parsed summaries for all certificates returned by `openssl s_client -showcerts` (leaf first).
  - `queried_groups`: all TLS 1.3 groups supported by the local OpenSSL binary.
  - `supported_groups`: final list of server-detected TLS groups after active probing.
  - `identifiers`: map-like section of names with `oid` or `iana_code` (when known) for certificate algorithms, TLS groups, and TLS cipher suites.
    - For `tls_cipher_suites`, `oid` is derived from the suite components (encryption/hash/auth), because a full TLS cipher suite does not have a single universal ASN.1 OID.
- Set `include_raw_debug=true` to include executed command strings and clipped command outputs.
- `timeout_seconds` is applied per OpenSSL command; it is not a total request deadline.

## Run locally

```bash
cd openssl-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8020 --reload
```
