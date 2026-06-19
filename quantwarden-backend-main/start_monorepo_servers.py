#!/usr/bin/env python3
"""Monorepo launcher for OneForAll API, Subfinder API, PySSL API, Nmap API, and OpenSSL API."""

from __future__ import annotations

import argparse
import os
import signal
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parent
ONEFORALL_DIR = ROOT / "one-for-all-subdomains"
SUBFINDER_DIR = ROOT / "subfinder-api"
PYSSL_DIR = ROOT / "pyssl-api"
NMAP_DIR = ROOT / "nmap-api"
OPENSSL_DIR = ROOT / "openssl-api"

COLOR_RESET = "\033[0m"
COLOR_RED = "\033[31m"
COLOR_GREEN = "\033[32m"
COLOR_YELLOW = "\033[33m"
COLOR_BLUE = "\033[34m"
COLOR_MAGENTA = "\033[35m"
COLOR_CYAN = "\033[36m"
COLOR_BOLD = "\033[1m"


def supports_color() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    term = os.environ.get("TERM", "").lower().strip()
    if term in {"", "dumb"}:
        return False
    return sys.stdout.isatty()


USE_COLOR = supports_color()


def color(text: str, tone: str) -> str:
    if not USE_COLOR:
        return text
    return f"{tone}{text}{COLOR_RESET}"


def log_info(message: str) -> None:
    print(f"{color('[INFO]', COLOR_GREEN)} {message}")


def log_warn(message: str) -> None:
    print(f"{color('[WARN]', COLOR_YELLOW)} {message}")


def log_error(message: str) -> None:
    print(f"{color('[ERROR]', COLOR_RED)} {message}")


def log_setup(message: str) -> None:
    print(f"{color('[SETUP]', COLOR_CYAN)} {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Start OneForAll API, Subfinder API, PySSL API, Nmap API, and OpenSSL API with auto port management."
    )
    parser.add_argument("--setup", action="store_true", help="Interactive setup wizard.")
    parser.add_argument("--host", default="127.0.0.1", help="Host for URL display and port checks.")

    parser.add_argument("--oneforall-port", type=int, default=8002, help="Preferred OneForAll API port.")
    parser.add_argument("--subfinder-port", type=int, default=8085, help="Preferred Subfinder API port.")
    parser.add_argument("--pyssl-port", type=int, default=8000, help="Preferred PySSL API port.")
    parser.add_argument("--nmap-port", type=int, default=8010, help="Preferred Nmap API port.")
    parser.add_argument("--openssl-port", type=int, default=8020, help="Preferred OpenSSL API port.")

    parser.add_argument(
        "--persist-env",
        action="store_true",
        help="Write resolved ONEFORALL_API_URL and SUBFINDER_API_ADDR into subfinder-api/.env.",
    )

    parser.add_argument(
        "--python-cmd",
        default="python3",
        help="Fallback Python command when a service virtualenv is not found.",
    )
    parser.add_argument(
        "--oneforall-python",
        default="",
        help="Explicit Python executable for OneForAll service.",
    )
    parser.add_argument(
        "--pyssl-python",
        default="",
        help="Explicit Python executable for PySSL service.",
    )
    parser.add_argument(
        "--nmap-python",
        default="",
        help="Explicit Python executable for Nmap service.",
    )
    parser.add_argument(
        "--openssl-python",
        default="",
        help="Explicit Python executable for OpenSSL service.",
    )
    parser.add_argument("--go-cmd", default="go", help="Go command used to run Subfinder API.")
    return parser.parse_args()


def ask_port(label: str, default: int) -> int:
    while True:
        user_input = input(f"{label} port [{default}]: ").strip()
        if user_input == "":
            return default
        if user_input.isdigit() and 1 <= int(user_input) <= 65535:
            return int(user_input)
        print("Please enter a valid port between 1 and 65535.")


def ask_yes_no(label: str, default: bool) -> bool:
    suffix = "Y/n" if default else "y/N"
    while True:
        user_input = input(f"{label} [{suffix}]: ").strip().lower()
        if user_input == "":
            return default
        if user_input in {"y", "yes"}:
            return True
        if user_input in {"n", "no"}:
            return False
        print("Please answer y or n.")


def is_port_free(host: str, port: int) -> bool:
    del host  # Port checks are done against wildcard interfaces used by services.

    ipv4_ok = True
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock4:
        sock4.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock4.bind(("0.0.0.0", port))
        except OSError:
            ipv4_ok = False

    ipv6_ok = True
    try:
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as sock6:
            sock6.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock6.bind(("::", port))
            except OSError:
                ipv6_ok = False
    except OSError:
        # Systems without IPv6 support should not fail port detection.
        ipv6_ok = True

    return ipv4_ok and ipv6_ok


def next_free_port(host: str, start_port: int) -> int:
    port = start_port
    while port <= 65535:
        if is_port_free(host, port):
            return port
        port += 1
    raise RuntimeError("no free port found")


def resolve_port(host: str, requested: int, service_name: str) -> int:
    if is_port_free(host, requested):
        log_info(f"{service_name} using requested port {requested}")
        return requested

    fallback = next_free_port(host, requested + 1)
    log_warn(f"{service_name} port {requested} is busy, switching to {fallback}")
    return fallback


def upsert_env_file(env_path: Path, updates: Dict[str, str]) -> None:
    lines: List[str] = []
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()

    remaining = updates.copy()
    out_lines: List[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in line:
            out_lines.append(line)
            continue

        key, _ = line.split("=", 1)
        key = key.strip()
        if key in remaining:
            out_lines.append(f"{key}={remaining.pop(key)}")
        else:
            out_lines.append(line)

    for key, value in remaining.items():
        out_lines.append(f"{key}={value}")

    env_path.write_text("\n".join(out_lines).rstrip() + "\n", encoding="utf-8")


def resolve_python_executable(service_name: str, service_dir: Path, explicit: str, fallback: str) -> str:
    if explicit.strip():
        path = Path(explicit).expanduser()
        if path.exists() and os.access(path, os.X_OK):
            log_setup(f"{service_name} using explicit python: {path}")
            return str(path)
        raise RuntimeError(f"{service_name} explicit python not executable: {explicit}")

    candidates = [service_dir / ".venv" / "bin" / "python", service_dir / "venv" / "bin" / "python"]
    for candidate in candidates:
        if candidate.exists() and os.access(candidate, os.X_OK):
            log_setup(f"{service_name} using virtualenv python: {candidate}")
            return str(candidate)

    resolved = shutil.which(fallback)
    if not resolved:
        raise RuntimeError(f"{service_name} fallback python not found in PATH: {fallback}")

    log_warn(f"{service_name} virtualenv not found; falling back to: {resolved}")
    return resolved


def python_has_module(python_exec: str, module_name: str) -> bool:
    check = subprocess.run(
        [python_exec, "-c", f"import {module_name}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
        text=True,
    )
    return check.returncode == 0


def python_has_modules(python_exec: str, module_names: List[str]) -> bool:
    return all(python_has_module(python_exec, mod) for mod in module_names)


def ensure_python_service_ready(
    service_name: str,
    python_exec: str,
    service_dir: Path,
    module_names: List[str] | None = None,
    alternates: List[str] | None = None,
) -> str:
    required = module_names or ["uvicorn", "fastapi", "pydantic"]

    if python_has_modules(python_exec, required):
        return python_exec

    for alt in alternates or []:
        if not alt or alt == python_exec:
            continue
        if python_has_modules(alt, required):
            log_warn(
                f"{service_name} selected python is missing required modules {required}; "
                f"switching to compatible interpreter: {alt}"
            )
            return alt

    requirements = service_dir / "requirements.txt"
    if not requirements.exists():
        raise RuntimeError(
            f"{service_name} python '{python_exec}' is missing required modules {required} and no requirements.txt was found"
        )

    log_warn(f"{service_name} missing {required} in selected python; installing dependencies from {requirements}")
    install = subprocess.run(
        [python_exec, "-m", "pip", "install", "-r", str(requirements)],
        cwd=str(service_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    if install.returncode != 0:
        raise RuntimeError(
            f"{service_name} dependency bootstrap failed (exit {install.returncode}):\n{install.stdout[-1200:]}"
        )

    if not python_has_modules(python_exec, required):
        raise RuntimeError(f"{service_name} still missing required modules {required} after dependency bootstrap")

    log_setup(f"{service_name} dependencies installed successfully")
    return python_exec


class ManagedProcess:
    def __init__(self, name: str, tag_color: str, command: List[str], cwd: Path, env: Dict[str, str]) -> None:
        self.name = name
        self.tag_color = tag_color
        self.command = command
        self.cwd = cwd
        self.env = env
        self.proc: subprocess.Popen[str] | None = None
        self.thread: threading.Thread | None = None

    def start(self) -> None:
        label = color(f"[{self.name}]", self.tag_color)
        log_info(f"starting {self.name}: {' '.join(self.command)}")
        self.proc = subprocess.Popen(
            self.command,
            cwd=str(self.cwd),
            env=self.env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        def stream_output() -> None:
            assert self.proc is not None
            assert self.proc.stdout is not None
            for line in self.proc.stdout:
                print(f"{label} {line.rstrip()}")

        self.thread = threading.Thread(target=stream_output, daemon=True)
        self.thread.start()

    def poll(self) -> int | None:
        if self.proc is None:
            return None
        return self.proc.poll()

    def terminate(self) -> None:
        if self.proc is None:
            return
        if self.proc.poll() is not None:
            return
        self.proc.terminate()

    def kill(self) -> None:
        if self.proc is None:
            return
        if self.proc.poll() is not None:
            return
        self.proc.kill()


def main() -> int:
    args = parse_args()

    if args.setup:
        log_setup("Interactive setup started")
        args.oneforall_port = ask_port("OneForAll API", args.oneforall_port)
        args.subfinder_port = ask_port("Subfinder API", args.subfinder_port)
        args.pyssl_port = ask_port("PySSL API", args.pyssl_port)
        args.nmap_port = ask_port("Nmap API", args.nmap_port)
        args.openssl_port = ask_port("OpenSSL API", args.openssl_port)
        args.persist_env = ask_yes_no("Persist Subfinder .env updates", args.persist_env)

    oneforall_port = resolve_port(args.host, args.oneforall_port, "OneForAll API")
    subfinder_port = resolve_port(args.host, args.subfinder_port, "Subfinder API")

    pyssl_candidate = args.pyssl_port
    if pyssl_candidate in {oneforall_port, subfinder_port}:
        log_warn(
            f"PySSL preferred port {pyssl_candidate} conflicts with another service; selecting a free port automatically"
        )
    pyssl_port = resolve_port(args.host, pyssl_candidate, "PySSL API")
    if pyssl_port in {oneforall_port, subfinder_port}:
        pyssl_port = resolve_port(args.host, pyssl_port + 1, "PySSL API")

    nmap_candidate = args.nmap_port
    if nmap_candidate in {oneforall_port, subfinder_port, pyssl_port}:
        log_warn(f"Nmap preferred port {nmap_candidate} conflicts with another service; selecting a free port automatically")
    nmap_port = resolve_port(args.host, nmap_candidate, "Nmap API")
    while nmap_port in {oneforall_port, subfinder_port, pyssl_port}:
        nmap_port = resolve_port(args.host, nmap_port + 1, "Nmap API")

    openssl_candidate = args.openssl_port
    if openssl_candidate in {oneforall_port, subfinder_port, pyssl_port, nmap_port}:
        log_warn(
            f"OpenSSL preferred port {openssl_candidate} conflicts with another service; selecting a free port automatically"
        )
    openssl_port = resolve_port(args.host, openssl_candidate, "OpenSSL API")
    while openssl_port in {oneforall_port, subfinder_port, pyssl_port, nmap_port}:
        openssl_port = resolve_port(args.host, openssl_port + 1, "OpenSSL API")

    oneforall_url = f"http://{args.host}:{oneforall_port}"
    subfinder_addr = f":{subfinder_port}"

    if args.persist_env:
        env_path = SUBFINDER_DIR / ".env"
        upsert_env_file(
            env_path,
            {
                "ONEFORALL_API_URL": oneforall_url,
                "SUBFINDER_API_ADDR": subfinder_addr,
            },
        )
        log_setup(f"updated {env_path} with ONEFORALL_API_URL and SUBFINDER_API_ADDR")
    else:
        log_setup("runtime-only env mode enabled (subfinder-api/.env not modified)")

    common_env = os.environ.copy()
    oneforall_python = resolve_python_executable(
        "OneForAll API", ONEFORALL_DIR, args.oneforall_python, args.python_cmd
    )
    pyssl_python = resolve_python_executable("PySSL API", PYSSL_DIR, args.pyssl_python, args.python_cmd)
    nmap_python = resolve_python_executable("Nmap API", NMAP_DIR, args.nmap_python, args.python_cmd)
    openssl_python = resolve_python_executable("OpenSSL API", OPENSSL_DIR, args.openssl_python, args.python_cmd)
    fallback_python = shutil.which(args.python_cmd) or ""

    pyssl_python = ensure_python_service_ready(
        "PySSL API",
        pyssl_python,
        PYSSL_DIR,
        alternates=[nmap_python, fallback_python],
    )
    nmap_python = ensure_python_service_ready(
        "Nmap API",
        nmap_python,
        NMAP_DIR,
        alternates=[pyssl_python, fallback_python],
    )
    openssl_python = ensure_python_service_ready(
        "OpenSSL API",
        openssl_python,
        OPENSSL_DIR,
        alternates=[nmap_python, pyssl_python, fallback_python],
    )

    oneforall = ManagedProcess(
        name="oneforall",
        tag_color=COLOR_MAGENTA,
        command=[oneforall_python, "run_api.py", "--port", str(oneforall_port)],
        cwd=ONEFORALL_DIR,
        env=common_env,
    )

    subfinder_env = common_env.copy()
    subfinder_env["ONEFORALL_API_URL"] = oneforall_url
    subfinder_env["SUBFINDER_API_ADDR"] = subfinder_addr

    subfinder = ManagedProcess(
        name="subfinder",
        tag_color=COLOR_CYAN,
        command=[args.go_cmd, "run", "."],
        cwd=SUBFINDER_DIR,
        env=subfinder_env,
    )

    pyssl = ManagedProcess(
        name="pyssl",
        tag_color=COLOR_BLUE,
        command=[pyssl_python, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(pyssl_port)],
        cwd=PYSSL_DIR,
        env=common_env,
    )

    nmap = ManagedProcess(
        name="nmap",
        tag_color=COLOR_YELLOW,
        command=[nmap_python, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(nmap_port)],
        cwd=NMAP_DIR,
        env=common_env,
    )

    openssl = ManagedProcess(
        name="openssl",
        tag_color=COLOR_GREEN,
        command=[openssl_python, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(openssl_port)],
        cwd=OPENSSL_DIR,
        env=common_env,
    )

    services = [oneforall, subfinder, pyssl, nmap, openssl]

    log_info(color("Monorepo services starting", COLOR_BOLD))
    log_info(f"OneForAll URL: {oneforall_url}")
    log_info(f"Subfinder URL: http://{args.host}:{subfinder_port}")
    log_info(f"PySSL URL: http://{args.host}:{pyssl_port}")
    log_info(f"Nmap URL: http://{args.host}:{nmap_port}")
    log_info(f"OpenSSL URL: http://{args.host}:{openssl_port}")

    try:
        for svc in services:
            svc.start()
            time.sleep(0.6)

        log_info("All services launched. Press Ctrl+C to stop all.")

        while True:
            for svc in services:
                code = svc.poll()
                if code is not None:
                    log_error(f"{svc.name} exited with code {code}; shutting down all services")
                    raise RuntimeError(f"{svc.name} exited")
            time.sleep(0.5)

    except KeyboardInterrupt:
        log_warn("Interrupted by user, stopping services")
        return_code = 0
    except Exception as exc:  # pylint: disable=broad-except
        log_error(f"launcher error: {exc}")
        return_code = 1
    else:
        return_code = 0

    for svc in services:
        svc.terminate()

    time.sleep(1.2)
    for svc in services:
        if svc.poll() is None:
            svc.kill()

    log_info("All services stopped")
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
