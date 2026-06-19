from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DomainRequest(BaseModel):
    domain: str = Field(..., description="The domain name to analyze")

class CipherSuiteInfo(BaseModel):
    name: str = Field(..., description="Full cipher suite name")
    encryption_algorithm: Optional[str] = Field(None, description="e.g., AES-256-GCM")
    key_exchange: Optional[str] = Field(None, description="e.g., ECDHE")
    mac_algorithm: Optional[str] = Field(None, description="e.g., SHA384")

class ProtocolInfo(BaseModel):
    name: str = Field("TLS", description="Protocol name")
    asset_type: str = Field("protocol", description="Asset type")
    version: str = Field(..., description="e.g., TLS 1.3")
    cipher_suite: CipherSuiteInfo

class ConnectionInfo(BaseModel):
    protocol: ProtocolInfo

class SubjectInfo(BaseModel):
    common_name: Optional[str] = Field(None, description="CN value")
    organization: Optional[str] = Field(None, description="O value")
    organizational_unit: Optional[str] = Field(None, description="OU value")
    country: Optional[str] = Field(None, description="C value")
    state: Optional[str] = Field(None, description="ST value")
    locality: Optional[str] = Field(None, description="L value")
    full_dn: str = Field(..., description="Complete Distinguished Name")

class IssuerInfo(BaseModel):
    common_name: Optional[str] = Field(None, description="CA CN")
    organization: Optional[str] = Field(None, description="CA organization")
    full_dn: str = Field(..., description="Complete issuer DN")

class ValidityInfo(BaseModel):
    not_valid_before: str = Field(..., description="ISO 8601 date")
    not_valid_after: str = Field(..., description="ISO 8601 date")
    days_remaining: int = Field(..., description="Calculated integer")

class AlgorithmInfo(BaseModel):
    name: str
    asset_type: str = Field("algorithm")
    primitive: str
    oid: Optional[str] = None

class PublicKeyInfo(BaseModel):
    asset_type: str = Field("key")
    algorithm: str
    size: int
    exponent: Optional[int] = None

class AuthorityInfoAccessInfo(BaseModel):
    ocsp: List[str] = Field(default_factory=list)
    ca_issuers: List[str] = Field(default_factory=list)

class ExtensionsInfo(BaseModel):
    subject_alternative_names: List[str] = Field(default_factory=list)
    key_usage: List[str] = Field(default_factory=list)
    extended_key_usage: List[str] = Field(default_factory=list)
    basic_constraints: str = Field(..., description="CA status")
    crl_distribution_points: List[str] = Field(default_factory=list)
    authority_information_access: AuthorityInfoAccessInfo

class CertificateInfo(BaseModel):
    asset_type: str = Field("certificate")
    name: str
    subject: SubjectInfo
    issuer: IssuerInfo
    validity: ValidityInfo
    signature_algorithm: AlgorithmInfo
    public_key: PublicKeyInfo
    serial_number: str
    version: int
    extensions: ExtensionsInfo
    certificate_format: str = Field("X.509")
    certificate_extension: str = Field(".crt")

class AlgorithmDetectedInfo(BaseModel):
    name: str
    asset_type: str = Field("algorithm")
    primitive: str
    mode: Optional[str] = None
    classical_security_level: str

class SecurityAnalysisInfo(BaseModel):
    tls_version_secure: bool
    certificate_valid: bool
    strong_cipher: bool
    key_size_adequate: bool
    self_signed_cert: bool
    warnings: List[str] = Field(default_factory=list)

class SSLAnalysisResponse(BaseModel):
    domain: str
    timestamp: str
    connection_info: ConnectionInfo
    certificate: CertificateInfo
    algorithms_detected: List[AlgorithmDetectedInfo]
    security_analysis: SecurityAnalysisInfo
