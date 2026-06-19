from __future__ import annotations

import shlex
import subprocess
from dataclasses import dataclass


@dataclass(frozen=True)
class CommandResult:
    command: str
    return_code: int
    output: str


def _normalize_timeout_output(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, (bytes, bytearray)):
        return bytes(value).decode(errors="replace")
    return ""


def run_command(args: list[str], timeout_seconds: int, input_text: str | None = None) -> CommandResult:
    rendered = " ".join(shlex.quote(part) for part in args)
    try:
        proc = subprocess.run(
            args,
            input=input_text,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
        return CommandResult(command=rendered, return_code=proc.returncode, output=proc.stdout)
    except subprocess.TimeoutExpired as exc:
        output = _normalize_timeout_output(exc.stdout)
        output = output + f"\n[timeout] command exceeded {timeout_seconds}s"
        return CommandResult(command=rendered, return_code=124, output=output)


def openssl_s_client(
    *,
    target: str,
    port: int,
    sni: str,
    timeout_seconds: int,
    tls_flag: str,
    cipher: str | None = None,
    ciphersuite: str | None = None,
    groups: str | None = None,
    showcerts: bool = False,
) -> CommandResult:
    args = [
        "openssl",
        "s_client",
        "-connect",
        f"{target}:{port}",
        "-servername",
        sni,
        tls_flag,
    ]

    if not showcerts:
        args.append("-brief")

    if showcerts:
        args.append("-showcerts")

    if cipher:
        args.extend(["-cipher", cipher])

    if ciphersuite:
        args.extend(["-ciphersuites", ciphersuite])

    if groups:
        args.extend(["-groups", groups])

    return run_command(args, timeout_seconds, input_text="Q\n")


def openssl_ciphers(timeout_seconds: int) -> CommandResult:
    return run_command(["openssl", "ciphers", "-v", "ALL:@SECLEVEL=0"], timeout_seconds)


def openssl_tls13_groups(timeout_seconds: int) -> CommandResult:
    return run_command(["openssl", "list", "-tls-groups", "-tls1_3"], timeout_seconds)


def openssl_introspection(timeout_seconds: int) -> CommandResult:
    combined = []
    for cmd in [
        ["openssl", "version", "-a"],
        ["openssl", "list", "-public-key-algorithms"],
        ["openssl", "list", "-signature-algorithms"],
        ["openssl", "list", "-kem-algorithms"],
    ]:
        result = run_command(cmd, timeout_seconds)
        combined.append(f"$ {result.command}\n{result.output}")
    return CommandResult(command="openssl introspection", return_code=0, output="\n".join(combined))


def openssl_x509_from_pem(pem: str, timeout_seconds: int) -> CommandResult:
    args = [
        "openssl",
        "x509",
        "-noout",
        "-subject",
        "-issuer",
        "-serial",
        "-dates",
        "-text",
    ]
    rendered = " ".join(shlex.quote(part) for part in args)
    try:
        proc = subprocess.run(
            args,
            input=pem,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
        return CommandResult(command=rendered, return_code=proc.returncode, output=proc.stdout)
    except subprocess.TimeoutExpired as exc:
        output = _normalize_timeout_output(exc.stdout)
        output = output + f"\n[timeout] command exceeded {timeout_seconds}s"
        return CommandResult(command=rendered, return_code=124, output=output)
