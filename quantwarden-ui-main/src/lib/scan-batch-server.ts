import { prisma } from "@/lib/prisma";
import type {
  OrgScanActivityPayload,
  ScanActivityBatch,
  ScanBatchSource,
  ScanEngine,
  ScanHistoryCategory,
  ScanActivityItem,
  ScanBatchStatus,
  ScanBatchType,
  ScanFailureEntry,
  ScanHistoryEntry,
  ScanUpcomingEntry,
} from "@/lib/scan-activity-types";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { deriveOpenSSLAssetRollup } from "@/lib/openssl-port-rollup";
import { isPortDiscoveryTimeoutResult, parsePortDiscoveryResponse } from "@/lib/port-discovery";
import { ensureScanSchedulingTables } from "@/lib/scan-schedule-server";

export const MAX_OPENSSL_SCAN_CONCURRENCY = 5;
export const MAX_PORT_DISCOVERY_SCAN_CONCURRENCY = 2;

interface BatchRow {
  id: string;
  organizationId: string;
  engine: ScanEngine;
  type: ScanBatchType;
  source: string | null;
  status: ScanBatchStatus;
  configSnapshot: string | null;
  totalAssets: number;
  completedAssets: number;
  failedAssets: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  initiatedById: string | null;
  initiatedByName: string | null;
  initiatedByEmail: string | null;
}

interface UpcomingQueueRow {
  id: string;
  scheduleId: string;
  organizationId: string;
  engine: string;
  type: string;
  status: string;
  dueAt: Date;
  createdAt: Date;
  queuedBatchId: string | null;
  error: string | null;
  initiatedById: string | null;
  initiatedByName: string | null;
  initiatedByEmail: string | null;
}

interface ScanRow {
  id: string;
  batchId: string | null;
  assetId: string;
  assetValue: string;
  assetType: string;
  type: ScanEngine;
  portNumber: number | null;
  portProtocol: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  resultData: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface ClaimedScanItem {
  scanId: string;
  batchId: string;
  assetId: string;
  assetValue: string;
  portNumber: number | null;
  portProtocol: string | null;
  engine: ScanEngine;
  batchType: ScanBatchType;
  configSnapshot: string | null;
}

function extractError(resultData: string | null) {
  if (!resultData) return null;

  try {
    const parsed = JSON.parse(resultData);
    if (typeof parsed === "string") return parsed;
    if (typeof parsed?.detail === "string") return parsed.detail;
    if (typeof parsed?.error === "string") return parsed.error;
    return null;
  } catch {
    return null;
  }
}

function extractDiscoveredCount(resultData: string | null): number {
  if (!resultData) return 0;
  try {
    const parsed = JSON.parse(resultData);
    if (typeof parsed?.discoveredCount === "number") return parsed.discoveredCount;
    if (Array.isArray(parsed?.subdomains)) return parsed.subdomains.length;
    return 0;
  } catch {
    return 0;
  }
}

function extractNewCount(resultData: string | null): number {
  if (!resultData) return 0;
  try {
    const parsed = JSON.parse(resultData);
    if (typeof parsed?.newCount === "number") return parsed.newCount;
    return 0;
  } catch {
    return 0;
  }
}

function toPercentComplete(completedAssets: number, failedAssets: number, totalAssets: number) {
  if (totalAssets <= 0) return 0;
  return Math.min(100, Math.round(((completedAssets + failedAssets) / totalAssets) * 100));
}

function normalizeBatchSource(source: string | null | undefined): ScanBatchSource {
  if (source === "scheduled") return "scheduled";
  if (source === "automated") return "automated";
  return "manual";
}

function toBatch(batch: BatchRow, scans: ScanRow[]): ScanActivityBatch {
  const isSubdomainEngine = batch.engine === "subdomainDiscovery";
  const items: ScanActivityItem[] = scans.map((scan) => ({
    id: scan.id,
    assetId: scan.assetId,
    assetValue: scan.assetValue,
    portNumber: scan.portNumber,
    portProtocol: scan.portProtocol,
    status: scan.status,
    createdAt: scan.createdAt.toISOString(),
    completedAt: scan.completedAt ? scan.completedAt.toISOString() : null,
    error: scan.status === "failed" ? extractError(scan.resultData) : null,
    ...(isSubdomainEngine && scan.status === "completed" ? { discoveredCount: extractDiscoveredCount(scan.resultData), newCount: extractNewCount(scan.resultData) } : {}),
  }));

  const pendingAssets = items.filter((item) => item.status === "pending").length;
  const runningAssets = items.filter((item) => item.status === "running").length;
  const completedAssets = items.filter((item) => item.status === "completed").length;
  const failedAssets = items.filter((item) => item.status === "failed").length;
  const totalAssets = batch.totalAssets || items.length;

  return {
    id: batch.id,
    organizationId: batch.organizationId,
    engine: batch.engine,
    type: batch.type,
    source: normalizeBatchSource(batch.source),
    status: batch.status,
    totalAssets,
    completedAssets,
    failedAssets,
    pendingAssets,
    runningAssets,
    percentComplete: toPercentComplete(completedAssets, failedAssets, totalAssets),
    createdAt: batch.createdAt.toISOString(),
    startedAt: batch.startedAt ? batch.startedAt.toISOString() : null,
    completedAt: batch.completedAt ? batch.completedAt.toISOString() : null,
    initiatedBy: batch.initiatedById
      ? {
          id: batch.initiatedById,
          name: batch.initiatedByName,
          email: batch.initiatedByEmail,
        }
      : null,
    items,
  };
}

function isTimeoutFailure(resultData: string | null) {
  if (!resultData) return false;

  try {
    const parsed = JSON.parse(resultData);
    if (parsed?.timeout === true) return true;
    const errorText =
      typeof parsed?.error === "string"
        ? parsed.error
        : typeof parsed?.detail === "string"
          ? parsed.detail
          : typeof parsed === "string"
            ? parsed
            : null;

    return Boolean(errorText && /timeout|timed out|target not responding|port not open/i.test(errorText));
  } catch {
    return /timeout|timed out|target not responding|port not open/i.test(resultData);
  }
}

function classifyHistoryScan(scan: ScanRow): ScanHistoryCategory | null {
  if (scan.type === "portDiscovery") {
    const parsed = parsePortDiscoveryResponse(scan.resultData);

    if (scan.status === "completed") {
      const hasResolvedAddresses = Array.isArray(parsed?.resolved_addresses) && parsed.resolved_addresses.length > 0;
      if (scan.assetType === "domain" && !hasResolvedAddresses) {
        return "dnsExpired";
      }

      return "passed";
    }

    if (scan.status === "failed") {
      return isPortDiscoveryTimeoutResult(scan.resultData) ? "timeout" : "failed";
    }

    return null;
  }

  if (scan.status === "completed") {
    const parsed = parseOpenSSLScanResult(scan.resultData);
    if (parsed.summary?.dnsMissing) return "dnsExpired";
    if (parsed.summary?.noTlsDetected) return "failed";
    return "passed";
  }

  if (scan.status === "failed") {
    return isTimeoutFailure(scan.resultData) ? "timeout" : "failed";
  }

  return null;
}

function toHistoryEntry(batch: ScanActivityBatch, scans: ScanRow[]): ScanHistoryEntry {
  const items = scans
    .map((scan) => {
      const category = classifyHistoryScan(scan);
      if (!category) return null;

      return {
        scanId: scan.id,
        assetId: scan.assetId,
        assetValue: scan.assetValue,
        portNumber: scan.portNumber,
        portProtocol: scan.portProtocol,
        category,
        error: extractError(scan.resultData),
        createdAt: scan.createdAt.toISOString(),
        completedAt: scan.completedAt ? scan.completedAt.toISOString() : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      const leftTime = new Date(left.completedAt || left.createdAt).getTime();
      const rightTime = new Date(right.completedAt || right.createdAt).getTime();
      return rightTime - leftTime;
    });

  const passedAssets = items.filter((item) => item.category === "passed").length;
  const timeoutAssets = items.filter((item) => item.category === "timeout").length;
  const dnsExpiredAssets = items.filter((item) => item.category === "dnsExpired").length;
  const failedAssets = items.filter((item) => item.category === "failed").length;
  const failures = items.filter((item) => item.category === "timeout" || item.category === "failed");

  const startedAtMs = batch.startedAt ? new Date(batch.startedAt).getTime() : null;
  const completedAtMs = batch.completedAt ? new Date(batch.completedAt).getTime() : null;
  const durationSeconds =
    startedAtMs && completedAtMs && completedAtMs >= startedAtMs
      ? Math.round((completedAtMs - startedAtMs) / 1000)
      : null;

  return {
    batchId: batch.id,
    engine: batch.engine,
    type: batch.type,
    source: batch.source,
    status: batch.status,
    createdAt: batch.createdAt,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
    totalAssets: batch.totalAssets,
    passedAssets,
    timeoutAssets,
    failedAssets,
    dnsExpiredAssets,
    durationSeconds,
    items,
    failures,
  };
}

function toUpcomingQueueEntry(row: UpcomingQueueRow): ScanUpcomingEntry {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    organizationId: row.organizationId,
    engine: row.engine === "portDiscovery" ? "portDiscovery" : "openssl",
    type: row.type === "single" || row.type === "group" || row.type === "full" ? row.type : "full",
    source: "scheduled",
    status: row.status === "queued" ? "queued" : "pending",
    dueAt: row.dueAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    queuedBatchId: row.queuedBatchId,
    error: row.error,
    initiatedBy: row.initiatedById
      ? {
          id: row.initiatedById,
          name: row.initiatedByName,
          email: row.initiatedByEmail,
        }
      : null,
  };
}

export async function refreshScanBatch(batchId: string) {
  const rows = await prisma.$queryRawUnsafe<BatchRow[]>(
    `WITH stats AS (
        SELECT
          COUNT(*)::int as total,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0)::int as completed,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0)::int as failed,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)::int as pending,
          COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0)::int as running
        FROM "asset_scan"
        WHERE "batchId" = $1
      )
      UPDATE "asset_scan_batch" b
      SET
        "totalAssets" = stats.total,
        "completedAssets" = stats.completed,
        "failedAssets" = stats.failed,
        status = CASE
          WHEN b.status = 'cancelled' THEN 'cancelled'
          WHEN stats.running > 0 THEN 'running'
          WHEN stats.pending > 0 AND b."startedAt" IS NOT NULL THEN 'running'
          WHEN stats.pending > 0 THEN 'queued'
          WHEN stats.failed > 0 THEN 'failed'
          ELSE 'completed'
        END,
        "completedAt" = CASE
          WHEN stats.pending = 0 AND stats.running = 0 THEN COALESCE(b."completedAt", NOW())
          ELSE NULL
        END
      FROM stats
      WHERE b.id = $1
      RETURNING
        b.id,
        b."organizationId",
        b.engine,
        b.type,
        NULL::text as source,
        b.status,
        b."configSnapshot",
        b."totalAssets",
        b."completedAssets",
        b."failedAssets",
        b."createdAt",
        b."startedAt",
        b."completedAt",
        NULL::text as "initiatedById",
        NULL::text as "initiatedByName",
        NULL::text as "initiatedByEmail"`,
    batchId
  );

  return rows[0] ?? null;
}

export async function refreshOpenSSLAssetState(assetId: string, orgId: string) {
  const assetRows = await prisma.$queryRawUnsafe<{ id: string; openPorts: string | null }[]>(
    `SELECT id, "openPorts"
     FROM "asset"
     WHERE id = $1
       AND "organizationId" = $2
     LIMIT 1`,
    assetId,
    orgId
  );

  const asset = assetRows[0];
  if (!asset) return null;

  const scanRows = await prisma.$queryRawUnsafe<ScanRow[]>(
    `SELECT
        s.id,
        s."batchId",
        s."assetId",
        a.value as "assetValue",
        a.type as "assetType",
        s.type,
        s."portNumber" as "portNumber",
        s."portProtocol" as "portProtocol",
        s.status,
        s."resultData",
        s."createdAt",
        s."completedAt"
      FROM "asset_scan" s
      INNER JOIN "asset" a ON a.id = s."assetId"
      WHERE s."assetId" = $1
        AND a."organizationId" = $2
        AND s.type = 'openssl'
      ORDER BY
        COALESCE(s."completedAt", s."createdAt") DESC,
        s."createdAt" DESC`,
    assetId,
    orgId
  );

  const activeRows = await prisma.$queryRawUnsafe<{ activeCount: number }[]>(
    `SELECT COUNT(*)::int as "activeCount"
     FROM "asset_scan" s
     INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
     WHERE s."assetId" = $1
       AND b."organizationId" = $2
       AND s.type = 'openssl'
       AND s.status IN ('pending', 'running')`,
    assetId,
    orgId
  );

  const rollup = deriveOpenSSLAssetRollup(scanRows, asset.openPorts);
  const nextStatus = (activeRows[0]?.activeCount || 0) > 0 ? "scanning" : rollup.scanStatus;

  await prisma.$executeRawUnsafe(
    `UPDATE "asset"
     SET "scanStatus" = $1, "lastScanDate" = $2
     WHERE id = $3`,
    nextStatus,
    rollup.lastScanDate ? new Date(rollup.lastScanDate) : null,
    assetId
  );

  return rollup;
}

export async function getActiveScanLock(orgId: string) {
  await ensureScanSchedulingTables();

  const rows = await prisma.$queryRawUnsafe<BatchRow[]>(
      `SELECT
        b.id,
        b."organizationId",
        b.engine,
        b.type,
        COALESCE(b.source, CASE WHEN sr.id IS NULL THEN 'manual' ELSE 'scheduled' END) as source,
        b.status,
        b."configSnapshot",
        b."totalAssets",
        b."completedAssets",
        b."failedAssets",
        b."createdAt",
        b."startedAt",
        b."completedAt",
        u.id as "initiatedById",
        u.name as "initiatedByName",
        u.email as "initiatedByEmail"
      FROM "asset_scan_batch" b
      INNER JOIN "user" u ON u.id = b."initiatedByUserId"
      LEFT JOIN "org_scan_schedule_run" sr ON sr."queuedBatchId" = b.id
      WHERE b."organizationId" = $1
        AND b.status IN ('queued', 'running')
      ORDER BY b."createdAt" DESC
      LIMIT 1`,
    orgId
  );

  if (rows.length === 0) return null;
  return rows[0];
}

export async function listOrganizationsWithActiveScanWork(limit = 50) {
  const rows = await prisma.$queryRawUnsafe<{ organizationId: string }[]>(
    `SELECT DISTINCT b."organizationId" as "organizationId"
     FROM "asset_scan_batch" b
     WHERE b.status IN ('queued', 'running')
     ORDER BY b."organizationId" ASC
     LIMIT $1`,
    limit
  );

  return rows.map((row) => row.organizationId);
}

export async function claimNextPendingScan(orgId: string): Promise<ClaimedScanItem | null> {
  const claim = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
      orgId
    );

    const claimRows = await tx.$queryRawUnsafe<ClaimedScanItem[]>(
      `WITH next_scan AS (
          SELECT
            s.id as "scanId",
            s."batchId" as "batchId",
            s."assetId" as "assetId",
            a.value as "assetValue",
            s."portNumber" as "portNumber",
            s."portProtocol" as "portProtocol",
            b.engine as engine,
            b.type as "batchType",
            b."configSnapshot" as "configSnapshot"
          FROM "asset_scan" s
          INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
          INNER JOIN "asset" a ON a.id = s."assetId"
          WHERE b."organizationId" = $1
            AND b.status IN ('queued', 'running')
            AND s.status = 'pending'
          ORDER BY
            b."createdAt" ASC,
            CASE b.engine
              WHEN 'openssl' THEN 0
              ELSE 1
            END,
            CASE b.type
              WHEN 'full' THEN 0
              WHEN 'group' THEN 1
              ELSE 2
            END,
            s."createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "asset_scan" s
        SET status = 'running'
        FROM next_scan
        WHERE s.id = next_scan."scanId"
        RETURNING
          next_scan."scanId",
          next_scan."batchId",
          next_scan."assetId",
          next_scan."assetValue",
          next_scan."portNumber",
          next_scan."portProtocol",
          next_scan.engine,
          next_scan."batchType",
          next_scan."configSnapshot"`,
      orgId
    );

    if (claimRows.length === 0) {
      return null;
    }

    const nextClaim = claimRows[0];
    const runningRows = await tx.$queryRawUnsafe<{ running: number }[]>(
      `SELECT COUNT(*)::int as running
       FROM "asset_scan" s
       INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
       WHERE b."organizationId" = $1
         AND b.engine = $2
         AND b.status IN ('queued', 'running')
         AND s.status = 'running'`,
      orgId,
      nextClaim.engine
    );

    const engineLimit =
      nextClaim.engine === "portDiscovery"
        ? MAX_PORT_DISCOVERY_SCAN_CONCURRENCY
        : MAX_OPENSSL_SCAN_CONCURRENCY;

    if ((runningRows[0]?.running || 0) > engineLimit) {
      await tx.$executeRawUnsafe(
        `UPDATE "asset_scan" SET status = 'pending' WHERE id = $1`,
        nextClaim.scanId
      );
      return null;
    }

    await Promise.all([
      tx.$executeRawUnsafe(
        nextClaim.engine === "portDiscovery"
          ? `UPDATE "asset" SET "portDiscoveryStatus" = 'scanning' WHERE id = $1`
          : `UPDATE "asset" SET "scanStatus" = 'scanning' WHERE id = $1`,
        nextClaim.assetId
      ),
      tx.$executeRawUnsafe(
        `UPDATE "asset_scan_batch"
         SET status = 'running', "startedAt" = COALESCE("startedAt", $2)
         WHERE id = $1`,
        nextClaim.batchId,
        new Date()
      ),
    ]);

    return nextClaim;
  });

  if (claim?.batchId) {
    await refreshScanBatch(claim.batchId);
  }

  return claim;
}

export async function cancelScanBatch(orgId: string, batchId: string) {
  const now = new Date();
  const cancellationPayload = JSON.stringify({ error: "Scan batch cancelled by user." });

  const rows = await prisma.$transaction(async (tx) => {
    const batchRows = await tx.$queryRawUnsafe<BatchRow[]>(
      `SELECT
          b.id,
          b."organizationId",
          b.engine,
          b.type,
          b.status,
          b."configSnapshot",
          b."totalAssets",
          b."completedAssets",
          b."failedAssets",
          b."createdAt",
          b."startedAt",
          b."completedAt",
          NULL::text as "initiatedById",
          NULL::text as "initiatedByName",
          NULL::text as "initiatedByEmail"
        FROM "asset_scan_batch" b
        WHERE b.id = $1
          AND b."organizationId" = $2
        LIMIT 1`,
      batchId,
      orgId
    );

    const batch = batchRows[0];
    if (!batch || (batch.status !== "queued" && batch.status !== "running")) {
      return null;
    }

    const cancelledScanRows = await tx.$queryRawUnsafe<{ assetId: string }[]>(
      `UPDATE "asset_scan"
       SET
         status = 'cancelled',
         "resultData" = COALESCE("resultData", $2),
         "completedAt" = COALESCE("completedAt", $3)
       WHERE "batchId" = $1
         AND status IN ('pending', 'running')
       RETURNING "assetId"`,
      batchId,
      cancellationPayload,
      now
    );

    await tx.$executeRawUnsafe(
      `UPDATE "asset_scan_batch"
       SET status = 'cancelled', "completedAt" = $2
       WHERE id = $1`,
      batchId,
      now
    );

    return {
      batch,
      affectedAssetIds: Array.from(new Set(cancelledScanRows.map((row) => row.assetId))),
    };
  });

  if (!rows) return null;

  for (const assetId of rows.affectedAssetIds) {
    const previousTerminalRows = await prisma.$queryRawUnsafe<ScanRow[]>(
      `SELECT
          s.id,
          s."batchId",
          s."assetId",
          a.value as "assetValue",
          a.type as "assetType",
          s.type,
          s."portNumber" as "portNumber",
          s."portProtocol" as "portProtocol",
          s.status,
          s."resultData",
          s."createdAt",
          s."completedAt"
        FROM "asset_scan" s
        INNER JOIN "asset" a ON a.id = s."assetId"
        INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
        WHERE s."assetId" = $1
          AND b."organizationId" = $2
          AND s.type = $4
          AND s."batchId" <> $3
          AND s.status IN ('completed', 'failed')
        ORDER BY
          COALESCE(s."completedAt", s."createdAt") DESC,
          s."createdAt" DESC
        LIMIT 1`,
      assetId,
      orgId,
      batchId,
      rows.batch.engine
    );

    const previousTerminal = previousTerminalRows[0] || null;
    if (rows.batch.engine === "portDiscovery") {
      let restoredStatus: "idle" | "completed" | "failed" | "expired" = "idle";
      let restoredLastScanDate: Date | null = null;

      if (previousTerminal) {
        if (previousTerminal.status === "failed") {
          restoredStatus = isPortDiscoveryTimeoutResult(previousTerminal.resultData) ? "failed" : "failed";
        } else {
          const parsed = parsePortDiscoveryResponse(previousTerminal.resultData);
          const hasResolvedAddresses = Array.isArray(parsed?.resolved_addresses) && parsed.resolved_addresses.length > 0;
          restoredStatus = previousTerminal.assetType === "domain" && !hasResolvedAddresses ? "expired" : "completed";
        }

        restoredLastScanDate = previousTerminal.completedAt || previousTerminal.createdAt;
      }

      await prisma.$executeRawUnsafe(
        `UPDATE "asset"
         SET "portDiscoveryStatus" = $1, "lastPortDiscoveryDate" = $2
         WHERE id = $3`,
        restoredStatus,
        restoredLastScanDate,
        assetId
      );
    } else {
      await refreshOpenSSLAssetState(assetId, orgId);
    }
  }

  return rows.batch;
}

export async function getOrgScanActivity(orgId: string, canScan: boolean): Promise<OrgScanActivityPayload> {
  await ensureScanSchedulingTables();

  const batchRows = await prisma.$queryRawUnsafe<BatchRow[]>(
    `SELECT
          b.id,
          b."organizationId",
          b.engine,
          b.type,
          COALESCE(b.source, CASE WHEN sr.id IS NULL THEN 'manual' ELSE 'scheduled' END) as source,
          b.status,
        b."configSnapshot",
        b."totalAssets",
        b."completedAssets",
        b."failedAssets",
        b."createdAt",
        b."startedAt",
        b."completedAt",
        u.id as "initiatedById",
        u.name as "initiatedByName",
        u.email as "initiatedByEmail"
      FROM "asset_scan_batch" b
      INNER JOIN "user" u ON u.id = b."initiatedByUserId"
      LEFT JOIN "org_scan_schedule_run" sr ON sr."queuedBatchId" = b.id
      WHERE b."organizationId" = $1
      ORDER BY
        CASE
          WHEN b.status IN ('queued', 'running') THEN 0
          ELSE 1
        END,
        b."createdAt" DESC
      LIMIT 8`,
    orgId
  );

  const upcomingQueueRows = await prisma.$queryRawUnsafe<UpcomingQueueRow[]>(
    `SELECT
        r.id,
        r."scheduleId" as "scheduleId",
        r."organizationId" as "organizationId",
        s.engine,
        s.type,
        r.status,
        r."dueAt" as "dueAt",
        r."createdAt" as "createdAt",
        r."queuedBatchId" as "queuedBatchId",
        r.error,
        u.id as "initiatedById",
        u.name as "initiatedByName",
        u.email as "initiatedByEmail"
      FROM "org_scan_schedule_run" r
      INNER JOIN "org_scan_schedule" s ON s.id = r."scheduleId"
      INNER JOIN "user" u ON u.id = s."createdByUserId"
      WHERE r."organizationId" = $1
        AND r.status = 'pending'
      ORDER BY r."dueAt" ASC, r."createdAt" ASC
      LIMIT 12`,
    orgId
  );

  const batchIds = batchRows.map((batch) => batch.id);
  const scanRows = batchIds.length > 0
    ? await prisma.$queryRawUnsafe<ScanRow[]>(
        `SELECT
            s.id,
            s."batchId",
            s."assetId",
            a.value as "assetValue",
            a.type as "assetType",
            s.type,
            s."portNumber" as "portNumber",
            s."portProtocol" as "portProtocol",
            s.status,
            s."resultData",
            s."createdAt",
            s."completedAt"
          FROM "asset_scan" s
          INNER JOIN "asset" a ON a.id = s."assetId"
          WHERE s."batchId" = ANY($1::text[])
          ORDER BY s."createdAt" DESC`,
        batchIds
      )
    : [];

  const scansByBatch = new Map<string, ScanRow[]>();
  for (const scan of scanRows) {
    if (!scan.batchId) continue;
    const existing = scansByBatch.get(scan.batchId) || [];
    existing.push(scan);
    scansByBatch.set(scan.batchId, existing);
  }

  const hydratedBatches = batchRows.map((batch) => toBatch(batch, scansByBatch.get(batch.id) || []));
  const activeBatches = hydratedBatches.filter((batch) => batch.status === "queued" || batch.status === "running");
  const recentHistoryBatches = hydratedBatches
    .filter((batch) => batch.status === "completed" || batch.status === "failed" || batch.status === "cancelled")
    .slice(0, 8);
  const latestCompletedBatch =
    hydratedBatches.find((batch) => batch.status === "completed" || batch.status === "failed" || batch.status === "cancelled") || null;
  const latestBatch = activeBatches[0] || latestCompletedBatch;
  const recentHistory = recentHistoryBatches
    .map((batch) => toHistoryEntry(batch, scansByBatch.get(batch.id) || []));
  const allFailures: ScanFailureEntry[] = recentHistory.flatMap((entry) =>
    entry.failures.map((failure) => ({
      ...failure,
      batchId: entry.batchId,
      engine: entry.engine,
      batchType: entry.type,
      batchSource: entry.source,
      batchStatus: entry.status,
    }))
  );
  const upcomingQueue = upcomingQueueRows.map(toUpcomingQueueEntry);
  // The running batch is the one with status 'running', or the first 'queued' if nothing is running yet
  const runningBatch = activeBatches.find((b) => b.status === "running") || null;
  const lockBatch = runningBatch || activeBatches[0] || null;
  // Queued batches are those waiting behind the running/first batch
  const queuedBatchCount = activeBatches.filter((b) => b.id !== lockBatch?.id).length;

  return {
    orgId,
    canScan,
    activeBatches,
    queuedBatchCount,
    upcomingQueue,
    latestCompletedBatch,
    latestBatch,
    recentHistoryBatches,
    recentHistory,
    allFailures,
    lock: lockBatch
      ? {
          active: true,
          batchId: lockBatch.id,
          engine: lockBatch.engine,
          type: lockBatch.type,
          source: lockBatch.source,
          status: lockBatch.status,
          message:
            lockBatch.source === "scheduled"
              ? lockBatch.engine === "portDiscovery"
                ? "A scheduled port discovery scan is queued or running for this organization."
                : "A scheduled OpenSSL scan is queued or running for this organization."
              : lockBatch.source === "automated"
                ? lockBatch.engine === "portDiscovery"
                  ? "An automated port discovery scan is running for this organization."
                  : "An automated OpenSSL scan is running for this organization."
                : lockBatch.engine === "portDiscovery"
                  ? lockBatch.type === "single"
                    ? "A port discovery scan is running for this organization."
                    : "A port discovery batch is running for this organization."
                  : lockBatch.type === "group"
                    ? "An OpenSSL group scan is running for this organization."
                    : lockBatch.type === "single"
                      ? "An OpenSSL scan is running for this organization."
                      : "An OpenSSL full scan is running for this organization.",
          initiatedAt: lockBatch.createdAt,
          initiatedBy: lockBatch.initiatedBy,
          percentComplete: lockBatch.percentComplete,
        }
      : {
          active: false,
          batchId: null,
          engine: null,
          type: null,
          source: null,
          status: null,
          message: null,
          initiatedAt: null,
          initiatedBy: null,
          percentComplete: 0,
        },
  };
}
