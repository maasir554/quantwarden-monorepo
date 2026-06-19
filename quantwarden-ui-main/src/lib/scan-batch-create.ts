import { prisma } from "@/lib/prisma";
import { getCurrentOpenSSLPorts } from "@/lib/openssl-port-rollup";
import { getEnabledPortList, normalizePortDiscoveryConfig } from "@/lib/port-discovery";
import type { ScanBatchType, ScanEngine } from "@/lib/scan-activity-types";

interface ActiveLockRow {
  id: string;
  engine: ScanEngine;
  type: ScanBatchType;
}

export interface CreateScanBatchInput {
  orgId: string;
  initiatedByUserId: string;
  type: ScanBatchType;
  engine?: ScanEngine;
  assetIds: string[];
  configSnapshot?: unknown;
  source?: "manual" | "automated";
}

export interface CreateScanBatchSuccess {
  ok: true;
  batchId: string;
  queuedAssets: number;
  batchType: ScanBatchType;
  engine: ScanEngine;
  /** true when this batch was queued behind an already-active batch */
  queued: boolean;
  /** 0 = will run immediately, 1+ = position in queue behind running batch */
  queuePosition: number;
}

export interface CreateScanBatchFailure {
  ok: false;
  status: number;
  error: string;
  lockBatchId?: string;
  lockEngine?: ScanEngine;
  lockType?: ScanBatchType;
}

export type CreateScanBatchResult = CreateScanBatchSuccess | CreateScanBatchFailure;

export function isCreateScanBatchFailure(result: CreateScanBatchResult): result is CreateScanBatchFailure {
  return result.ok === false;
}

const VALID_TYPES = new Set<ScanBatchType>(["single", "group", "full"]);
const VALID_ENGINES = new Set<ScanEngine>(["openssl", "portDiscovery", "subdomainDiscovery"]);

function lockMessage(lock: ActiveLockRow) {
  if (lock.engine === "portDiscovery") {
    return lock.type === "single"
      ? "A port discovery scan is already running for this organization."
      : "A port discovery batch is already running for this organization.";
  }

  if (lock.type === "group") {
    return "An OpenSSL group scan is already running for this organization.";
  }

  return lock.type === "single"
    ? "An OpenSSL scan is already running for this organization."
    : "An OpenSSL full scan is already running for this organization.";
}

export async function createScanBatch(input: CreateScanBatchInput): Promise<CreateScanBatchResult> {
  const orgId = input.orgId;
  const initiatedByUserId = input.initiatedByUserId;
  const type = input.type;
  const engine = input.engine && VALID_ENGINES.has(input.engine) ? input.engine : "openssl";
  const assetIds = Array.isArray(input.assetIds) ? Array.from(new Set(input.assetIds.filter(Boolean))) : [];

  if (!orgId || !initiatedByUserId || !type || !VALID_TYPES.has(type) || assetIds.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Invalid batch payload.",
    };
  }

  const batchId = crypto.randomUUID();
  const now = new Date();

  const transactionResult = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, orgId);

    // Count existing active/queued batches to determine queue position
    const activeBatchRows = await tx.$queryRawUnsafe<ActiveLockRow[]>(
      `SELECT b.id, b.engine, b.type
       FROM "asset_scan_batch" b
       WHERE b."organizationId" = $1
         AND b.status IN ('queued', 'running')
       ORDER BY b."createdAt" ASC`,
      orgId
    );
    const queuePosition = activeBatchRows.length; // 0 = nothing active, will start immediately

    const assetTypeFilter =
      engine === "portDiscovery"
        ? `type IN ('domain', 'ip')`
        : engine === "subdomainDiscovery"
          ? `type = 'domain' AND "isRoot" = true`
          : `type = 'domain'`;

    const assetRows = await tx.$queryRawUnsafe<{ id: string; value: string; openPorts: string | null }[]>(
      `SELECT id, value, "openPorts"
       FROM "asset"
       WHERE "organizationId" = $1
         AND ${assetTypeFilter}
         AND id = ANY($2::text[])
       ORDER BY value ASC`,
      orgId,
      assetIds
    );

    if (assetRows.length === 0) {
      return {
        ok: false as const,
        status: 400,
        error: engine === "portDiscovery"
          ? "No scannable assets were selected."
          : "No scannable domain assets were selected.",
      };
    }

    const activeScanRows = await tx.$queryRawUnsafe<{ assetId: string }[]>(
      `SELECT DISTINCT s."assetId" as "assetId"
       FROM "asset_scan" s
       INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
       WHERE b."organizationId" = $1
         AND b.status IN ('queued', 'running')
         AND s."assetId" = ANY($2::text[])`,
      orgId,
      assetRows.map((asset) => asset.id)
    );

    const activeAssetIds = new Set(activeScanRows.map((row) => row.assetId));
    const batchAssets = assetRows.filter((asset) => !activeAssetIds.has(asset.id));

    if (batchAssets.length === 0) {
      return {
        ok: false as const,
        status: 409,
        error: "Those assets already have active scans in progress.",
      };
    }

    if (type === "single" && batchAssets.length !== 1) {
      return {
        ok: false as const,
        status: 400,
        error: "Single scan batches must contain exactly one asset.",
      };
    }

    if (type === "group" && batchAssets.length < 2) {
      return {
        ok: false as const,
        status: 400,
        error: "Group scans require at least two selected assets.",
      };
    }

    const normalizedConfigSnapshot =
      engine === "portDiscovery"
        ? normalizePortDiscoveryConfig(input.configSnapshot)
        : null;

    if (
      engine === "portDiscovery" &&
      normalizedConfigSnapshot &&
      getEnabledPortList(normalizedConfigSnapshot.entries).length === 0
    ) {
      return {
        ok: false as const,
        status: 400,
        error: "Select at least one enabled port before starting port discovery.",
      };
    }

    const scanTargets =
      engine === "openssl"
        ? batchAssets.flatMap((asset) =>
            getCurrentOpenSSLPorts(asset.openPorts).map((port) => ({
              scanId: crypto.randomUUID(),
              assetId: asset.id,
              portNumber: port.number,
              portProtocol: port.protocol,
            }))
          )
        : batchAssets.map((asset) => ({
            scanId: crypto.randomUUID(),
            assetId: asset.id,
            portNumber: null,
            portProtocol: null,
          }));

    const scanIds = scanTargets.map((target) => target.scanId);
    const scanAssetIds = scanTargets.map((target) => target.assetId);

    await tx.$executeRawUnsafe(
      `INSERT INTO "asset_scan_batch"
        (id, "organizationId", "initiatedByUserId", engine, type, source, status, "configSnapshot", "totalAssets", "completedAssets", "failedAssets", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7, $8, 0, 0, $9)`,
      batchId,
      orgId,
      initiatedByUserId,
      engine,
      type,
      input.source || "manual",
      normalizedConfigSnapshot ? JSON.stringify(normalizedConfigSnapshot) : null,
      scanTargets.length,
      now
    );

    if (engine === "openssl") {
      const scanPortNumbers = scanTargets.map((target) => target.portNumber);
      const scanPortProtocols = scanTargets.map((target) => target.portProtocol);

      await tx.$executeRawUnsafe(
        `INSERT INTO "asset_scan" (id, "assetId", "batchId", type, "portNumber", "portProtocol", status, "createdAt")
         SELECT scan_row.scan_id, scan_row.asset_id, $5, $6, scan_row.port_number, scan_row.port_protocol, 'pending', $7
         FROM unnest($1::text[], $2::text[], $3::int[], $4::text[]) AS scan_row(scan_id, asset_id, port_number, port_protocol)`,
        scanIds,
        scanAssetIds,
        scanPortNumbers,
        scanPortProtocols,
        batchId,
        engine,
        now
      );
    } else {
      // portDiscovery and subdomainDiscovery — no port columns needed
      await tx.$executeRawUnsafe(
        `INSERT INTO "asset_scan" (id, "assetId", "batchId", type, status, "createdAt")
         SELECT scan_row.scan_id, scan_row.asset_id, $3, $4, 'pending', $5
         FROM unnest($1::text[], $2::text[]) AS scan_row(scan_id, asset_id)`,
        scanIds,
        scanAssetIds,
        batchId,
        engine,
        now
      );
    }

    return {
      ok: true as const,
      batchId,
      queuedAssets: scanTargets.length,
      batchType: type,
      engine,
      queued: queuePosition > 0,
      queuePosition,
    };
  }, {
    maxWait: 10_000,
    timeout: 15_000,
  });

  if (!transactionResult.ok) {
    return transactionResult;
  }

  return transactionResult;
}
