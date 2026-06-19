from __future__ import annotations

import asyncio
import socket
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main  # noqa: E402
from src.nmap_api.probe_engine import PortProbeEngine, ResolvedAddress, resolve_target  # noqa: E402
from src.nmap_api.schemas import PortDiscoveryRequest, PortRange  # noqa: E402
from src.nmap_api.service import discover_ports  # noqa: E402


def run(coro):  # type: ignore[no-untyped-def]
    return asyncio.run(coro)


def test_request_rejects_missing_ports() -> None:
    with pytest.raises(ValueError, match="At least one of port_list or port_ranges must be provided"):
        PortDiscoveryRequest(target="example.com")


def test_request_rejects_invalid_port_and_reversed_range() -> None:
    with pytest.raises(ValueError, match="Port values must be between 1 and 65535"):
        PortDiscoveryRequest(target="example.com", port_list=[0])

    with pytest.raises(ValueError, match="Each port range must have start less than or equal to end"):
        PortRange(start=20, end=10)


def test_request_normalizes_ports_and_defaults() -> None:
    req = PortDiscoveryRequest(
        target="example.com",
        port_list=[443, 80, 443],
        port_ranges=[PortRange(start=79, end=81), PortRange(start=81, end=82)],
    )

    assert req.normalized_ports() == [79, 80, 81, 82, 443]
    assert req.probe_timeout_ms == 500
    assert req.probe_batch_size == 40


def test_resolve_target_accepts_ip_literals(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeLoop:
        async def getaddrinfo(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            target = args[0]
            if target == "127.0.0.1":
                return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))]
            if target == "::1":
                return [(socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("::1", 0, 0, 0))]
            raise AssertionError(f"Unexpected target {target}")

    monkeypatch.setattr("src.nmap_api.probe_engine.asyncio.get_running_loop", lambda: FakeLoop())

    ipv4 = run(resolve_target("127.0.0.1"))
    ipv6 = run(resolve_target("::1"))

    assert [item.address for item in ipv4] == ["127.0.0.1"]
    assert [item.address for item in ipv6] == ["::1"]


def test_resolve_target_rejects_invalid_hostname(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeLoop:
        async def getaddrinfo(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            raise socket.gaierror("lookup failed")

    monkeypatch.setattr("src.nmap_api.probe_engine.asyncio.get_running_loop", lambda: FakeLoop())

    with pytest.raises(HTTPException, match="Target resolution failed"):
        run(resolve_target("definitely-not-a-real-hostname.invalid"))


def test_service_reports_all_resolved_addresses(monkeypatch: pytest.MonkeyPatch) -> None:
    resolved = [
        ResolvedAddress(family=socket.AF_INET, address="192.0.2.10"),
        ResolvedAddress(family=socket.AF_INET6, address="2001:db8::10"),
    ]

    async def fake_resolve_target(target: str) -> list[ResolvedAddress]:
        assert target == "example.com"
        return resolved

    async def fake_scan_ports(self: PortProbeEngine, ports: list[int], probe_batch_size: int) -> dict[int, list[str]]:
        assert ports == [80, 443]
        assert probe_batch_size == 40
        return {443: ["192.0.2.10", "2001:db8::10"]}

    monkeypatch.setattr("src.nmap_api.service.resolve_target", fake_resolve_target)
    monkeypatch.setattr(PortProbeEngine, "scan_ports", fake_scan_ports)

    response = run(discover_ports(PortDiscoveryRequest(target="example.com", port_list=[443, 80])))

    assert response.resolved_addresses == ["192.0.2.10", "2001:db8::10"]
    assert response.open_ports[0].port == 443
    assert response.open_ports[0].addresses == ["192.0.2.10", "2001:db8::10"]


def test_probe_engine_reports_open_port_and_omits_closed_port(monkeypatch: pytest.MonkeyPatch) -> None:
    open_port = 443
    closed_port = 444

    engine = PortProbeEngine(
        resolved_addresses=[ResolvedAddress(family=socket.AF_INET, address="127.0.0.1")],
        probe_timeout_ms=500,
    )

    class FakeWriter:
        def close(self) -> None:
            return None

        async def wait_closed(self) -> None:
            return None

    async def fake_open_connection(*args, **kwargs):  # type: ignore[no-untyped-def]
        if kwargs["port"] == open_port:
            return None, FakeWriter()
        raise ConnectionRefusedError("closed")

    monkeypatch.setattr("src.nmap_api.probe_engine.asyncio.open_connection", fake_open_connection)

    result = run(engine.scan_ports([open_port, closed_port], probe_batch_size=2))

    assert result == {open_port: ["127.0.0.1"]}


def test_probe_timeout_path_is_handled(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_open_connection(*args, **kwargs):  # type: ignore[no-untyped-def]
        await asyncio.sleep(0.05)
        return None

    monkeypatch.setattr("src.nmap_api.probe_engine.asyncio.open_connection", fake_open_connection)

    engine = PortProbeEngine(
        resolved_addresses=[ResolvedAddress(family=socket.AF_INET, address="127.0.0.1")],
        probe_timeout_ms=10,
    )

    result = run(engine.scan_ports([443], probe_batch_size=1))

    assert result == {}


def test_probe_engine_respects_concurrency_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    active = 0
    max_active = 0

    async def fake_probe_port(self: PortProbeEngine, port: int) -> list[str]:
        nonlocal active, max_active
        active += 1
        max_active = max(max_active, active)
        await asyncio.sleep(0.01)
        active -= 1
        return []

    monkeypatch.setattr(PortProbeEngine, "_probe_port", fake_probe_port)

    engine = PortProbeEngine(
        resolved_addresses=[ResolvedAddress(family=socket.AF_INET, address="127.0.0.1")],
        probe_timeout_ms=500,
    )

    run(engine.scan_ports([1, 2, 3, 4, 5, 6], probe_batch_size=3))

    assert max_active == 3


def test_probe_engine_uses_sliding_window(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[tuple[str, int]] = []
    delays = {1: 0.05, 2: 0.01, 3: 0.01}

    async def fake_probe_port(self: PortProbeEngine, port: int) -> list[str]:
        events.append(("start", port))
        await asyncio.sleep(delays[port])
        events.append(("end", port))
        return []

    monkeypatch.setattr(PortProbeEngine, "_probe_port", fake_probe_port)

    engine = PortProbeEngine(
        resolved_addresses=[ResolvedAddress(family=socket.AF_INET, address="127.0.0.1")],
        probe_timeout_ms=500,
    )

    run(engine.scan_ports([1, 2, 3], probe_batch_size=2))

    assert events.index(("start", 3)) < events.index(("end", 1))


def test_api_smoke(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_discover_ports(req: PortDiscoveryRequest):  # type: ignore[no-untyped-def]
        assert req.target == "example.com"
        return {
            "target": req.target,
            "resolved_addresses": ["127.0.0.1"],
            "protocol": "tcp",
            "requested_port_count": 2,
            "probed_port_count": 2,
            "probe_batch_size": 2,
            "probe_timeout_ms": 500,
            "open_ports": [{"port": 80, "addresses": ["127.0.0.1"]}],
        }

    monkeypatch.setattr(main, "discover_ports", fake_discover_ports)

    client = TestClient(main.app)
    response = client.post(
        "/api/v1/port-discovery",
        json={"target": "example.com", "port_list": [80, 443]},
    )

    assert response.status_code == 200
    assert response.json()["open_ports"] == [{"port": 80, "addresses": ["127.0.0.1"]}]


def test_api_accepts_port_ranges(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_discover_ports(req: PortDiscoveryRequest):  # type: ignore[no-untyped-def]
        assert req.port_ranges == [PortRange(start=1000, end=1002), PortRange(start=2000, end=2001)]
        return {
            "target": req.target,
            "resolved_addresses": ["127.0.0.1"],
            "protocol": "tcp",
            "requested_port_count": 5,
            "probed_port_count": 5,
            "probe_batch_size": 5,
            "probe_timeout_ms": 500,
            "open_ports": [],
        }

    monkeypatch.setattr(main, "discover_ports", fake_discover_ports)

    client = TestClient(main.app)
    response = client.post(
        "/api/v1/port-discovery",
        json={
            "target": "example.com",
            "port_ranges": [
                {"start": 1000, "end": 1002},
                {"start": 2000, "end": 2001},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["requested_port_count"] == 5
