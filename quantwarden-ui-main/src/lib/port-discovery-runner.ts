import { prisma } from "@/lib/prisma";
import { refreshScanBatch } from "@/lib/scan-batch-server";
import {
  extractDiscoveredPortsFromResponse,
  extractPreferredResolvedIp,
  getEnabledPortList,
  mergeAssetOpenPorts,
  normalizePortDiscoveryConfig,
  parsePortDiscoveryResponse,
  type PortDiscoveryConfig,
} from "@/lib/port-discovery";

interface PortDiscoveryContext {
  value: string;
  type: string;
  openPorts: string | null;
}

export interface RunPortDiscoveryItemInput {
  orgId: string;
  assetId: string;
  scanId: string;
  batchId: string;
  configSnapshot: string | null;
}

export interface RunPortDiscoveryItemResult {
  scanId: string;
  status: "completed" | "failed";
  data?: unknown;
  error?: string;
}

type PortDiscoveryErrorKind = "request_timeout" | "service_unavailable" | "other";

function classifyPortDiscoveryError(error: unknown): PortDiscoveryErrorKind {
  const message = String((error as any)?.message || error || "").toLowerCase();
  const name = String((error as any)?.name || "").toLowerCase();
  if (!message && !name) return "other";

  if (
    name === "aborterror" ||
    message.includes("aborterror") ||
    message.includes("aborted") ||
    message.includes("etimedout") ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return "request_timeout";
  }

  if (
    [
      "econnrefused",
      "fetch failed",
      "network",
      "503",
      "502",
      "gateway",
      "service unavailable",
      "connection refused",
      "socket hang up",
      "enotfound",
    ].some((needle) => message.includes(needle))
  ) {
    return "service_unavailable";
  }

  return "other";
}

export function isPortDiscoveryServiceUnavailableError(error: unknown) {
  return classifyPortDiscoveryError(error) === "service_unavailable";
}

export function isPortDiscoveryRequestTimeoutError(error: unknown) {
  return classifyPortDiscoveryError(error) === "request_timeout";
}

async function loadPortDiscoveryContext(input: RunPortDiscoveryItemInput): Promise<PortDiscoveryContext | null> {
  const rows = await prisma.$queryRawUnsafe<PortDiscoveryContext[]>(
    `SELECT a.value, a.type, a."openPorts"
     FROM "asset" a
     INNER JOIN "asset_scan" s ON s."assetId" = a.id
     INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
     WHERE a.id = $1
       AND a."organizationId" = $2
       AND s.id = $3
       AND s."batchId" = $4
       AND b."organizationId" = $2
     LIMIT 1`,
    input.assetId,
    input.orgId,
    input.scanId,
    input.batchId
  );

  return rows[0] ?? null;
}

async function markPortDiscoveryFailure(
  input: RunPortDiscoveryItemInput,
  failurePayload: string,
  options?: { updateAssetStatus?: boolean }
) {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const updatedScanRows = await tx.$queryRawUnsafe<{ assetId: string }[]>(
      `UPDATE "asset_scan"
       SET type = 'portDiscovery', status = 'failed', "resultData" = $1, "completedAt" = $2
       WHERE id = $3
         AND status IN ('pending', 'running')
       RETURNING "assetId"`,
      failurePayload,
      now,
      input.scanId
    );

    if (updatedScanRows.length > 0 && options?.updateAssetStatus !== false) {
      await tx.$executeRawUnsafe(
        `UPDATE "asset"
         SET "portDiscoveryStatus" = 'failed', "lastPortDiscoveryDate" = $1
         WHERE id = $2`,
        now,
        updatedScanRows[0].assetId
      );
    }
  });

  await refreshScanBatch(input.batchId);
}

export async function runPortDiscoveryItem(
  input: RunPortDiscoveryItemInput
): Promise<RunPortDiscoveryItemResult> {
  const asset = await loadPortDiscoveryContext(input);

  if (!asset) {
    const failurePayload = JSON.stringify({ error: "Queued port discovery item not found." });
    await markPortDiscoveryFailure(input, failurePayload);
    return {
      scanId: input.scanId,
      status: "failed",
      error: "Queued port discovery item not found.",
    };
  }

  let parsedSnapshot: PortDiscoveryConfig | null = null;
  if (input.configSnapshot) {
    try {
      parsedSnapshot = JSON.parse(input.configSnapshot) as PortDiscoveryConfig;
    } catch {
      parsedSnapshot = null;
    }
  }

  const config = normalizePortDiscoveryConfig(parsedSnapshot);
  const portList = getEnabledPortList(config.entries);

  if (portList.length === 0) {
    const failurePayload = JSON.stringify({ error: "No enabled ports were selected for discovery." });
    await markPortDiscoveryFailure(input, failurePayload);
    return {
      scanId: input.scanId,
      status: "failed",
      error: "No enabled ports were selected for discovery.",
    };
  }

  try {
    const nmapUrl = process.env.NMAP_API_URL || "http://127.0.0.1:8010";
    const requestTimeoutMs = Math.min(
      90000,
      Math.max(
        5000,
        config.probeTimeoutMs * Math.max(1, Math.min(portList.length, config.probeBatchSize)) * 2 + 5000
      )
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    const response = await fetch(`${nmapUrl}/api/v1/port-discovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: asset.value,
        port_list: portList,
        port_ranges: [],
        probe_batch_size: config.probeBatchSize,
        probe_timeout_ms: config.probeTimeoutMs,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const rawResult = await response.text();
    const parsed = parsePortDiscoveryResponse(rawResult);

    if (!response.ok) {
      const message =
        typeof parsed?.error === "string"
          ? parsed.error
          : typeof parsed?.detail === "string"
            ? parsed.detail
            : rawResult || `Port discovery failed with status ${response.status}.`;

      const failurePayload = JSON.stringify({
        error: message,
        status: response.status,
        timeout: /timeout|timed out/i.test(message),
      });

      await markPortDiscoveryFailure(input, failurePayload);

      if (response.status >= 500) {
        const serviceError = new Error(`Nmap service unavailable (${response.status})`);
        (serviceError as any).portDiscoveryErrorKind = "service_unavailable";
        throw serviceError;
      }

      return {
        scanId: input.scanId,
        status: "failed",
        data: parsed,
        error: message,
      };
    }

    const discoveredPorts = extractDiscoveredPortsFromResponse(parsed);
    const resolvedIp = extractPreferredResolvedIp(parsed?.resolved_addresses);
    const hasResolvedAddresses = Array.isArray(parsed?.resolved_addresses) && parsed.resolved_addresses.length > 0;
    const assetStatus = asset.type === "domain" && !hasResolvedAddresses ? "expired" : "completed";
    const mergedPorts = mergeAssetOpenPorts(asset.openPorts, discoveredPorts);

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updatedScanRows = await tx.$queryRawUnsafe<{ assetId: string }[]>(
        `UPDATE "asset_scan"
         SET type = 'portDiscovery', status = 'completed', "resultData" = $1, "completedAt" = $2
         WHERE id = $3
           AND status IN ('pending', 'running')
         RETURNING "assetId"`,
        rawResult,
        now,
        input.scanId
      );

      if (updatedScanRows.length > 0) {
        await tx.$executeRawUnsafe(
          `UPDATE "asset"
           SET "resolvedIp" = $1,
               "openPorts" = $2,
               "portDiscoveryStatus" = $3,
               "lastPortDiscoveryDate" = $4
           WHERE id = $5`,
          resolvedIp,
          JSON.stringify(mergedPorts),
          assetStatus,
          now,
          updatedScanRows[0].assetId
        );
      }
    });

    await refreshScanBatch(input.batchId);

    return {
      scanId: input.scanId,
      status: "completed",
      data: parsed,
    };
  } catch (error: any) {
    const errorKind = classifyPortDiscoveryError(error);

    if (errorKind === "request_timeout") {
      const failurePayload = JSON.stringify({
        error: "Port discovery request timed out.",
        timeout: true,
      });

      await markPortDiscoveryFailure(input, failurePayload);

      return {
        scanId: input.scanId,
        status: "failed",
        error: "Port discovery request timed out.",
      };
    }

    if (errorKind === "service_unavailable") {
      const failurePayload = JSON.stringify({
        error: error?.message || "Nmap service unavailable.",
        serviceUnavailable: true,
      });

      await markPortDiscoveryFailure(input, failurePayload);

      if (!(error as any)?.portDiscoveryErrorKind) {
        (error as any).portDiscoveryErrorKind = "service_unavailable";
      }

      throw error;
    }

    const failurePayload = JSON.stringify({
      error: error?.message || "Port discovery failed.",
    });

    await markPortDiscoveryFailure(input, failurePayload);

    return {
      scanId: input.scanId,
      status: "failed",
      error: error?.message || "Port discovery failed.",
    };
  }
}
