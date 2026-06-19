import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { calculatePqcScore } from "@/lib/pqc-scoring";
import { hasKyberGroup } from "@/lib/pqc";
import {
  getTierFromScore,
  getTierLabel,
  getTierStatus,
  OrganizationReportPayload,
  REPORT_ACTION_TIER_ORDER,
  REPORT_TIER_ORDER,
  type ReportAssetEntry,
  type ReportImmediateAttentionAsset,
  type ReportTier,
} from "@/lib/reporting";

type ReportingScanRow = {
  assetId: string;
  assetName: string;
  resultData: string | null;
  portNumber: number | null;
  portProtocol: string | null;
};

type AttentionBucketKey = "dns" | "certificate" | "tls";

const TLS_VERSION_RANK: Record<string, number> = {
  "TLSv1.3": 4,
  "TLSv1.2": 3,
  "TLSv1.1": 2,
  "TLSv1.0": 1,
};

function incrementCounter(counter: Record<string, number>, key: string | null | undefined) {
  if (!key) return;
  counter[key] = (counter[key] || 0) + 1;
}

function sortByCountDescending(counter: Record<string, number>) {
  return Object.entries(counter)
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => {
      const valueDelta = right.value - left.value;
      return valueDelta !== 0 ? valueDelta : left.name.localeCompare(right.name);
    });
}

function uniqueStrings(values: Array<string | null | undefined> | null | undefined) {
  return Array.from(new Set((values || []).filter((value): value is string => Boolean(value && value.trim()))));
}

function getLatestSupportedTlsVersion(summary: NonNullable<ReturnType<typeof parseOpenSSLScanResult>["summary"]>) {
  const discoveredTlsVersions = Array.from(
    new Set([...(summary.supportedTlsVersions || []), ...(summary.primaryTlsVersion ? [summary.primaryTlsVersion] : [])])
  );

  return (
    discoveredTlsVersions.sort((left, right) => {
      const rankDelta = (TLS_VERSION_RANK[right] || 0) - (TLS_VERSION_RANK[left] || 0);
      return rankDelta !== 0 ? rankDelta : left.localeCompare(right);
    })[0] || null
  );
}

function getPortLabel(portNumber: number | null, portProtocol: string | null) {
  return `${portNumber || 443}/${(portProtocol || "tcp").toUpperCase()}`;
}

function pushAttention(
  buckets: Record<AttentionBucketKey, ReportImmediateAttentionAsset[]>,
  key: AttentionBucketKey,
  asset: ReportImmediateAttentionAsset
) {
  const existing = buckets[key];
  if (!existing.some((entry) => entry.id === asset.id && entry.issue === asset.issue)) {
    existing.push(asset);
  }
}

function sortAssetsForAction(left: ReportAssetEntry, right: ReportAssetEntry) {
  const tierDelta = REPORT_ACTION_TIER_ORDER.indexOf(left.tier) - REPORT_ACTION_TIER_ORDER.indexOf(right.tier);
  if (tierDelta !== 0) return tierDelta;
  const scoreDelta = left.averageScore - right.averageScore;
  return scoreDelta !== 0 ? scoreDelta : left.value.localeCompare(right.value);
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

    const orgRows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; slug: string }>>(
      `SELECT id, name, slug
         FROM "organization"
        WHERE id = $1
        LIMIT 1`,
      orgId
    );

    if (orgRows.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const totalAssetsRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint as count
         FROM "asset"
        WHERE "organizationId" = $1`,
      orgId
    );

    const latestEndpointScans = await prisma.$queryRawUnsafe<ReportingScanRow[]>(
      `SELECT DISTINCT ON (s."assetId", s."portNumber")
          s."assetId" as "assetId",
          a.value as "assetName",
          s."resultData" as "resultData",
          s."portNumber" as "portNumber",
          s."portProtocol" as "portProtocol"
       FROM "asset_scan" s
       INNER JOIN "asset" a ON a.id = s."assetId"
       WHERE a."organizationId" = $1
         AND s.type = 'openssl'
         AND s.status = 'completed'
       ORDER BY s."assetId", s."portNumber", s."createdAt" DESC`,
      orgId
    );

    const tlsVersions: Record<string, number> = {};
    const attentionBuckets: Record<AttentionBucketKey, ReportImmediateAttentionAsset[]> = {
      dns: [],
      certificate: [],
      tls: [],
    };

    let reachableTlsEndpointCount = 0;
    let strongCipherCount = 0;
    let weakCipherCount = 0;
    let expiredCerts = 0;
    let closeDeadlineCerts = 0;
    let validCerts = 0;
    let selfSignedCount = 0;
    let tlsDowngradeVulnerable = 0;

    const assetScores = new Map<
      string,
      {
        value: string;
        scores: number[];
        portCount: number;
        supportsPqc: boolean;
        negotiatedPqc: boolean;
        primaryKeyExchange: string | null;
        primaryEncryption: string | null;
        bestScore: number;
      }
    >();

    for (const row of latestEndpointScans) {
      const parsed = parseOpenSSLScanResult(row.resultData);
      const summary = parsed.summary;
      const assessment = parsed.raw ? calculatePqcScore(parsed.raw) : null;
      const portLabel = getPortLabel(row.portNumber, row.portProtocol);

      if (summary) {
        const latestTlsVersion = getLatestSupportedTlsVersion(summary);
        incrementCounter(tlsVersions, latestTlsVersion);

        if (!summary.dnsMissing && !summary.noTlsDetected) {
          reachableTlsEndpointCount += 1;
        }

        if (summary.strongCipher === true) strongCipherCount += 1;
        if (summary.strongCipher === false) weakCipherCount += 1;

        if (summary.selfSignedCert === true) {
          selfSignedCount += 1;
        }

        if (typeof summary.daysRemaining === "number") {
          if (summary.daysRemaining < 0) expiredCerts += 1;
          else if (summary.daysRemaining <= 30) closeDeadlineCerts += 1;
          else validCerts += 1;
        } else if (summary.certificateValid === true) {
          validCerts += 1;
        }

        const supportedTlsVersions = uniqueStrings(summary.supportedTlsVersions);
        const maxTlsRank = Math.max(
          TLS_VERSION_RANK[summary.primaryTlsVersion || ""] || 0,
          ...supportedTlsVersions.map((version) => TLS_VERSION_RANK[version] || 0)
        );
        if (maxTlsRank > 0 && maxTlsRank < TLS_VERSION_RANK["TLSv1.3"]) {
          tlsDowngradeVulnerable += 1;
        }

        if (summary.dnsMissing) {
          pushAttention(attentionBuckets, "dns", {
            id: row.assetId,
            name: row.assetName,
            issue: `DNS expired on ${portLabel}`,
          });
        }

        if (
          summary.daysRemaining !== null &&
          summary.daysRemaining < 0
        ) {
          pushAttention(attentionBuckets, "certificate", {
            id: row.assetId,
            name: row.assetName,
            issue: `Expired certificate on ${portLabel}`,
          });
        } else if (summary.certificateValid === false) {
          pushAttention(attentionBuckets, "certificate", {
            id: row.assetId,
            name: row.assetName,
            issue: `Invalid certificate window on ${portLabel}`,
          });
        } else if (summary.selfSignedCert === true) {
          pushAttention(attentionBuckets, "certificate", {
            id: row.assetId,
            name: row.assetName,
            issue: `Self-signed certificate on ${portLabel}`,
          });
        }

        if (summary.noTlsDetected) {
          pushAttention(attentionBuckets, "tls", {
            id: row.assetId,
            name: row.assetName,
            issue: `No TLS detected on ${portLabel}`,
          });
        } else if (maxTlsRank > 0 && maxTlsRank < TLS_VERSION_RANK["TLSv1.3"]) {
          const strongestVersion =
            supportedTlsVersions
              .slice()
              .sort((left, right) => (TLS_VERSION_RANK[right] || 0) - (TLS_VERSION_RANK[left] || 0))[0] ||
            summary.primaryTlsVersion ||
            "TLSv1.2";
          pushAttention(attentionBuckets, "tls", {
            id: row.assetId,
            name: row.assetName,
            issue: `No TLS 1.3 support, max ${strongestVersion} on ${portLabel}`,
          });
        }
      }

      if (!assessment) {
        continue;
      }

      const aggregate = assetScores.get(row.assetId) || {
        value: row.assetName,
        scores: [],
        portCount: 0,
        supportsPqc: false,
        negotiatedPqc: false,
        primaryKeyExchange: null,
        primaryEncryption: null,
        bestScore: -1,
      };

      const supportedGroups = parsed.raw?.supported_groups || parsed.raw?.tls_key_exchange_algorithms || [];
      const negotiatedMlKem = Boolean(
        parsed.raw?.tls_versions?.some(
          (version) => version.supported && typeof version.negotiated_group === "string" && version.negotiated_group.toUpperCase().includes("MLKEM")
        )
      );
      const supportsMlKem =
        negotiatedMlKem ||
        hasKyberGroup(supportedGroups) ||
        assessment.breakdown.keyExchange.label.toUpperCase().includes("ML-KEM");

      aggregate.scores.push(assessment.score);
      aggregate.portCount += 1;
      aggregate.supportsPqc = aggregate.supportsPqc || supportsMlKem;
      aggregate.negotiatedPqc = aggregate.negotiatedPqc || negotiatedMlKem;

      if (assessment.score > aggregate.bestScore) {
        aggregate.bestScore = assessment.score;
        aggregate.primaryKeyExchange = assessment.breakdown.keyExchange.label;
        aggregate.primaryEncryption = assessment.breakdown.symmetric.label;
      }

      assetScores.set(row.assetId, aggregate);
    }

    const assets: ReportAssetEntry[] = Array.from(assetScores.entries())
      .map(([id, aggregate]) => {
        const averageScore =
          aggregate.scores.length > 0
            ? Math.round(aggregate.scores.reduce((sum, score) => sum + score, 0) / aggregate.scores.length)
            : 0;
        const tier = getTierFromScore(averageScore);
        return {
          id,
          value: aggregate.value,
          averageScore,
          tier,
          status: getTierStatus(tier),
          portCount: aggregate.portCount,
          primaryKeyExchange: aggregate.primaryKeyExchange,
          primaryEncryption: aggregate.primaryEncryption,
          supportsPqc: aggregate.supportsPqc,
          negotiatedPqc: aggregate.negotiatedPqc,
        };
      })
      .sort(sortAssetsForAction);

    const totalAssets = Number(totalAssetsRows[0]?.count || 0);
    const totalAssetsScored = assets.length;
    const totalPortsScored = assets.reduce((sum, asset) => sum + asset.portCount, 0);
    const averageScore =
      totalPortsScored > 0
        ? Math.round(
            assets.reduce((sum, asset) => sum + asset.averageScore * asset.portCount, 0) / totalPortsScored
          )
        : 0;
    const orgTier: ReportTier | "Pending" = totalPortsScored > 0 ? getTierFromScore(averageScore) : "Pending";
    const orgStatus = getTierStatus(orgTier);

    const tierDistribution = REPORT_TIER_ORDER.map((tier) => {
      const tierAssets = assets
        .filter((asset) => asset.tier === tier)
        .sort((left, right) => right.averageScore - left.averageScore || left.value.localeCompare(right.value));
      const count = tierAssets.length;
      const percent = totalAssetsScored > 0 ? Math.round((count / totalAssetsScored) * 100) : 0;
      return {
        tier,
        label: getTierLabel(tier),
        status: getTierStatus(tier),
        count,
        percent,
        assets: tierAssets,
      };
    });

    const supportedAssets = assets.filter((asset) => asset.supportsPqc);
    const unsupportedAssets = assets.filter((asset) => !asset.supportsPqc);
    const negotiatedCount = assets.filter((asset) => asset.negotiatedPqc).length;

    const payload: OrganizationReportPayload = {
      organization: orgRows[0],
      generatedAt: new Date().toISOString(),
      summaryHighlights: [
        `${averageScore}/100 ${orgStatus} posture across ${totalPortsScored} scored ports and ${totalAssetsScored} scored assets.`,
        `${supportedAssets.length} scored assets expose ML-KEM support today, with ${negotiatedCount} actively negotiating it in current scans.`,
        `${expiredCerts} expired certificate endpoints and ${closeDeadlineCerts} expiring soon endpoints need certificate follow-up.`,
      ],
      coverage: {
        totalAssets,
        totalScannedEndpoints: latestEndpointScans.length,
        reachableTlsEndpoints: reachableTlsEndpointCount,
        totalAssetsScored,
        totalPortsScored,
      },
      overview: {
        metrics: [
          {
            key: "scanned-endpoints",
            label: "Scanned TLS endpoints",
            helper: "Latest completed OpenSSL endpoints captured for this organization.",
            value: latestEndpointScans.length,
            tone: "blue",
          },
          {
            key: "strong-ciphers",
            label: "Strong ciphers confirmed",
            helper: "Endpoints whose preferred cipher posture is modern and strong.",
            value: strongCipherCount,
            tone: "emerald",
          },
          {
            key: "expiring-certs",
            label: "Certificates expiring <30d",
            helper: "Certificates that will require renewal soon to avoid coverage gaps.",
            value: closeDeadlineCerts,
            tone: "amber",
          },
          {
            key: "critical-expirations",
            label: "Critical expirations",
            helper: "Expired certificate endpoints that currently need immediate follow-up.",
            value: expiredCerts,
            tone: "red",
          },
        ],
        tlsVersionMix: sortByCountDescending(tlsVersions),
        certificateHealth: [
          { label: "Valid", value: validCerts, tone: "emerald" },
          { label: "Expiring soon", value: closeDeadlineCerts, tone: "amber" },
          { label: "Expired", value: expiredCerts, tone: "red" },
        ],
        strongCipherCount,
        weakCipherCount,
        selfSignedCount,
        tlsDowngradeVulnerable,
      },
      pqc: {
        averageScore,
        tier: orgTier,
        status: orgStatus,
        totalAssetsScored,
        totalPortsScored,
      },
      tierDistribution,
      pqcSupport: [
        {
          key: "supported",
          label: "PQC supported",
          description: "Assets advertising or negotiating ML-KEM-capable groups in current scans.",
          count: supportedAssets.length,
          percent: totalAssetsScored > 0 ? Math.round((supportedAssets.length / totalAssetsScored) * 100) : 0,
          negotiatedCount,
          assets: supportedAssets,
        },
        {
          key: "unsupported",
          label: "PQC not supported",
          description: "Assets still operating without ML-KEM support in the current scan set.",
          count: unsupportedAssets.length,
          percent: totalAssetsScored > 0 ? Math.round((unsupportedAssets.length / totalAssetsScored) * 100) : 0,
          negotiatedCount: 0,
          assets: unsupportedAssets,
        },
      ],
      immediateAttention: [
        {
          key: "dns",
          label: "DNS expired",
          description: "Targets where DNS no longer resolves and TLS posture cannot be established.",
          tone: "red",
          count: attentionBuckets.dns.length,
          assets: attentionBuckets.dns.slice(0, 8),
        },
        {
          key: "certificate",
          label: "Certificate risk",
          description: "Expired, invalid, or self-signed certificates surfaced from recent scans.",
          tone: "amber",
          count: attentionBuckets.certificate.length,
          assets: attentionBuckets.certificate.slice(0, 8),
        },
        {
          key: "tls",
          label: "TLS weakness",
          description: "Endpoints missing TLS or capped below TLS 1.3 in latest scan coverage.",
          tone: "blue",
          count: attentionBuckets.tls.length,
          assets: attentionBuckets.tls.slice(0, 8),
        },
      ],
      assets,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Reporting payload fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
