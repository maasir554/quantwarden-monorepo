# PySSL API - Domain SSL Analyzer

A FastAPI-based REST API that accepts a domain name and returns comprehensive SSL/TLS certificate and cryptographic information in JSON format.

## Prerequisites

- Python 3.10+

## Setup & Installation

1. Creating a virtual environment (Recommended):
```bash
python3 -m venv venv
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Features

- Extracts complete X.509 certificate data using pure Python `ssl` and `socket` modules.
- Accurately parses certificate extensions (SANs, Key Usage, CRL Distribution Points, AIA), Exact Signature Algorithms, and precise Public Key bit-sizes using the `cryptography` library.
- Performs a basic Security Analysis detecting insecure TLS versions, expired certificates, and weak cipher suites.
- Fully typed using Pydantic, seamlessly integrated with FastAPI.

## Running the Server

Start the FastAPI application via `uvicorn`:
```bash
uvicorn main:app --port 8000
```
This will start the server at `http://localhost:8000`. You can view the interactive Swagger API documentation at `http://localhost:8000/docs`.

## API Endpoint Usage

### POST `/api/v1/ssl-analysis`

**Request Payload**
```json
{
  "domain": "example.com"
}
```

**cURL Example**
```bash
curl -X POST http://localhost:8000/api/v1/ssl-analysis \
     -H "Content-Type: application/json" \
     -d '{"domain": "example.com"}'
```

**Success Response (Example Truncated)**
```json
{
  "domain": "example.com",
  "timestamp": "2026-03-27T10:00:00.000000Z",
  "connection_info": { ... },
  "certificate": { ... },
  "algorithms_detected": [ ... ],
  "security_analysis": {
    "tls_version_secure": true,
    "certificate_valid": true,
    "strong_cipher": true,
    "key_size_adequate": true,
    "self_signed_cert": false,
    "warnings": []
  }
}
```

## Error Handling
- **`400 Bad Request`**: Malformed domain string or DNS resolution failure.
- **`500 Internal Server Error`**: Connection timeout (10 seconds limit) or SSL handshake failure.
