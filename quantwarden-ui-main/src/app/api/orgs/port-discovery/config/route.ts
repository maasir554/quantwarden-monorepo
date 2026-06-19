import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import {
  createDefaultPortDiscoveryConfig,
  normalizePortDiscoveryConfig,
  parseStoredPortDiscoveryConfig,
} from "@/lib/port-discovery";

async function loadConfig(orgId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    entries: string;
    probeBatchSize: number;
    probeTimeoutMs: number;
  }>>(
    `SELECT id, entries, "probeBatchSize", "probeTimeoutMs"
     FROM "organization_port_discovery_config"
     WHERE "organizationId" = $1
     LIMIT 1`,
    orgId
  );

  const row = rows[0] ?? null;
  if (!row) return null;

  return {
    id: row.id,
    config: parseStoredPortDiscoveryConfig({
      entries: row.entries,
      probeBatchSize: row.probeBatchSize,
      probeTimeoutMs: row.probeTimeoutMs,
    }),
  };
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
      return NextResponse.json({ error: "Missing orgId." }, { status: 400 });
    }

    const access = await getOrgScanAccess(orgId, session.user.id);
    if (!access?.canScan) {
      return NextResponse.json({ error: "Forbidden: You do not have scan permission." }, { status: 403 });
    }

    let config = await loadConfig(orgId);
    if (!config) {
      const defaultConfig = createDefaultPortDiscoveryConfig();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "organization_port_discovery_config"
          (id, "organizationId", entries, "probeBatchSize", "probeTimeoutMs", "updatedByUserId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT ("organizationId")
         DO NOTHING`,
        crypto.randomUUID(),
        orgId,
        JSON.stringify(defaultConfig.entries),
        defaultConfig.probeBatchSize,
        defaultConfig.probeTimeoutMs,
        session.user.id
      );

      config = await loadConfig(orgId);
    }

    return NextResponse.json({
      success: true,
      config: config?.config || createDefaultPortDiscoveryConfig(),
    });
  } catch (error) {
    console.error("Port discovery config fetch error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const orgId = body?.orgId;
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId." }, { status: 400 });
    }

    const access = await getOrgScanAccess(orgId, session.user.id);
    if (!access?.canScan) {
      return NextResponse.json({ error: "Forbidden: You do not have scan permission." }, { status: 403 });
    }

    const config = normalizePortDiscoveryConfig({
      entries: body?.entries,
      probeBatchSize: body?.probeBatchSize,
      probeTimeoutMs: body?.probeTimeoutMs,
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "organization_port_discovery_config"
        (id, "organizationId", entries, "probeBatchSize", "probeTimeoutMs", "updatedByUserId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT ("organizationId")
       DO UPDATE
       SET entries = EXCLUDED.entries,
           "probeBatchSize" = EXCLUDED."probeBatchSize",
           "probeTimeoutMs" = EXCLUDED."probeTimeoutMs",
           "updatedByUserId" = EXCLUDED."updatedByUserId",
           "updatedAt" = NOW()`,
      crypto.randomUUID(),
      orgId,
      JSON.stringify(config.entries),
      config.probeBatchSize,
      config.probeTimeoutMs,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("Port discovery config save error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
