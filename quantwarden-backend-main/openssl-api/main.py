from __future__ import annotations

from fastapi import FastAPI, HTTPException

from src.openssl_api.schemas import OpenSSLProfileRequest, OpenSSLProfileResponse
from src.openssl_api.service import run_openssl_profile

app = FastAPI(
    title="OpenSSL TLS Profile API",
    description="Deep OpenSSL-based TLS profiling with structured algorithm decomposition and PQC signals.",
    version="1.0.0",
)


@app.get("/")
def health() -> dict:
    return {"status": "ok", "service": "openssl-api"}


@app.post("/api/v1/openssl-profile", response_model=OpenSSLProfileResponse)
def openssl_profile(req: OpenSSLProfileRequest) -> OpenSSLProfileResponse:
    try:
        return run_openssl_profile(req)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"OpenSSL profiling failed: {exc}") from exc
