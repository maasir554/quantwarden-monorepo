import { prisma } from "@/lib/prisma";
import { getOpenSSLScanPort } from "@/lib/openssl-port-rollup";
import { mergeAssetOpenPorts } from "@/lib/port-discovery";
import { refreshOpenSSLAssetState, refreshScanBatch } from "@/lib/scan-batch-server";

interface OpenSSLScanContext {
  value: string;
  type: string;
  portNumber: number | null;
  portProtocol: string | null;
}

export interface RunOpenSSLScanItemInput {
  orgId: string;
  assetId: string;
  scanId: string;
  batchId: string;
}

export interface RunOpenSSLScanItemResult {
  scanId: string;
  status: "completed" | "failed";
  data?: unknown;
  error?: string;
}

const DEFAULT_OPENSSL_PROBE_TIMEOUT_SECONDS = 3;
const DEFAULT_OPENSSL_REQUEST_TIMEOUT_MS = 15000;

type OpenSSLErrorKind = "request_timeout" | "service_unavailable" | "other";

function classifyOpenSSLError(error: unknown): OpenSSLErrorKind {
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

export function isOpenSSLServiceUnavailableError(error: unknown) {
  return classifyOpenSSLError(error) === "service_unavailable";
}

export function isOpenSSLRequestTimeoutError(error: unknown) {
  return classifyOpenSSLError(error) === "request_timeout";
}

async function loadOpenSSLScanContext(input: RunOpenSSLScanItemInput): Promise<OpenSSLScanContext | null> {
  const rows = await prisma.$queryRawUnsafe<OpenSSLScanContext[]>(
    `SELECT a.value, a.type, s."portNumber", s."portProtocol"
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

async function markScanFailure(input: RunOpenSSLScanItemInput, failurePayload: string) {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.$queryRawUnsafe(
      `UPDATE "asset_scan"
       SET type = 'openssl', status = 'failed', "resultData" = $1, "completedAt" = $2
       WHERE id = $3
         AND status IN ('pending', 'running')`,
      failurePayload,
      now,
      input.scanId
    );
  });

  await refreshOpenSSLAssetState(input.assetId, input.orgId);
  await refreshScanBatch(input.batchId);
}

async function markScanDeferred(input: RunOpenSSLScanItemInput, reason: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      `UPDATE "asset_scan"
       SET status = 'pending', "resultData" = $1, "completedAt" = NULL
       WHERE id = $2
         AND status = 'running'`,
      JSON.stringify({ error: reason, transient: true }),
      input.scanId
    );
  });

  await refreshOpenSSLAssetState(input.assetId, input.orgId);
  await refreshScanBatch(input.batchId);
}

export async function runOpenSSLScanItem(input: RunOpenSSLScanItemInput): Promise<RunOpenSSLScanItemResult> {
  const asset = await loadOpenSSLScanContext(input);

  if (!asset) {
    const failurePayload = JSON.stringify({ error: "Queued scan item not found." });
    await markScanFailure(input, failurePayload);
    return {
      scanId: input.scanId,
      status: "failed",
      error: "Queued scan item not found.",
    };
  }

  if (asset.type !== "domain") {
    const failurePayload = JSON.stringify({ error: "OpenSSL scans currently support domain assets only." });
    await markScanFailure(input, failurePayload);
    return {
      scanId: input.scanId,
      status: "failed",
      error: "OpenSSL scans currently support domain assets only.",
    };
  }

  const targetPort = getOpenSSLScanPort(asset);

  try {
    const opensslUrl = process.env.OPENSSL_API_URL || "http://127.0.0.1:8020";
    const parsedTimeout = Number.parseInt(
      process.env.OPENSSL_API_TIMEOUT_SECONDS || String(DEFAULT_OPENSSL_PROBE_TIMEOUT_SECONDS),
      10
    );
    const timeoutSeconds = Number.isFinite(parsedTimeout)
      ? Math.min(60, Math.max(3, parsedTimeout))
      : DEFAULT_OPENSSL_PROBE_TIMEOUT_SECONDS;
    const parsedBatchSize = Number.parseInt(process.env.OPENSSL_API_PROBE_BATCH_SIZE || "10", 10);
    const probeBatchSize = Number.isFinite(parsedBatchSize)
      ? Math.min(50, Math.max(1, parsedBatchSize))
      : 10;
    const parsedRequestTimeoutMs = Number.parseInt(process.env.OPENSSL_API_REQUEST_TIMEOUT_MS || "", 10);
    const requestTimeoutMs = Number.isFinite(parsedRequestTimeoutMs)
      ? Math.min(120000, Math.max(2000, parsedRequestTimeoutMs))
      : DEFAULT_OPENSSL_REQUEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    const response = await fetch(`${opensslUrl}/api/v1/openssl-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: asset.value,
        port: targetPort.number,
        timeout_seconds: timeoutSeconds,
        probe_batch_size: probeBatchSize,
        include_raw_debug: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const rawResult = await response.text();
    let parsed: unknown = null;

    try {
      parsed = JSON.parse(rawResult);
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const infrastructureError = response.status >= 500;
      const inferredError =
        typeof (parsed as any)?.error === "string"
          ? (parsed as any).error
          : rawResult || `OpenSSL scan failed with status ${response.status}.`;

      if (infrastructureError) {
        await markScanDeferred(input, `OpenSSL service unavailable (${response.status}). ${inferredError}`);
        const unavailableError = new Error(`OpenSSL service unavailable (${response.status})`);
        (unavailableError as any).opensslErrorKind = "service_unavailable";
        throw unavailableError;
      }

      const failurePayload =
        typeof parsed === "object" && parsed !== null
          ? JSON.stringify(parsed)
          : JSON.stringify({ error: rawResult || "OpenSSL scan failed." });

      await markScanFailure(input, failurePayload);
      return {
        scanId: input.scanId,
        status: "failed",
        data: parsed,
        error:
          typeof (parsed as any)?.error === "string"
            ? (parsed as any).error
            : `OpenSSL scan failed on port ${targetPort.number}.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.$queryRawUnsafe(
        `UPDATE "asset_scan"
         SET type = 'openssl', status = 'completed', "resultData" = $1, "completedAt" = $2
         WHERE id = $3
           AND status IN ('pending', 'running')`,
        rawResult,
        now,
        input.scanId
      );

      if (parsed && typeof parsed === "object") {
        const resolvedIp =
          "resolved_ip" in (parsed as Record<string, unknown>)
            ? ((parsed as Record<string, unknown>).resolved_ip as string | null | undefined) ?? null
            : null;
        const ensuredPorts = mergeAssetOpenPorts(null, [{ number: targetPort.number, protocol: "tcp" }]);

        await tx.$executeRawUnsafe(
          `UPDATE "asset"
           SET "resolvedIp" = $1,
               "openPorts" = COALESCE("openPorts", $2)
           WHERE id = $3`,
          resolvedIp,
          JSON.stringify(ensuredPorts),
          input.assetId
        );
      }
    });

    await refreshOpenSSLAssetState(input.assetId, input.orgId);
    await refreshScanBatch(input.batchId);

    return {
      scanId: input.scanId,
      status: "completed",
      data: parsed,
    };
  } catch (error: any) {
    const errorKind = classifyOpenSSLError(error);

    if (errorKind === "request_timeout") {
      const failurePayload = JSON.stringify({
        error: `OpenSSL request timeout on port ${targetPort.number}. Possibly port not open or target not responding.`,
        timeout: true,
      });

      await markScanFailure(input, failurePayload);

      return {
        scanId: input.scanId,
        status: "failed",
        error: `OpenSSL request timeout on port ${targetPort.number}. Possibly port not open or target not responding.`,
      };
    }

    if (errorKind === "service_unavailable") {
      await markScanDeferred(
        input,
        error?.message || "OpenSSL service unavailable. Scan deferred for retry."
      );

      if (!(error as any)?.opensslErrorKind) {
        (error as any).opensslErrorKind = errorKind;
      }
      throw error;
    }

    const failurePayload = JSON.stringify({
      error:
        error?.name === "AbortError"
          ? `OpenSSL scan timed out before port ${targetPort.number} completed negotiation.`
          : error?.message || `Failed execution on port ${targetPort.number}`,
    });

    await markScanFailure(input, failurePayload);

    return {
      scanId: input.scanId,
      status: "failed",
      error: error?.message || `Failed execution on port ${targetPort.number}`,
    };
  }
}
