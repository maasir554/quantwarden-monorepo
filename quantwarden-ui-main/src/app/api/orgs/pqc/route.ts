import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { calculatePqcScore, PqcAssessment } from "@/lib/pqc-scoring";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";

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

    // Get the latest openssl scan result for each asset/port pair
    // Note: We use Postgres DISTINCT ON to get the most recent scan per pair
    const scansQuery = `
      SELECT DISTINCT ON (s."assetId", s."portNumber")
        s.id,
        s."assetId",
        a.value as asset_value,
        s."portNumber",
        s."resultData",
        s."completedAt"
      FROM "asset_scan" s
      JOIN "asset" a ON s."assetId" = a.id
      WHERE a."organizationId" = $1
        AND s.type = 'openssl'
        AND s.status = 'completed'
        AND s."resultData" IS NOT NULL
      ORDER BY s."assetId", s."portNumber", s."createdAt" DESC
    `;

    const recentScans = await prisma.$queryRawUnsafe<any[]>(scansQuery, orgId);

    const assetScores = new Map<string, { value: string, scores: PqcAssessment[] }>();

    for (const scan of recentScans) {
      const parsed = parseOpenSSLScanResult(scan.resultData);
      if (parsed.raw) {
        const pqc = calculatePqcScore(parsed.raw);
        if (pqc) {
          if (!assetScores.has(scan.assetId)) {
            assetScores.set(scan.assetId, { value: scan.asset_value, scores: [] });
          }
          assetScores.get(scan.assetId)!.scores.push({ ...pqc, port: scan.portNumber } as any);
        }
      }
    }

    // Rollup logic
    let totalOrgScore = 0;
    let totalPortsScored = 0;
    const tierCounts = { A: 0, B: 0, C: 0, D: 0 };

    const assetsResponse = Array.from(assetScores.entries()).map(([id, data]) => {
      let assetTotal = 0;
      data.scores.forEach(s => {
        assetTotal += s.score;
        totalOrgScore += s.score;
        totalPortsScored++;
      });
      const avgAssetScore = data.scores.length > 0 ? Math.round(assetTotal / data.scores.length) : 0;
      
      let tier = "D";
      if (avgAssetScore >= 90) tier = "A";
      else if (avgAssetScore >= 75) tier = "B";
      else if (avgAssetScore >= 50) tier = "C";

      tierCounts[tier as keyof typeof tierCounts]++;

      return {
        id,
        value: data.value,
        averageScore: avgAssetScore,
        tier,
        ports: data.scores // the PqcAssessments with .port attached
      };
    });

    const orgAvgScore = totalPortsScored > 0 ? Math.round(totalOrgScore / totalPortsScored) : 0;
    
    let orgTier = "Pending";
    if (totalPortsScored > 0) {
      if (orgAvgScore >= 90) orgTier = "A";
      else if (orgAvgScore >= 75) orgTier = "B";
      else if (orgAvgScore >= 50) orgTier = "C";
      else orgTier = "D";
    }

    return NextResponse.json({
      organization: {
        averageScore: orgAvgScore,
        tier: orgTier,
        totalAssetsScored: assetScores.size,
        totalPortsScored,
        tierCounts
      },
      assets: assetsResponse
    });

  } catch (error) {
    console.error("PQC Posture fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
