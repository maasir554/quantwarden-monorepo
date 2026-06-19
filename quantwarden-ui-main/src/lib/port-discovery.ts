export type PortProtocol = "tcp" | "udp";

export interface AssetPort {
  number: number;
  protocol: PortProtocol;
}

export interface PortDiscoveryPresetEntry {
  port: number;
  title: string;
  enabled: boolean;
}

export interface PortDiscoveryConfig {
  entries: PortDiscoveryPresetEntry[];
  probeBatchSize: number;
  probeTimeoutMs: number;
}

export interface PortDiscoveryApiResponse {
  target?: string;
  resolved_addresses?: string[];
  protocol?: string;
  requested_port_count?: number;
  probed_port_count?: number;
  probe_batch_size?: number;
  probe_timeout_ms?: number;
  open_ports?: Array<{
    port?: number;
    addresses?: string[];
  }>;
  error?: string;
  detail?: string;
  timeout?: boolean;
}

export const DEFAULT_PORT_DISCOVERY_PROBE_BATCH_SIZE = 5;
export const MAX_PORT_DISCOVERY_PROBE_BATCH_SIZE = 10;
export const DEFAULT_PORT_DISCOVERY_PROBE_TIMEOUT_MS = 600;
export const MAX_PORT_DISCOVERY_PROBE_TIMEOUT_MS = 2000;

export const DEFAULT_PORT_DISCOVERY_ENTRIES: PortDiscoveryPresetEntry[] = [
  { port: 21, title: "FTP", enabled: true },
  { port: 22, title: "SSH", enabled: true },
  { port: 23, title: "Telnet", enabled: true },
  { port: 25, title: "Mail [SMTP]", enabled: true },
  { port: 53, title: "DNS", enabled: true },
  { port: 80, title: "Web Server [HTTP]", enabled: true },
  { port: 110, title: "Mail [POP]", enabled: true },
  { port: 137, title: "netbios", enabled: true },
  { port: 138, title: "netbios", enabled: true },
  { port: 139, title: "netbios", enabled: true },
  { port: 143, title: "Mail [IMAP]", enabled: true },
  { port: 443, title: "Web Server [HTTPS]", enabled: true },
  { port: 445, title: "Microsoft-DS Service", enabled: true },
  { port: 548, title: "Apple Filesharing Protocol", enabled: true },
  { port: 587, title: "Mail [SMTP Submission]", enabled: true },
  { port: 993, title: "Mail [IMAP SSL]", enabled: true },
  { port: 995, title: "Mail [POP SSL]", enabled: true },
  { port: 1433, title: "Database [MSSQL]", enabled: true },
  { port: 1701, title: "VPN [L2TP]", enabled: true },
  { port: 1723, title: "VPN [PPTP]", enabled: true },
  { port: 3306, title: "Database [MySQL]", enabled: true },
  { port: 5432, title: "Database [PgSQL]", enabled: true },
  { port: 8008, title: "Calendar Server [CalDAV]", enabled: true },
  { port: 8443, title: "Calendar Server [CalDAV SSL]", enabled: true },
];

export function createDefaultAssetPorts(): AssetPort[] {
  return [{ number: 443, protocol: "tcp" }];
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

export function normalizePortProtocol(value: unknown): PortProtocol {
  return String(value).toLowerCase() === "udp" ? "udp" : "tcp";
}

export function normalizeAssetOpenPorts(raw: unknown): AssetPort[] {
  if (Array.isArray(raw)) {
    const normalized = raw
      .map((entry) => {
        if (typeof entry === "number") {
          return Number.isFinite(entry)
            ? { number: clampInteger(entry, 1, 65535), protocol: "tcp" as const }
            : null;
        }

        if (typeof entry === "string") {
          const parsedNumber = Number(entry);
          return Number.isFinite(parsedNumber)
            ? { number: clampInteger(parsedNumber, 1, 65535), protocol: "tcp" as const }
            : null;
        }

        if (typeof entry === "object" && entry !== null) {
          const value = entry as Record<string, unknown>;
          const parsedNumber = Number(value.number ?? value.port);
          if (!Number.isFinite(parsedNumber)) return null;
          return {
            number: clampInteger(parsedNumber, 1, 65535),
            protocol: normalizePortProtocol(value.protocol ?? value.type),
          };
        }

        return null;
      })
      .filter((value): value is AssetPort => value !== null);

    const deduped = Array.from(
      new Map(normalized.map((port) => [`${port.number}-${port.protocol}`, port])).values()
    ).sort((left, right) => {
      if (left.number === right.number) {
        return left.protocol.localeCompare(right.protocol);
      }
      return left.number - right.number;
    });

    return deduped.length > 0 ? deduped : createDefaultAssetPorts();
  }

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return createDefaultAssetPorts();
  }

  try {
    return normalizeAssetOpenPorts(JSON.parse(raw));
  } catch {
    return createDefaultAssetPorts();
  }
}

export function mergeAssetOpenPorts(existing: unknown, discovered: AssetPort[]) {
  return normalizeAssetOpenPorts([...normalizeAssetOpenPorts(existing), ...discovered]);
}

export function createDefaultPortDiscoveryConfig(): PortDiscoveryConfig {
  return {
    entries: DEFAULT_PORT_DISCOVERY_ENTRIES.map((entry) => ({ ...entry })),
    probeBatchSize: DEFAULT_PORT_DISCOVERY_PROBE_BATCH_SIZE,
    probeTimeoutMs: DEFAULT_PORT_DISCOVERY_PROBE_TIMEOUT_MS,
  };
}

export function normalizePortDiscoveryEntries(raw: unknown): PortDiscoveryPresetEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return createDefaultPortDiscoveryConfig().entries;
  }

  const normalized = raw
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return null;
      const value = entry as Record<string, unknown>;
      const port = Number(value.port);
      const title = typeof value.title === "string" ? value.title.trim() : "";
      if (!Number.isInteger(port) || port < 1 || port > 65535 || title.length === 0) {
        return null;
      }
      return {
        port,
        title,
        enabled: Boolean(value.enabled),
      };
    })
    .filter((entry): entry is PortDiscoveryPresetEntry => entry !== null);

  const deduped = Array.from(
    new Map(normalized.map((entry) => [entry.port, entry])).values()
  ).sort((left, right) => left.port - right.port);

  return deduped.length > 0 ? deduped : createDefaultPortDiscoveryConfig().entries;
}

export function normalizePortDiscoveryConfig(raw: unknown): PortDiscoveryConfig {
  if (typeof raw !== "object" || raw === null) {
    return createDefaultPortDiscoveryConfig();
  }

  const value = raw as Record<string, unknown>;
  const entries = normalizePortDiscoveryEntries(value.entries);
  const probeBatchSize = clampInteger(
    Number(value.probeBatchSize) || DEFAULT_PORT_DISCOVERY_PROBE_BATCH_SIZE,
    1,
    MAX_PORT_DISCOVERY_PROBE_BATCH_SIZE
  );
  const probeTimeoutMs = clampInteger(
    Number(value.probeTimeoutMs) || DEFAULT_PORT_DISCOVERY_PROBE_TIMEOUT_MS,
    1,
    MAX_PORT_DISCOVERY_PROBE_TIMEOUT_MS
  );

  return {
    entries,
    probeBatchSize,
    probeTimeoutMs,
  };
}

export function parseStoredPortDiscoveryConfig(raw: {
  entries?: unknown;
  probeBatchSize?: unknown;
  probeTimeoutMs?: unknown;
} | null | undefined): PortDiscoveryConfig {
  if (!raw) return createDefaultPortDiscoveryConfig();

  let parsedEntries: unknown = raw.entries;
  if (typeof parsedEntries === "string") {
    try {
      parsedEntries = JSON.parse(parsedEntries);
    } catch {
      parsedEntries = undefined;
    }
  }

  return normalizePortDiscoveryConfig({
    entries: parsedEntries,
    probeBatchSize: raw.probeBatchSize,
    probeTimeoutMs: raw.probeTimeoutMs,
  });
}

export function getEnabledPortList(entries: PortDiscoveryPresetEntry[]) {
  return normalizePortDiscoveryEntries(entries)
    .filter((entry) => entry.enabled)
    .map((entry) => entry.port);
}

export function parsePortDiscoveryResponse(raw: unknown): PortDiscoveryApiResponse | null {
  if (typeof raw === "string") {
    try {
      return parsePortDiscoveryResponse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  if (typeof raw !== "object" || raw === null) return null;
  return raw as PortDiscoveryApiResponse;
}

export function extractPreferredResolvedIp(addresses: unknown): string | null {
  if (!Array.isArray(addresses)) return null;
  const normalized = addresses
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  if (normalized.length === 0) return null;

  const ipv4 = normalized.find((value) => /^(\d{1,3}\.){3}\d{1,3}$/.test(value));
  return ipv4 || normalized[0] || null;
}

export function extractDiscoveredPortsFromResponse(response: PortDiscoveryApiResponse | null): AssetPort[] {
  if (!response?.open_ports || !Array.isArray(response.open_ports)) {
    return [];
  }

  return normalizeAssetOpenPorts(
    response.open_ports.map((entry) => ({
      number: entry?.port,
      protocol: "tcp",
    }))
  ).filter((port) => port.number !== 443 || response.open_ports!.some((entry) => Number(entry?.port) === 443));
}

export function isPortDiscoveryTimeoutResult(raw: unknown) {
  const parsed = parsePortDiscoveryResponse(raw);
  const errorText =
    typeof parsed?.error === "string"
      ? parsed.error
      : typeof parsed?.detail === "string"
        ? parsed.detail
        : typeof raw === "string"
          ? raw
          : "";

  return Boolean(
    parsed?.timeout === true ||
    /timeout|timed out|target not responding|probe timeout/i.test(errorText)
  );
}

