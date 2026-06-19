import { prisma } from "@/lib/prisma";
import { refreshScanBatch } from "@/lib/scan-batch-server";

function getAssetType(value: string): "domain" | "ip" | "unknown" {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$/;
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  if (ipv4Regex.test(value) || ipv6Regex.test(value)) return "ip";
  if (domainRegex.test(value)) return "domain";
  return "unknown";
}

export interface RunSubdomainDiscoveryItemInput {
  orgId: string;
  assetId: string;
  scanId: string;
  batchId: string;
}

/**
 * Executes a single subdomain discovery scan item:
 * 1. Calls the Subfinder API for the root domain
 * 2. Upserts discovered subdomains as leaf asset rows
 * 3. Marks the scan item completed (or failed on error)
 * 4. Refreshes the batch aggregate counters via refreshScanBatch
 */
export async function runSubdomainDiscoveryItem(input: RunSubdomainDiscoveryItemInput): Promise<void> {
  const { orgId, assetId, scanId, batchId } = input;

  // Fetch the root domain value
  const assetRows = await prisma.$queryRawUnsafe<{ value: string }[]>(
    `SELECT value FROM "asset" WHERE id = $1 AND "organizationId" = $2 LIMIT 1`,
    assetId,
    orgId
  );

  if (assetRows.length === 0) {
    await markScanFailed(scanId, batchId, "Asset not found");
    return;
  }

  const domain = assetRows[0].value;
  const subfinderUrl = process.env.SUBFINDER_API_URL || "http://127.0.0.1:8085";

  let subdomains: string[] = [];

  try {
    const response = await fetch(`${subfinderUrl}/subdomains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
      signal: AbortSignal.timeout(240_000), // 4 min per domain
    });

    if (!response.ok) {
      throw new Error(`Subfinder returned ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const data: unknown = JSON.parse(text);

    if (Array.isArray(data)) {
      subdomains = data as string[];
    } else if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.subdomains)) subdomains = obj.subdomains as string[];
      else if (Array.isArray(obj.data)) subdomains = obj.data as string[];
      else if (Array.isArray(obj.result)) subdomains = obj.result as string[];
    }
  } catch (err: any) {
    await markScanFailed(scanId, batchId, `Subfinder failed: ${err?.message ?? String(err)}`);
    return;
  }

  // Filter and deduplicate
  const uniqueSubs = [...new Set(subdomains)]
    .filter((s) => typeof s === "string" && s.trim().length > 0 && s !== domain);

  const now = new Date();
  let newCount = 0;

  const newAssets = uniqueSubs.map((sub) => ({
    id: crypto.randomUUID(),
    value: sub,
    type: getAssetType(sub),
    isRoot: false,
    organizationId: orgId,
    verified: false,
    openPorts: JSON.stringify([{ number: 443, protocol: "tcp" }]),
    createdAt: now,
    parentId: assetId,
  }));

  // Pinpoint exactly which subdomains are newly discovered by cross-referencing with the database
  const existingRecords = await prisma.asset.findMany({
    where: { parentId: assetId, value: { in: uniqueSubs } },
    select: { value: true }
  });
  const existingValues = new Set(existingRecords.map((a) => a.value));
  const trulyNewSubs = uniqueSubs.filter((sub) => !existingValues.has(sub));
  newCount = trulyNewSubs.length;

  if (newAssets.length > 0) {
    await prisma.asset.createMany({
      data: newAssets,
      skipDuplicates: true,
    });
  }

  // Update root asset lastScanDate
  await prisma.$executeRawUnsafe(
    `UPDATE "asset" SET "lastScanDate" = $1, "scanStatus" = 'idle' WHERE id = $2`,
    now,
    assetId
  );

  // Mark scan item completed — store total found + new count in resultData
  await prisma.$executeRawUnsafe(
    `UPDATE "asset_scan"
     SET status = 'completed', "resultData" = $1, "completedAt" = $2
     WHERE id = $3
       AND status IN ('pending', 'running')`,
    JSON.stringify({ discoveredCount: uniqueSubs.length, newCount }),
    now,
    scanId
  );

  // Refresh batch counters
  await refreshScanBatch(batchId);
}

async function markScanFailed(scanId: string, batchId: string, error: string): Promise<void> {
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `UPDATE "asset_scan"
     SET status = 'failed', "resultData" = $1, "completedAt" = $2
     WHERE id = $3
       AND status IN ('pending', 'running')`,
    JSON.stringify({ error }),
    now,
    scanId
  );
  await refreshScanBatch(batchId);
}
