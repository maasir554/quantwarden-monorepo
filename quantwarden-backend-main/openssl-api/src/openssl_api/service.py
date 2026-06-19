from __future__ import annotations

from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
import ipaddress
import re
import socket
from collections.abc import Callable
from datetime import datetime, UTC

from .openssl_runner import (
    CommandResult,
    openssl_ciphers,
    openssl_s_client,
    openssl_tls13_groups,
    openssl_x509_from_pem,
)
from .parsers import decompose_cipher_suite, parse_certificate_text, parse_s_client_brief
from .schemas import IdentifierEntry, IdentifierSection, OpenSSLProfileRequest, OpenSSLProfileResponse, RawDebug, VersionProbe


TLS_PROBES: list[tuple[str, str]] = [
    ("TLSv1.0", "-tls1"),
    ("TLSv1.1", "-tls1_1"),
    ("TLSv1.2", "-tls1_2"),
    ("TLSv1.3", "-tls1_3"),
]


TLS_GROUP_IANA_MAP = {
    "secp256r1": "0x0017",
    "secp384r1": "0x0018",
    "secp521r1": "0x0019",
    "brainpoolp256r1tls13": "0x001A",
    "brainpoolp384r1tls13": "0x001B",
    "brainpoolp512r1tls13": "0x001C",
    "x25519": "0x001D",
    "x448": "0x001E",
    "ffdhe2048": "0x0100",
    "ffdhe3072": "0x0101",
    "ffdhe4096": "0x0102",
    "ffdhe6144": "0x0103",
    "ffdhe8192": "0x0104",
    "mlkem512": "0x0200",
    "mlkem768": "0x0201",
    "mlkem1024": "0x0202",
    "secp256r1mlkem768": "0x11EB",
    "x25519mlkem768": "0x11EC",
    "secp384r1mlkem1024": "0x11ED",
    "curvesm2mlkem768": "0x11EE",
    "x25519kyber768draft00": "0x6399",
    "secp256r1kyber768draft00": "0x639A",
}

TLS_CIPHER_IANA_MAP = {
    "TLS_AES_128_GCM_SHA256": "0x1301",
    "TLS_AES_256_GCM_SHA384": "0x1302",
    "TLS_CHACHA20_POLY1305_SHA256": "0x1303",
    "TLS_AES_128_CCM_SHA256": "0x1304",
    "TLS_AES_128_CCM_8_SHA256": "0x1305",
    "ECDHE-ECDSA-AES128-GCM-SHA256": "0xC02B",
    "ECDHE-ECDSA-AES256-GCM-SHA384": "0xC02C",
    "ECDHE-RSA-AES128-GCM-SHA256": "0xC02F",
    "ECDHE-RSA-AES256-GCM-SHA384": "0xC030",
    "ECDHE-ECDSA-CHACHA20-POLY1305": "0xCCA9",
    "ECDHE-RSA-CHACHA20-POLY1305": "0xCCA8",
    "DHE-RSA-AES128-GCM-SHA256": "0x009E",
    "DHE-RSA-AES256-GCM-SHA384": "0x009F",
    "AES128-GCM-SHA256": "0x009C",
    "AES256-GCM-SHA384": "0x009D",
}

# TLS cipher suites do not have a universal ASN.1 OID as a whole; we expose the
# most specific component OID (prefer encryption, then hash, then auth).
TLS_CIPHER_COMPONENT_OID_MAP = {
    "AES_128_GCM": "2.16.840.1.101.3.4.1.6",
    "AES_256_GCM": "2.16.840.1.101.3.4.1.46",
    "AES_128_CCM": "2.16.840.1.101.3.4.1.7",
    "AES_128_CCM_8": "2.16.840.1.101.3.4.1.7",
    "CHACHA20_POLY1305": "1.2.840.113549.1.9.16.3.18",
    "SHA256": "2.16.840.1.101.3.4.2.1",
    "SHA384": "2.16.840.1.101.3.4.2.2",
    "SHA512": "2.16.840.1.101.3.4.2.3",
    "RSA": "1.2.840.113549.1.1.1",
    "ECDSA": "1.2.840.10045.2.1",
}


def run_openssl_profile(req: OpenSSLProfileRequest) -> OpenSSLProfileResponse:
    raw_cmds: list[str] = []
    raw_outputs: dict[str, str] = {}

    def _capture(result: CommandResult) -> None:
        raw_cmds.append(result.command)
        if req.include_raw_debug:
            raw_outputs[result.command] = _clip(result.output)

    ciphers_result = openssl_ciphers(req.timeout_seconds)
    _capture(ciphers_result)
    candidates_by_version = _parse_cipher_candidates(ciphers_result.output)
    groups_result = openssl_tls13_groups(req.timeout_seconds)
    _capture(groups_result)
    queried_groups = parse_tls_groups(groups_result.output)

    version_probes: list[VersionProbe] = []
    all_accepted_ciphers: list[str] = []

    sni = req.target.strip("[]")
    resolved_ip = _resolve_target_ip(req.target)
    forced_probe_timeout = max(3, min(5, req.timeout_seconds))
    group_probe_timeout = max(2, min(3, req.timeout_seconds))
    probe_batch_size = req.probe_batch_size

    version_probe_results = _run_batched_probes(
        [
            lambda tls_flag=tls_flag: openssl_s_client(
                target=req.target,
                port=req.port,
                sni=sni,
                timeout_seconds=req.timeout_seconds,
                tls_flag=tls_flag,
            )
            for _, tls_flag in TLS_PROBES
        ],
        probe_batch_size,
    )

    for (version_label, tls_flag), probe in zip(TLS_PROBES, version_probe_results):
        _capture(probe)

        handshake = parse_s_client_brief(probe.output)
        is_supported = probe.return_code == 0 and bool(handshake.cipher)

        accepted: list[str] = []
        candidates = candidates_by_version.get(version_label, [])[:24]
        forced_results = _run_batched_probes(
            [
                lambda candidate=candidate: openssl_s_client(
                    target=req.target,
                    port=req.port,
                    sni=sni,
                    timeout_seconds=forced_probe_timeout,
                    tls_flag=tls_flag,
                    cipher=candidate if version_label != "TLSv1.3" else None,
                    ciphersuite=candidate if version_label == "TLSv1.3" else None,
                )
                for candidate in candidates
            ],
            probe_batch_size,
        )

        for candidate, forced in zip(candidates, forced_results):
            _capture(forced)

            forced_hs = parse_s_client_brief(forced.output)
            if forced.return_code == 0 and forced_hs.cipher and forced_hs.cipher.upper() == candidate.upper():
                accepted.append(candidate)

        all_accepted_ciphers.extend(accepted)
        version_probes.append(
            VersionProbe(
                tls_version=version_label,
                supported=is_supported,
                negotiated_cipher=handshake.cipher,
                negotiated_protocol=handshake.protocol,
                negotiated_group=handshake.negotiated_group,
                accepted_ciphers_in_client_offer_order=accepted,
                cipher_breakdowns=[decompose_cipher_suite(s) for s in accepted],
            )
        )

    cert_probe = openssl_s_client(
        target=req.target,
        port=req.port,
        sni=sni,
        timeout_seconds=req.timeout_seconds,
        tls_flag="-tls1_2",
        showcerts=True,
    )
    _capture(cert_probe)

    cert_chain: list = []
    for pem in _extract_all_pems(cert_probe.output):
        cert_text_result = openssl_x509_from_pem(pem, req.timeout_seconds)
        _capture(cert_text_result)
        cert_chain.append(parse_certificate_text(cert_text_result.output))

    cert_summary = cert_chain[0] if cert_chain else parse_certificate_text("")

    supported_groups = _probe_tls13_groups(
        target=req.target,
        port=req.port,
        sni=sni,
        groups=queried_groups,
        timeout_seconds=group_probe_timeout,
        batch_size=probe_batch_size,
        capture=_capture,
    )

    tls_kex = sorted(
        {
            value
            for p in version_probes
            for value in [p.negotiated_group, *[b.key_exchange for b in p.cipher_breakdowns]]
            if value
        }
        | set(supported_groups)
    )
    tls_enc = sorted(
        {
            b.encryption
            for p in version_probes
            for b in p.cipher_breakdowns
            if b.encryption
        }
    )
    tls_sig = sorted(
        {
            b.authentication
            for p in version_probes
            for b in p.cipher_breakdowns
            if b.authentication
        }
    )

    response = OpenSSLProfileResponse(
        target=req.target,
        port=req.port,
        resolved_ip=resolved_ip,
        scanned_at=datetime.now(UTC),
        tls_versions=version_probes,
        tls_negotiation_order=all_accepted_ciphers,
        tls_key_exchange_algorithms=tls_kex,
        tls_encryption_algorithms=tls_enc,
        tls_signature_algorithms=tls_sig,
        queried_groups=queried_groups,
        supported_groups=supported_groups,
        identifiers=_build_identifier_section(
            cert_summary=cert_summary,
            queried_groups=queried_groups,
            supported_groups=supported_groups,
            tls_negotiation_order=all_accepted_ciphers,
            version_probes=version_probes,
        ),
        certificate=cert_summary,
        certificate_chain=cert_chain,
        raw_debug=RawDebug(commands=raw_cmds, command_outputs=raw_outputs) if req.include_raw_debug else None,
        metadata={
            "mode": "deep",
            "openssl_probe": "s_client",
        },
    )
    return response


def _parse_cipher_candidates(ciphers_output: str) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {k: [] for k, _ in TLS_PROBES}
    for line in ciphers_output.splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        suite = parts[0].strip()
        proto = parts[1].strip().upper()

        if proto in {"TLSV1.3", "TLSV1_3"}:
            if suite.startswith("TLS_"):
                out["TLSv1.3"].append(suite)
        elif proto in {"TLSV1.2", "TLSV1.1", "TLSV1", "SSLV3"}:
            out["TLSv1.2"].append(suite)
            out["TLSv1.1"].append(suite)
            out["TLSv1.0"].append(suite)

    for key in out:
        out[key] = _dedupe_keep_order(out[key])
    return out


def _dedupe_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        key = v.upper()
        if key in seen:
            continue
        seen.add(key)
        out.append(v)
    return out


def _extract_all_pems(s_client_output: str) -> list[str]:
    return re.findall(
        r"-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----",
        s_client_output,
    )


def _clip(text: str, limit: int = 6000) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n...[truncated]..."


def parse_tls_groups(raw: str) -> list[str]:
    text = raw.strip()
    if not text:
        return []

    # openssl list -tls-groups -tls1_3 returns a colon-separated line
    line = text.splitlines()[-1].strip()
    groups = [part.strip() for part in line.split(":") if part.strip()]
    return _dedupe_keep_order(groups)


def _probe_tls13_groups(
    *,
    target: str,
    port: int,
    sni: str,
    groups: list[str],
    timeout_seconds: int,
    batch_size: int,
    capture,
) -> list[str]:
    probe_results = _run_batched_probes(
        [
            lambda group=group: openssl_s_client(
                target=target,
                port=port,
                sni=sni,
                timeout_seconds=timeout_seconds,
                tls_flag="-tls1_3",
                groups=group,
            )
            for group in groups
        ],
        batch_size,
    )

    out: list[str] = []
    for group, result in zip(groups, probe_results):
        capture(result)

        parsed = parse_s_client_brief(result.output)
        supported = result.return_code == 0 and bool(parsed.cipher)
        if supported:
            negotiated = (parsed.negotiated_group or "").strip()
            out.append(negotiated or group)
    return _dedupe_keep_order(out)


def _run_batched_probes(tasks: list[Callable[[], CommandResult]], batch_size: int) -> list[CommandResult]:
    if not tasks:
        return []

    results: list[CommandResult | None] = [None] * len(tasks)
    safe_batch_size = max(1, batch_size)

    next_task_index = 0
    with ThreadPoolExecutor(max_workers=min(safe_batch_size, len(tasks))) as executor:
        in_flight: dict = {}

        # Prime the sliding window.
        while next_task_index < len(tasks) and len(in_flight) < safe_batch_size:
            future = executor.submit(tasks[next_task_index])
            in_flight[future] = next_task_index
            next_task_index += 1

        while in_flight:
            done, _ = wait(in_flight, return_when=FIRST_COMPLETED)
            for future in done:
                idx = in_flight.pop(future)
                try:
                    results[idx] = future.result()
                except Exception as exc:  # noqa: BLE001
                    results[idx] = CommandResult(
                        command="parallel_probe",
                        return_code=1,
                        output=f"[internal-error] probe execution failed: {exc}",
                    )

                if next_task_index < len(tasks):
                    next_future = executor.submit(tasks[next_task_index])
                    in_flight[next_future] = next_task_index
                    next_task_index += 1

    return [result for result in results if result is not None]


def _resolve_target_ip(target: str) -> str | None:
    raw = target.strip().strip("[]")
    if not raw:
        return None

    try:
        return str(ipaddress.ip_address(raw))
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(raw, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
    except OSError:
        return None

    for info in infos:
        sockaddr = info[4]
        if sockaddr:
            ip = sockaddr[0]
            if ip:
                return ip
    return None


def _build_identifier_section(
    *,
    cert_summary,
    queried_groups: list[str],
    supported_groups: list[str],
    tls_negotiation_order: list[str],
    version_probes: list[VersionProbe],
) -> IdentifierSection:
    cert_entries: list[IdentifierEntry] = []
    for item in [cert_summary.signature_algorithm, cert_summary.public_key_algorithm]:
        if item and item.name:
            cert_entries.append(IdentifierEntry(name=item.name, oid=item.oid))
    cert_entries = _dedupe_identifier_entries(cert_entries)

    group_names = _dedupe_keep_order([*queried_groups, *supported_groups])
    group_entries = [
        IdentifierEntry(name=name, iana_code=TLS_GROUP_IANA_MAP.get(name.lower()))
        for name in group_names
    ]

    suites = list(tls_negotiation_order)
    suites.extend(
        b.suite
        for probe in version_probes
        for b in probe.cipher_breakdowns
    )
    suite_names = _dedupe_keep_order(suites)

    breakdown_by_suite = {}
    for probe in version_probes:
        for b in probe.cipher_breakdowns:
            breakdown_by_suite.setdefault(b.suite.upper(), b)

    suite_entries = [
        IdentifierEntry(
            name=name,
            oid=_derive_cipher_suite_oid(name, breakdown_by_suite),
            iana_code=TLS_CIPHER_IANA_MAP.get(name.upper()),
        )
        for name in suite_names
    ]

    return IdentifierSection(
        certificate_algorithms=cert_entries,
        tls_groups=group_entries,
        tls_cipher_suites=suite_entries,
    )


def _dedupe_identifier_entries(entries: list[IdentifierEntry]) -> list[IdentifierEntry]:
    seen: set[tuple[str, str | None, str | None]] = set()
    out: list[IdentifierEntry] = []
    for entry in entries:
        key = (entry.name, entry.oid, entry.iana_code)
        if key in seen:
            continue
        seen.add(key)
        out.append(entry)
    return out


def _derive_cipher_suite_oid(name: str, breakdown_by_suite: dict[str, object]) -> str | None:
    breakdown = breakdown_by_suite.get(name.upper())
    if breakdown is None:
        return None

    enc = getattr(breakdown, "encryption", None)
    hsh = getattr(breakdown, "hash", None)
    auth = getattr(breakdown, "authentication", None)

    for token in [enc, hsh, auth]:
        if not token:
            continue
        oid = TLS_CIPHER_COMPONENT_OID_MAP.get(str(token).upper())
        if oid:
            return oid
    return None
