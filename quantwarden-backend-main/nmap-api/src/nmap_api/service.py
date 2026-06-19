from __future__ import annotations

from .probe_engine import PortProbeEngine, resolve_target
from .schemas import OpenPortResult, PortDiscoveryRequest, PortDiscoveryResponse


async def discover_ports(req: PortDiscoveryRequest) -> PortDiscoveryResponse:
    ports = req.normalized_ports()
    resolved_addresses = await resolve_target(req.target)
    engine = PortProbeEngine(resolved_addresses=resolved_addresses, probe_timeout_ms=req.probe_timeout_ms)
    open_port_map = await engine.scan_ports(ports=ports, probe_batch_size=req.probe_batch_size)

    return PortDiscoveryResponse(
        target=req.target,
        resolved_addresses=[item.address for item in resolved_addresses],
        requested_port_count=len(ports),
        probed_port_count=len(ports),
        probe_batch_size=min(req.probe_batch_size, len(ports)),
        probe_timeout_ms=req.probe_timeout_ms,
        open_ports=[
            OpenPortResult(port=port, addresses=addresses)
            for port, addresses in open_port_map.items()
        ],
    )
