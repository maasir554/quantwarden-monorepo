import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { createDefaultAssetPorts, normalizeAssetOpenPorts, type AssetPort, type PortProtocol } from "@/lib/port-discovery";

type OpenSSLScanStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface OpenSSLPortScanLike {
  id: string;
  status: OpenSSLScanStatus;
  resultData: string | null;
  createdAt: string | Date;
  completedAt: string | Date | null;
  portNumber?: number | null;
  portProtocol?: string | null;
}

export interface CurrentOpenSSLPort extends AssetPort {
  protocol: "tcp";
  key: string;
  label: string;
}

export interface OpenSSLPortTab<Scan extends OpenSSLPortScanLike> extends CurrentOpenSSLPort {
  latestScan: Scan | null;
  latestSuccessfulScan: Scan | null;
  latestTerminalScan: Scan | null;
  state: "unscanned" | "pending" | "running" | "completed" | "failed" | "cancelled" | "dnsExpired" | "noTls";
}

export interface OpenSSLAssetRollup<Scan extends OpenSSLPortScanLike> {
  currentTcpPorts: CurrentOpenSSLPort[];
  portTabs: OpenSSLPortTab<Scan>[];
  latestScan: Scan | null;
  latestSuccessfulScan: Scan | null;
  primarySummaryScan: Scan | null;
  primaryPortKey: string | null;
  scanStatus: "idle" | "completed" | "failed" | "expired" | "noTls";
  lastScanDate: string | Date | null;
}

function toMillis(value: string | Date | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortScansDesc<Scan extends OpenSSLPortScanLike>(scans: Scan[]) {
  return [...scans].sort((left, right) => {
    const leftTime = toMillis(left.completedAt || left.createdAt);
    const rightTime = toMillis(right.completedAt || right.createdAt);
    if (rightTime !== leftTime) return rightTime - leftTime;
    return toMillis(right.createdAt) - toMillis(left.createdAt);
  });
}

function toPortKey(number: number, protocol: PortProtocol) {
  return `${number}/${protocol}`;
}

export function getOpenSSLScanPort(scan: Pick<OpenSSLPortScanLike, "portNumber" | "portProtocol">): CurrentOpenSSLPort {
  const parsedNumber = Number(scan.portNumber);
  const number =
    Number.isInteger(parsedNumber) && parsedNumber >= 1 && parsedNumber <= 65535
      ? parsedNumber
      : 443;
  const protocol = "tcp" as const;

  return {
    number,
    protocol,
    key: toPortKey(number, protocol),
    label: `${number}/${protocol.toUpperCase()}`,
  };
}

export function getCurrentOpenSSLPorts(openPorts: unknown): CurrentOpenSSLPort[] {
  const normalized = normalizeAssetOpenPorts(openPorts).filter((port) => port.protocol === "tcp");
  const tcpPorts = normalized.length > 0 ? normalized : createDefaultAssetPorts().filter((port) => port.protocol === "tcp");

  return tcpPorts
    .sort((left, right) => {
      if (left.number === right.number) {
        return left.protocol.localeCompare(right.protocol);
      }
      return left.number - right.number;
    })
    .map((port) => ({
      ...port,
      protocol: "tcp" as const,
      key: toPortKey(port.number, "tcp"),
      label: `${port.number}/TCP`,
    }));
}

function isCompletedDnsExpired<Scan extends OpenSSLPortScanLike>(scan: Scan) {
  if (scan.status !== "completed") return false;
  return Boolean(parseOpenSSLScanResult(scan.resultData).summary?.dnsMissing);
}

function isCompletedNoTls<Scan extends OpenSSLPortScanLike>(scan: Scan) {
  if (scan.status !== "completed") return false;
  return Boolean(parseOpenSSLScanResult(scan.resultData).summary?.noTlsDetected);
}

function isCompletedSuccess<Scan extends OpenSSLPortScanLike>(scan: Scan) {
  if (scan.status !== "completed") return false;
  const parsed = parseOpenSSLScanResult(scan.resultData);
  return !parsed.error && !parsed.summary?.dnsMissing && !parsed.summary?.noTlsDetected;
}

function isTerminal<Scan extends OpenSSLPortScanLike>(scan: Scan) {
  return scan.status === "completed" || scan.status === "failed";
}

export function buildOpenSSLPortTabs<Scan extends OpenSSLPortScanLike>(
  scans: Scan[],
  openPorts: unknown
): OpenSSLPortTab<Scan>[] {
  const currentTcpPorts = getCurrentOpenSSLPorts(openPorts);
  const sortedScans = sortScansDesc(scans);

  return currentTcpPorts.map((port) => {
    const scansForPort = sortedScans.filter((scan) => getOpenSSLScanPort(scan).key === port.key);
    const latestScan = scansForPort[0] || null;
    const latestSuccessfulScan = scansForPort.find((scan) => isCompletedSuccess(scan)) || null;
    const latestTerminalScan = scansForPort.find((scan) => isTerminal(scan)) || null;

    let state: OpenSSLPortTab<Scan>["state"] = "unscanned";
    if (latestScan) {
      if (latestScan.status === "pending") {
        state = "pending";
      } else if (latestScan.status === "running") {
        state = "running";
      } else if (latestScan.status === "failed") {
        state = "failed";
      } else if (latestScan.status === "cancelled") {
        state = "cancelled";
      } else if (isCompletedDnsExpired(latestScan)) {
        state = "dnsExpired";
      } else if (isCompletedNoTls(latestScan)) {
        state = "noTls";
      } else {
        state = "completed";
      }
    }

    return {
      ...port,
      latestScan,
      latestSuccessfulScan,
      latestTerminalScan,
      state,
    };
  });
}

export function deriveOpenSSLAssetRollup<Scan extends OpenSSLPortScanLike>(
  scans: Scan[],
  openPorts: unknown
): OpenSSLAssetRollup<Scan> {
  const portTabs = buildOpenSSLPortTabs(scans, openPorts);
  const sortedCurrentScans = sortScansDesc(
    scans.filter((scan) => portTabs.some((port) => port.key === getOpenSSLScanPort(scan).key))
  );

  const latestSuccessfulScan = sortedCurrentScans.find((scan) => isCompletedSuccess(scan)) || null;
  const latestScan = sortedCurrentScans.find((scan) => isTerminal(scan)) || null;
  const primarySummaryScan = latestSuccessfulScan || latestScan;

  let scanStatus: OpenSSLAssetRollup<Scan>["scanStatus"] = "idle";
  if (latestSuccessfulScan) {
    scanStatus = "completed";
  } else if (latestScan?.status === "failed") {
    scanStatus = "failed";
  } else if (latestScan && isCompletedDnsExpired(latestScan)) {
    scanStatus = "expired";
  } else if (latestScan && isCompletedNoTls(latestScan)) {
    scanStatus = "noTls";
  }

  return {
    currentTcpPorts: portTabs.map(({ latestScan: _latestScan, latestSuccessfulScan: _latestSuccessfulScan, latestTerminalScan: _latestTerminalScan, state: _state, ...port }) => port),
    portTabs,
    latestScan,
    latestSuccessfulScan,
    primarySummaryScan,
    primaryPortKey: primarySummaryScan ? getOpenSSLScanPort(primarySummaryScan).key : null,
    scanStatus,
    lastScanDate: latestScan ? (latestScan.completedAt || latestScan.createdAt) : null,
  };
}

export function formatOpenSSLTargetLabel(
  assetValue: string,
  portNumber?: number | null,
  portProtocol?: string | null
) {
  const port = getOpenSSLScanPort({ portNumber, portProtocol });
  return `${assetValue}:${port.number}/${port.protocol}`;
}
