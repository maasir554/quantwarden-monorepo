from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_serializer


class OpenSSLProfileRequest(BaseModel):
    target: str = Field(..., description="Domain, IPv4, or IPv6 target")
    port: int = Field(default=443, ge=1, le=65535)
    timeout_seconds: int = Field(default=12, ge=3, le=60)
    probe_batch_size: int = Field(default=10, ge=1, le=50)
    include_raw_debug: bool = Field(default=False)


class AlgorithmDescriptor(BaseModel):
    name: str
    normalized_name: str
    oid: str | None = None


class CipherSuiteBreakdown(BaseModel):
    suite: str
    tls_version: str
    key_exchange: str | None = None
    authentication: str | None = None
    encryption: str
    hash: str | None = None


class VersionProbe(BaseModel):
    tls_version: str
    supported: bool
    negotiated_cipher: str | None = None
    negotiated_protocol: str | None = None
    negotiated_group: str | None = None
    accepted_ciphers_in_client_offer_order: list[str] = Field(default_factory=list)
    cipher_breakdowns: list[CipherSuiteBreakdown] = Field(default_factory=list)

    @model_serializer(mode="wrap")
    def serialize_with_tls13_group_only(self, handler):
        data = handler(self)
        if self.tls_version != "TLSv1.3":
            data.pop("negotiated_group", None)
        return data


class CertificateSummary(BaseModel):
    subject: str | None = None
    subject_normalized: str | None = None
    subject_attributes: dict[str, str] = Field(default_factory=dict)
    issuer: str | None = None
    issuer_normalized: str | None = None
    issuer_attributes: dict[str, str] = Field(default_factory=dict)
    serial_number: str | None = None
    not_before: str | None = None
    not_after: str | None = None
    signature_algorithm: AlgorithmDescriptor | None = None
    public_key_algorithm: AlgorithmDescriptor | None = None
    public_key_bits: int | None = None
    san_dns: list[str] = Field(default_factory=list)


class RawDebug(BaseModel):
    commands: list[str] = Field(default_factory=list)
    command_outputs: dict[str, str] = Field(default_factory=dict)


class IdentifierEntry(BaseModel):
    name: str
    oid: str | None = None
    iana_code: str | None = None


class IdentifierSection(BaseModel):
    certificate_algorithms: list[IdentifierEntry] = Field(default_factory=list)
    tls_groups: list[IdentifierEntry] = Field(default_factory=list)
    tls_cipher_suites: list[IdentifierEntry] = Field(default_factory=list)


class OpenSSLProfileResponse(BaseModel):
    target: str
    port: int
    resolved_ip: str | None = None
    scanned_at: datetime
    tls_versions: list[VersionProbe]
    tls_negotiation_order: list[str] = Field(default_factory=list)
    tls_key_exchange_algorithms: list[str] = Field(default_factory=list)
    tls_encryption_algorithms: list[str] = Field(default_factory=list)
    tls_signature_algorithms: list[str] = Field(default_factory=list)
    queried_groups: list[str] = Field(default_factory=list)
    supported_groups: list[str] = Field(default_factory=list)
    identifiers: IdentifierSection = Field(default_factory=IdentifierSection)
    certificate: CertificateSummary
    certificate_chain: list[CertificateSummary] = Field(default_factory=list)
    raw_debug: RawDebug | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
