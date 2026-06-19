from dataclasses import dataclass
import threading
from typing import Any

from common import utils
from common.database import Database
from config import settings
from config.log import logger
from oneforall import OneForAll, version


@dataclass
class ScanOptions:
    brute: bool = False
    dns: bool = False
    req: bool = False
    port: str = "small"
    alive: bool = False
    takeover: bool = False


class ApiOneForAll(OneForAll):
    """OneForAll adapter that returns records in memory for API usage."""

    def check_param(self) -> None:
        if self.target is None and self.targets is None:
            raise ValueError("target or targets is required")

    def export_data(self) -> list[dict[str, Any]]:
        table_name = str(self.domain or "").replace(".", "_")
        db = Database()
        try:
            rows = db.export_data(table_name, self.alive, None)
            if rows is None:
                return []
            raw_rows = rows.as_dict()
            return [row for row in raw_rows if isinstance(row, dict)]
        finally:
            db.close()

    def run(self) -> None:
        logger.log("DEBUG", "Python " + utils.python_version())
        logger.log("DEBUG", "OneForAll " + version + " (API mode)")

        utils.check_dep()
        enable_check_network = bool(getattr(settings, "enable_check_network", True))
        self.access_internet = utils.get_net_env() if enable_check_network else True

        logger.log("INFOR", "Start running OneForAll in API mode")
        self.config_param()
        self.check_param()

        self.domains = utils.get_domains(self.target, self.targets)
        if not self.domains:
            raise ValueError("failed to obtain valid domain")

        for domain in self.domains:
            # Keep exact user input scope (e.g. pnb.bank.in) instead of collapsing to bank.in.
            self.domain = domain
            self.main()

        logger.log("INFOR", "Finished OneForAll in API mode")

    def run_scan(self) -> list[dict[str, Any]]:
        self.run()
        return self.datas


class OneForAllScanService:
    """Thread-safe service wrapper around OneForAll engine execution."""

    def __init__(self) -> None:
        self._scan_lock = threading.Lock()

    def scan(self, domain: str, options: ScanOptions) -> list[str]:
        normalized_domain = utils.match_main_domain(domain)
        if not normalized_domain:
            raise ValueError("invalid domain input")

        # API mode is intentionally collection-only: no massdns-backed paths.
        massdns_free_brute = False
        massdns_free_dns = False
        massdns_free_req = False

        def build_runner() -> ApiOneForAll:
            return ApiOneForAll(
                target=normalized_domain,
                brute=massdns_free_brute,
                dns=massdns_free_dns,
                req=massdns_free_req,
                port=options.port,
                alive=options.alive,
                takeover=options.takeover,
                fmt="json",
                path=None,
            )

        with self._scan_lock:
            rows = build_runner().run_scan()

        subdomains: set[str] = set()
        for row in rows:
            if not isinstance(row, dict):
                continue
            subdomain = row.get("subdomain")
            if isinstance(subdomain, str) and subdomain:
                subdomains.add(subdomain)
        return sorted(subdomains)
