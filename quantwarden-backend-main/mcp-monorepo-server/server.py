from __future__ import annotations

import json
import os
from typing import Any, Dict, Literal

import httpx
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

mcp = FastMCP("quantwarden-monorepo")


class ServiceConfig(BaseModel):
    name: str
    base_url: str


SERVICES: Dict[str, ServiceConfig] = {
    "oneforall": ServiceConfig(
        name="oneforall",
        base_url=os.getenv("ONEFORALL_API_URL", "http://127.0.0.1:8002"),
    ),
    "subfinder": ServiceConfig(
        name="subfinder",
        base_url=os.getenv("SUBFINDER_API_URL", "http://127.0.0.1:8085"),
    ),
    "pyssl": ServiceConfig(
        name="pyssl",
        base_url=os.getenv("PYSSL_API_URL", "http://127.0.0.1:8000"),
    ),
    "nmap": ServiceConfig(
        name="nmap",
        base_url=os.getenv("NMAP_API_URL", "http://127.0.0.1:8010"),
    ),
    "openssl": ServiceConfig(
        name="openssl",
        base_url=os.getenv("OPENSSL_API_URL", "http://127.0.0.1:8020"),
    ),
}


def _join_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _request(
    service: str,
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"],
    path: str,
    body: Dict[str, Any] | None = None,
    query: Dict[str, Any] | None = None,
    timeout_seconds: float = 60.0,
) -> Dict[str, Any]:
    cfg = SERVICES.get(service)
    if cfg is None:
        raise ValueError(f"Unknown service '{service}'. Allowed: {', '.join(sorted(SERVICES.keys()))}")

    url = _join_url(cfg.base_url, path)
    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.request(method=method, url=url, params=query, json=body)

    content_type = response.headers.get("content-type", "")
    data: Any
    if "application/json" in content_type:
        try:
            data = response.json()
        except json.JSONDecodeError:
            data = {"raw": response.text}
    else:
        data = {"raw": response.text}

    return {
        "service": service,
        "url": url,
        "method": method,
        "status_code": response.status_code,
        "ok": response.is_success,
        "data": data,
    }


@mcp.tool()
def list_services() -> Dict[str, Any]:
    """List monorepo service base URLs used by this MCP server."""
    return {
        "services": {
            name: {"base_url": cfg.base_url}
            for name, cfg in SERVICES.items()
        }
    }


@mcp.tool()
def check_services_health(timeout_seconds: float = 8.0) -> Dict[str, Any]:
    """Check basic health for all monorepo services by calling root endpoints."""
    out: Dict[str, Any] = {}
    for name, cfg in SERVICES.items():
        try:
            with httpx.Client(timeout=timeout_seconds) as client:
                response = client.get(cfg.base_url)
            out[name] = {
                "base_url": cfg.base_url,
                "status_code": response.status_code,
                "ok": response.is_success,
                "body_preview": response.text[:300],
            }
        except Exception as exc:  # noqa: BLE001
            out[name] = {
                "base_url": cfg.base_url,
                "ok": False,
                "error": str(exc),
            }
    return {"results": out}


@mcp.tool()
def nmap_port_discovery(
    target: str,
    port_list: list[int] | None = None,
    port_ranges: list[Dict[str, int]] | None = None,
    probe_batch_size: int = 40,
    probe_timeout_ms: int = 500,
    timeout_seconds: float = 120.0,
) -> Dict[str, Any]:
    """Run TCP port discovery using /api/v1/port-discovery."""
    body: Dict[str, Any] = {
        "target": target,
        "probe_batch_size": probe_batch_size,
        "probe_timeout_ms": probe_timeout_ms,
    }
    if port_list is not None:
        body["port_list"] = port_list
    if port_ranges is not None:
        body["port_ranges"] = port_ranges

    return _request(
        service="nmap",
        method="POST",
        path="/api/v1/port-discovery",
        body=body,
        timeout_seconds=timeout_seconds,
    )


@mcp.tool()
def pyssl_analysis(domain: str, timeout_seconds: float = 60.0) -> Dict[str, Any]:
    """Run SSL analysis using PySSL API /api/v1/ssl-analysis."""
    return _request(
        service="pyssl",
        method="POST",
        path="/api/v1/ssl-analysis",
        body={"domain": domain},
        timeout_seconds=timeout_seconds,
    )


@mcp.tool()
def openssl_profile(
    target: str,
    port: int = 443,
    timeout_seconds: float = 120.0,
    include_raw_debug: bool = False,
) -> Dict[str, Any]:
    """Run deep OpenSSL profile using /api/v1/openssl-profile."""
    return _request(
        service="openssl",
        method="POST",
        path="/api/v1/openssl-profile",
        body={
            "target": target,
            "port": port,
            "timeout_seconds": int(timeout_seconds),
            "include_raw_debug": include_raw_debug,
        },
        timeout_seconds=timeout_seconds,
    )


@mcp.tool()
def subfinder_combined(domain: str, timeout_seconds: float = 90.0) -> Dict[str, Any]:
    """Run combined subdomain discovery using Subfinder API /subdomains."""
    return _request(
        service="subfinder",
        method="POST",
        path="/subdomains",
        body={"domain": domain},
        timeout_seconds=timeout_seconds,
    )


@mcp.tool()
def subfinder_only(domain: str, timeout_seconds: float = 90.0) -> Dict[str, Any]:
    """Run subfinder-only discovery using Subfinder API /subfinder."""
    return _request(
        service="subfinder",
        method="POST",
        path="/subfinder",
        body={"domain": domain},
        timeout_seconds=timeout_seconds,
    )


@mcp.tool()
def assetfinder_only(domain: str, timeout_seconds: float = 90.0) -> Dict[str, Any]:
    """Run assetfinder-only discovery using Subfinder API /assetfinder."""
    return _request(
        service="subfinder",
        method="POST",
        path="/assetfinder",
        body={"domain": domain},
        timeout_seconds=timeout_seconds,
    )


@mcp.tool()
def monorepo_api_request(
    service: Literal["oneforall", "subfinder", "pyssl", "nmap", "openssl"],
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"],
    path: str,
    body: Dict[str, Any] | None = None,
    query: Dict[str, Any] | None = None,
    timeout_seconds: float = 60.0,
) -> Dict[str, Any]:
    """Generic stateless request tool for any configured monorepo service endpoint."""
    return _request(
        service=service,
        method=method,
        path=path,
        body=body,
        query=query,
        timeout_seconds=timeout_seconds,
    )


if __name__ == "__main__":
    mcp.run()
