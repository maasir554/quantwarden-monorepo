import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { deriveOpenSSLAssetRollup } from "@/lib/openssl-port-rollup";

interface AssetRow {
  id: string;
  value: string;
  type: string;
  isRoot: boolean;
  parentId: string | null;
  scanStatus: string | null;
  lastScanDate: Date | null;
  openPorts: string | null;
}

interface ScanRow {
  id: string;
  assetId: string;
  type: string;
  portNumber: number | null;
  portProtocol: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  resultData: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const memberRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      orgId,
      session.user.id
    );

    if (memberRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assetRows = await prisma.$queryRawUnsafe<AssetRow[]>(
      `SELECT
         a.id,
         a.value,
         a.type,
         a."isRoot",
         a."parentId",
         a."scanStatus",
         a."lastScanDate",
         a."openPorts"
       FROM "asset" a
       WHERE a."organizationId" = $1
       ORDER BY a.value ASC`,
      orgId
    );

    const assetIds = assetRows.map((asset) => asset.id);
    const scanRows = assetIds.length > 0
      ? await prisma.$queryRawUnsafe<ScanRow[]>(
          `SELECT
             s.id,
             s."assetId",
             s.type,
             s."portNumber" as "portNumber",
             s."portProtocol" as "portProtocol",
             s.status,
             s."resultData",
             s."createdAt",
             s."completedAt"
           FROM "asset_scan" s
           WHERE s."assetId" = ANY($1::text[])
             AND s.type = 'openssl'
           ORDER BY
             COALESCE(s."completedAt", s."createdAt") DESC,
             s."createdAt" DESC`,
          assetIds
        )
      : [];

    const scansByAsset = new Map<string, ScanRow[]>();
    for (const scan of scanRows) {
      const existing = scansByAsset.get(scan.assetId) || [];
      existing.push(scan);
      scansByAsset.set(scan.assetId, existing);
    }

    const assets = assetRows.map((asset) => {
      const rollup = deriveOpenSSLAssetRollup(scansByAsset.get(asset.id) || [], asset.openPorts);
      return {
        id: asset.id,
        value: asset.value,
        type: asset.type,
        isRoot: asset.isRoot,
        parentId: asset.parentId,
        scanStatus: asset.scanStatus === "scanning" ? asset.scanStatus : rollup.scanStatus,
        lastScanDate: rollup.lastScanDate || asset.lastScanDate,
        latestScan: rollup.latestScan,
        latestSuccessfulScan: rollup.latestSuccessfulScan,
        primarySummaryScan: rollup.primarySummaryScan,
        primaryPortKey: rollup.primaryPortKey,
        currentTcpPorts: rollup.currentTcpPorts,
        portTabs: rollup.portTabs,
      };
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("Scans fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
