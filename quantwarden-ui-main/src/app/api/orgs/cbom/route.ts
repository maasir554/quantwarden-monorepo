import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { buildCbomResponse, type CbomScanSource } from "@/lib/cbom";
import { prisma } from "@/lib/prisma";

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
      `SELECT id
         FROM "member"
        WHERE "organizationId" = $1
          AND "userId" = $2
        LIMIT 1`,
      orgId,
      session.user.id
    );

    if (memberRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const latestCompletedEndpointScans = await prisma.$queryRawUnsafe<CbomScanSource[]>(
      `SELECT DISTINCT ON (
          s."assetId",
          COALESCE(s."portNumber", 443),
          LOWER(COALESCE(s."portProtocol", 'tcp'))
       )
          s."assetId" as "assetId",
          a.value as "assetName",
          a.type as "assetType",
          s."portNumber" as "portNumber",
          s."portProtocol" as "portProtocol",
          s."resultData" as "resultData"
       FROM "asset_scan" s
       INNER JOIN "asset" a ON a.id = s."assetId"
       WHERE a."organizationId" = $1
         AND s.type = 'openssl'
         AND s.status = 'completed'
       ORDER BY
         s."assetId",
         COALESCE(s."portNumber", 443),
         LOWER(COALESCE(s."portProtocol", 'tcp')),
         s."completedAt" DESC NULLS LAST,
         s."createdAt" DESC`,
      orgId
    );

    return NextResponse.json(buildCbomResponse(latestCompletedEndpointScans));
  } catch (error) {
    console.error("Failed to build org CBOM response", error);
    return NextResponse.json({ error: "Failed to build CERT-IN CBOM" }, { status: 500 });
  }
}
