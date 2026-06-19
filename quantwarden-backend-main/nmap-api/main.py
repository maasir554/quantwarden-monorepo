from __future__ import annotations

from fastapi import FastAPI

from src.nmap_api.schemas import PortDiscoveryRequest, PortDiscoveryResponse
from src.nmap_api.service import discover_ports

app = FastAPI(
    title="Nmap Port Discovery API",
    description="Probe requested TCP ports against a target using a sliding concurrency window.",
    version="2.0.0",
)


@app.get("/")
def health() -> dict:
    return {"status": "ok", "service": "nmap-api"}


@app.post("/api/v1/port-discovery", response_model=PortDiscoveryResponse)
async def port_discovery(req: PortDiscoveryRequest) -> PortDiscoveryResponse:
    return await discover_ports(req)
