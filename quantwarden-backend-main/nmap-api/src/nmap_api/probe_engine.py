from __future__ import annotations

import asyncio
import socket
from dataclasses import dataclass

from fastapi import HTTPException


@dataclass(frozen=True)
class ResolvedAddress:
    family: int
    address: str


async def resolve_target(target: str) -> list[ResolvedAddress]:
    try:
        addrinfo = await asyncio.get_running_loop().getaddrinfo(
            target,
            None,
            family=socket.AF_UNSPEC,
            type=socket.SOCK_STREAM,
            proto=socket.IPPROTO_TCP,
        )
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail=f"Target resolution failed: {exc}") from exc

    resolved: list[ResolvedAddress] = []
    seen: set[tuple[int, str]] = set()
    for family, _, _, _, sockaddr in addrinfo:
        address = sockaddr[0]
        key = (family, address)
        if key in seen:
            continue
        seen.add(key)
        resolved.append(ResolvedAddress(family=family, address=address))

    if not resolved:
        raise HTTPException(status_code=400, detail="Target resolution returned no usable addresses")

    return resolved


class PortProbeEngine:
    def __init__(self, resolved_addresses: list[ResolvedAddress], probe_timeout_ms: int) -> None:
        self._resolved_addresses = resolved_addresses
        self._probe_timeout_seconds = probe_timeout_ms / 1000

    async def scan_ports(self, ports: list[int], probe_batch_size: int) -> dict[int, list[str]]:
        if not ports:
            return {}

        queue: asyncio.Queue[int] = asyncio.Queue()
        for port in ports:
            queue.put_nowait(port)

        results: dict[int, list[str]] = {}
        worker_count = min(probe_batch_size, len(ports))
        workers = [asyncio.create_task(self._worker(queue, results)) for _ in range(worker_count)]

        await queue.join()

        for worker in workers:
            worker.cancel()
        await asyncio.gather(*workers, return_exceptions=True)

        return {port: results[port] for port in sorted(results)}

    async def _worker(self, queue: asyncio.Queue[int], results: dict[int, list[str]]) -> None:
        while True:
            port = await queue.get()
            try:
                open_addresses = await self._probe_port(port)
                if open_addresses:
                    results[port] = open_addresses
            finally:
                queue.task_done()

    async def _probe_port(self, port: int) -> list[str]:
        open_addresses: list[str] = []
        for resolved in self._resolved_addresses:
            if await self._probe_address(resolved, port):
                open_addresses.append(resolved.address)
        return open_addresses

    async def _probe_address(self, resolved: ResolvedAddress, port: int) -> bool:
        writer: asyncio.StreamWriter | None = None
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(
                    host=resolved.address,
                    port=port,
                    family=resolved.family,
                ),
                timeout=self._probe_timeout_seconds,
            )
        except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
            return False

        writer.close()
        try:
            await writer.wait_closed()
        except OSError:
            pass
        return True
