from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


def _validate_port(port: int) -> int:
    if not 1 <= port <= 65535:
        raise ValueError("Port values must be between 1 and 65535")
    return port


class PortRange(BaseModel):
    start: int = Field(..., description="First TCP port in the inclusive range")
    end: int = Field(..., description="Last TCP port in the inclusive range")

    @field_validator("start", "end")
    @classmethod
    def validate_bounds(cls, value: int) -> int:
        return _validate_port(value)

    @model_validator(mode="after")
    def validate_order(self) -> "PortRange":
        if self.start > self.end:
            raise ValueError("Each port range must have start less than or equal to end")
        return self


class PortDiscoveryRequest(BaseModel):
    target: str = Field(..., description="Target domain, IPv4 address, or IPv6 address")
    port_list: list[int] = Field(default_factory=list, description="Explicit TCP ports to probe")
    port_ranges: list[PortRange] = Field(
        default_factory=list,
        description="Inclusive TCP port ranges to probe alongside port_list",
    )
    probe_batch_size: int = Field(
        default=40,
        ge=1,
        description="Maximum number of ports probed concurrently",
    )
    probe_timeout_ms: int = Field(
        default=500,
        ge=1,
        description="TCP connect timeout per port in milliseconds",
    )

    @field_validator("target")
    @classmethod
    def validate_target(cls, value: str) -> str:
        target = value.strip()
        if not target:
            raise ValueError("target is required")
        if "://" in target:
            raise ValueError("target must be a bare domain, IPv4 address, or IPv6 address")
        return target

    @field_validator("port_list")
    @classmethod
    def validate_port_list(cls, value: list[int]) -> list[int]:
        return [_validate_port(port) for port in value]

    @model_validator(mode="after")
    def validate_ports_present(self) -> "PortDiscoveryRequest":
        if not self.port_list and not self.port_ranges:
            raise ValueError("At least one of port_list or port_ranges must be provided")
        return self

    def normalized_ports(self) -> list[int]:
        ports = set(self.port_list)
        for port_range in self.port_ranges:
            ports.update(range(port_range.start, port_range.end + 1))
        return sorted(ports)


class OpenPortResult(BaseModel):
    port: int
    addresses: list[str] = Field(default_factory=list)


class PortDiscoveryResponse(BaseModel):
    target: str
    resolved_addresses: list[str] = Field(default_factory=list)
    protocol: Literal["tcp"] = "tcp"
    requested_port_count: int
    probed_port_count: int
    probe_batch_size: int
    probe_timeout_ms: int
    open_ports: list[OpenPortResult] = Field(default_factory=list)
