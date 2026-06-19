from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, UTC

from .schemas import AlgorithmDescriptor, CertificateSummary, CipherSuiteBreakdown


SIGNATURE_OID_MAP = {
    "sha256withrsaencryption": "1.2.840.113549.1.1.11",
    "sha384withrsaencryption": "1.2.840.113549.1.1.12",
    "sha512withrsaencryption": "1.2.840.113549.1.1.13",
    "ecdsa-with-sha256": "1.2.840.10045.4.3.2",
    "ecdsa-with-sha384": "1.2.840.10045.4.3.3",
    "ecdsa-with-sha512": "1.2.840.10045.4.3.4",
    "id-ml-dsa-44": "2.16.840.1.101.3.4.3.17",
    "id-ml-dsa-65": "2.16.840.1.101.3.4.3.18",
    "id-ml-dsa-87": "2.16.840.1.101.3.4.3.19",
    "ml-dsa-44": "2.16.840.1.101.3.4.3.17",
    "ml-dsa-65": "2.16.840.1.101.3.4.3.18",
    "ml-dsa-87": "2.16.840.1.101.3.4.3.19",
}

PUBLIC_KEY_OID_MAP = {
    "id-ecpublickey": "1.2.840.10045.2.1",
    "ecpublickey": "1.2.840.10045.2.1",
    "rsaencryption": "1.2.840.113549.1.1.1",
    "id-ed25519": "1.3.101.112",
    "id-ed448": "1.3.101.113",
    "id-ml-dsa-44": "2.16.840.1.101.3.4.3.17",
    "id-ml-dsa-65": "2.16.840.1.101.3.4.3.18",
    "id-ml-dsa-87": "2.16.840.1.101.3.4.3.19",
}

DN_KEY_MAP = {
    "C": "countryName",
    "ST": "stateOrProvinceName",
    "L": "localityName",
    "O": "organizationName",
    "OU": "organizationalUnitName",
    "CN": "commonName",
    "SN": "surname",
    "GN": "givenName",
    "SERIALNUMBER": "serialNumber",
    "STREET": "streetAddress",
    "POSTALCODE": "postalCode",
    "BUSINESSCATEGORY": "businessCategory",
    "JURISDICTIONC": "jurisdictionCountryName",
    "JURISDICTIONST": "jurisdictionStateOrProvinceName",
    "JURISDICTIONL": "jurisdictionLocalityName",
}


@dataclass(frozen=True)
class ParsedHandshake:
    protocol: str | None
    cipher: str | None
    negotiated_group: str | None


def parse_s_client_brief(output: str) -> ParsedHandshake:
    protocol = None
    cipher = None
    negotiated_group = None

    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue

        if line.lower().startswith("protocol"):
            parts = re.split(r"\s*:\s*", line, maxsplit=1)
            if len(parts) == 2:
                protocol = parts[1].strip()

        if line.lower().startswith("ciphersuite") or line.lower().startswith("cipher"):
            parts = re.split(r"\s*:\s*", line, maxsplit=1)
            if len(parts) == 2:
                cipher = parts[1].strip()

        if line.lower().startswith("negotiated tls1.3 group"):
            parts = re.split(r"\s*:\s*", line, maxsplit=1)
            if len(parts) == 2:
                negotiated_group = parts[1].strip()

        if line.lower().startswith("server temp key") and negotiated_group is None:
            parts = re.split(r"\s*:\s*", line, maxsplit=1)
            if len(parts) == 2:
                group_value = parts[1].strip()
                negotiated_group = group_value.split(",", 1)[0].strip()

    if cipher is None:
        match = re.search(r"\bCipher is\s+([^\n\r]+)", output)
        if match:
            cipher = match.group(1).strip()

    if protocol is None:
        match = re.search(r"\bProtocol\s*:\s*([^\n\r]+)", output)
        if match:
            protocol = match.group(1).strip()

    return ParsedHandshake(protocol=protocol, cipher=cipher, negotiated_group=negotiated_group)


def decompose_cipher_suite(suite: str) -> CipherSuiteBreakdown:
    upper = suite.upper().strip()
    if upper.startswith("TLS_"):
        return _decompose_tls13(upper)
    return _decompose_tls12(upper)


def _decompose_tls12(suite: str) -> CipherSuiteBreakdown:
    parts = [p for p in suite.split("-") if p]
    if len(parts) < 4:
        raise ValueError(f"unable to parse TLS 1.2 cipher suite: {suite}")

    key_exchange = parts[0]
    # Some OpenSSL TLS1.2 names omit explicit auth and start encryption right
    # after key exchange, e.g. ECDHE-ARIA256-GCM-SHA384.
    if _is_encryption_start(parts[1]):
        authentication = None
        remainder = parts[1:]
    else:
        authentication = parts[1]
        remainder = parts[2:]

    if len(remainder) < 2:
        raise ValueError(f"unable to parse TLS 1.2 cipher suite tail: {suite}")

    hash_name: str | None
    encryption_raw: str
    if _contains_chacha20_poly1305(remainder):
        encryption_raw = "CHACHA20-POLY1305"
        hash_name = None
    else:
        hash_name = remainder[-1]
        encryption_raw = "-".join(remainder[:-1])

    encryption = _normalize_encryption(encryption_raw)
    if not encryption:
        raise ValueError(f"unable to parse TLS 1.2 encryption component: {suite}")

    parsed = CipherSuiteBreakdown(
        suite=suite,
        tls_version="TLS1.2",
        key_exchange=key_exchange,
        authentication=authentication,
        encryption=encryption,
        hash=hash_name,
    )
    _validate_breakdown(parsed)
    return parsed


def _decompose_tls13(suite: str) -> CipherSuiteBreakdown:
    parts = [p for p in suite.split("_") if p]
    if len(parts) < 4 or parts[0] != "TLS":
        raise ValueError(f"unable to parse TLS 1.3 cipher suite: {suite}")

    hash_name: str | None = parts[-1]
    encryption_raw = "_".join(parts[1:-1])
    encryption = _normalize_encryption(encryption_raw)
    if not encryption:
        raise ValueError(f"unable to parse TLS 1.3 encryption component: {suite}")

    parsed = CipherSuiteBreakdown(
        suite=suite,
        tls_version="TLS1.3",
        key_exchange=None,
        authentication=None,
        encryption=encryption,
        hash=hash_name,
    )
    _validate_breakdown(parsed)
    return parsed


def _normalize_encryption(raw: str) -> str:
    token = raw.upper().replace("-", "_").strip("_")
    if "CHACHA20" in token and "POLY1305" in token:
        return "CHACHA20_POLY1305"

    token = re.sub(r"AES(128|256)", r"AES_\1", token)
    token = re.sub(r"__+", "_", token)
    if token == "CHACHA20":
        return ""
    return token


def _contains_chacha20_poly1305(parts: list[str]) -> bool:
    joined = "-".join(parts).upper()
    return "CHACHA20-POLY1305" in joined


def _is_encryption_start(token: str) -> bool:
    upper = token.upper()
    return upper.startswith(("AES", "ARIA", "CAMELLIA", "CHACHA20", "NULL", "SM4"))


def _validate_breakdown(parsed: CipherSuiteBreakdown) -> None:
    if not parsed.encryption:
        raise ValueError(f"invalid parsed suite (missing encryption): {parsed.suite}")
    if parsed.encryption == "CHACHA20":
        raise ValueError(f"invalid parsed suite (standalone CHACHA20): {parsed.suite}")
    if parsed.tls_version == "TLS1.3":
        if parsed.key_exchange is not None or parsed.authentication is not None:
            raise ValueError(f"invalid TLS1.3 parsed suite (non-null kex/auth): {parsed.suite}")
    if parsed.hash is None and not (
        parsed.tls_version == "TLS1.2" and parsed.encryption == "CHACHA20_POLY1305"
    ):
        raise ValueError(f"invalid parsed suite (null hash not allowed here): {parsed.suite}")


def parse_certificate_text(cert_text: str) -> CertificateSummary:
    subject = _extract_value(cert_text, r"^subject=([^\n]+)$")
    issuer = _extract_value(cert_text, r"^issuer=([^\n]+)$")
    serial = _extract_value(cert_text, r"^serial=([^\n]+)$")
    not_before = _normalize_cert_time(_extract_value(cert_text, r"^notBefore=([^\n]+)$"))
    not_after = _normalize_cert_time(_extract_value(cert_text, r"^notAfter=([^\n]+)$"))

    sig_name = _extract_value(cert_text, r"Signature Algorithm:\s*([^\n]+)")
    pub_line = _extract_value(cert_text, r"Public Key Algorithm:\s*([^\n]+)")
    bits = _extract_value(cert_text, r"Public-Key:\s*\((\d+) bit\)")

    sans = []
    san_match = re.search(r"X509v3 Subject Alternative Name:\s*\n\s*([^\n]+)", cert_text)
    if san_match:
        entries = [item.strip() for item in san_match.group(1).split(",")]
        sans = [e.replace("DNS:", "") for e in entries if e.startswith("DNS:")]

    subject_attrs, subject_normalized = _parse_distinguished_name(subject)
    issuer_attrs, issuer_normalized = _parse_distinguished_name(issuer)

    return CertificateSummary(
        subject=subject,
        subject_normalized=subject_normalized,
        subject_attributes=subject_attrs,
        issuer=issuer,
        issuer_normalized=issuer_normalized,
        issuer_attributes=issuer_attrs,
        serial_number=serial,
        not_before=not_before,
        not_after=not_after,
        signature_algorithm=_algorithm(sig_name, SIGNATURE_OID_MAP),
        public_key_algorithm=_algorithm(pub_line, PUBLIC_KEY_OID_MAP),
        public_key_bits=int(bits) if bits and bits.isdigit() else None,
        san_dns=sans,
    )


def _algorithm(name: str | None, oid_map: dict[str, str]) -> AlgorithmDescriptor | None:
    if not name:
        return None
    cleaned = name.strip()
    oid = _extract_oid(cleaned) or oid_map.get(_normalize_algorithm_name(cleaned))
    return AlgorithmDescriptor(name=cleaned, normalized_name=cleaned.lower().replace(" ", "_"), oid=oid)


def _normalize_algorithm_name(name: str) -> str:
    return re.sub(r"[^a-z0-9\-]", "", name.lower())


def _extract_oid(name: str) -> str | None:
    match = re.search(r"\b\d+(?:\.\d+){2,}\b", name)
    if match:
        return match.group(0)
    return None


def _normalize_cert_time(raw: str | None) -> str | None:
    if not raw:
        return None

    text = raw.strip()

    # OpenSSL x509 -dates style: "Sep 25 06:11:08 2025 GMT"
    try:
        dt = datetime.strptime(text, "%b %d %H:%M:%S %Y GMT")
        return dt.replace(tzinfo=UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        pass

    # Preserve already-ISO-like values but normalize +00:00 to Z.
    iso_candidate = text.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(iso_candidate)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return text


def _parse_distinguished_name(raw: str | None) -> tuple[dict[str, str], str | None]:
    if not raw:
        return {}, None

    chunks = [chunk.strip() for chunk in re.split(r"(?<!\\),", raw) if chunk.strip()]
    pairs: list[tuple[str, str]] = []

    for chunk in chunks:
        if "=" not in chunk:
            continue
        key, value = chunk.split("=", 1)
        short_key = key.strip()
        canonical_key = DN_KEY_MAP.get(short_key.upper(), short_key)
        clean_value = value.strip().replace("\\,", ",")
        pairs.append((canonical_key, clean_value))

    attrs: dict[str, str] = {}
    for key, value in pairs:
        if key in attrs:
            attrs[key] = f"{attrs[key]}, {value}"
        else:
            attrs[key] = value

    normalized = ", ".join(f"{k}={v}" for k, v in pairs) if pairs else None
    return attrs, normalized


def _extract_value(content: str, pattern: str) -> str | None:
    match = re.search(pattern, content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return None


