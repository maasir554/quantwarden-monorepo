# QuantWarden minimum specifications

These figures cover the seven-service default Compose stack on one host. Mailpit is optional and OneForAll, PySSL, and MCP are not part of the product runtime.

## Host sizing

| Deployment | CPU | RAM | Free disk | Intended use |
| --- | ---: | ---: | ---: | --- |
| Small demo | 2 vCPU | 4 GB | 20 GB | One small organization and limited concurrent scans |
| Recommended | 4 vCPU | 8 GB | 40 GB | Normal onboarding and multiple organizations |
| Higher throughput | 8 vCPU | 16 GB | 80 GB | Larger inventories and sustained scanning |

Docker image builds need more memory and disk than the steady-state containers. Build on a separate CI host if the deployment VM is smaller than the recommended specification.

## Resource controls

The worker defaults to:

- 6 concurrent scan items globally
- 2 concurrent scan items per organization
- 10 OpenSSL probes within each TLS scan item
- 5 port probes within each port-discovery item

On a 4 GB host, start with 3 global jobs, 1 job per organization, and 5 OpenSSL probes. Increase the limits only after observing memory, CPU, open file descriptors, and scan duration.

## Network requirements

Only the Next.js portal on TCP port 3000 is published by default. The following ports are private inside the Compose network:

| Port | Service |
| ---: | --- |
| 5432 | PostgreSQL |
| 8088 | Worker wake endpoint |
| 8089 | Worker health endpoint |
| 8085 | Subfinder API |
| 8010 | Port discovery API |
| 8020 | OpenSSL API |

The scanner host requires outbound DNS, HTTP, HTTPS, and target-port access. Restrict inbound access to the web portal or a reverse proxy.

## Browser requirements

Use a current Chromium, Firefox, or Safari release with JavaScript and Server-Sent Events enabled. A minimum viewport width of 1280 pixels is recommended for the full dashboard.
