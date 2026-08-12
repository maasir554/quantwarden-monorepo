import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { calculatePqcScore } from "@/lib/pqc-scoring";
import { hasKyberGroup } from "@/lib/pqc";
import {
  DEFAULT_REPORT_SECTIONS,
  getTierFromScore,
  getTierLabel,
  getTierStatus,
  OrganizationReportPayload,
  REPORT_ACTION_TIER_ORDER,
  REPORT_TIER_ORDER,
  type ReportAssetEntry,
  type ReportImmediateAttentionAsset,
  type ReportSuggestedChange,
  type ReportTier,
  type ReportSectionKey,
} from "@/lib/reporting";
import { generateLatexPdf } from "@/lib/reporting-latex";

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

function uniqueStrings(values: Array<string | null | undefined> | null | undefined) {
  return Array.from(new Set((values || []).filter((value): value is string => Boolean(value && value.trim()))));
}

function getPortLabel(portNumber: number | null, portProtocol: string | null) {
  return `${portNumber || 443}/${(portProtocol || "tcp").toUpperCase()}`;
}

const EXPECTED_TLS_PORTS = new Set([443, 465, 587, 636, 853, 989, 990, 992, 993, 995, 5061, 8443, 9443]);

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
    const internalSecret = process.env.SCAN_WORKER_WAKE_SECRET?.trim();
    const internalRequest = Boolean(
      internalSecret && req.headers.get("authorization") === `Bearer ${internalSecret}`
    );
    const session = internalRequest ? null : await auth.api.getSession({ headers: await headers() });
    if (!internalRequest && !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    if (!internalRequest) {
      const memberRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id
           FROM "member"
          WHERE "organizationId" = $1
            AND "userId" = $2
          LIMIT 1`,
        orgId,
        session!.user.id
      );

      if (memberRows.length === 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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

    const tlsVersionPosture: Record<string, number> = {
      "TLS 1.2 only": 0,
      "TLS 1.2 + 1.3": 0,
      "TLS 1.3 only": 0,
      "Danger: TLS 1.0 / 1.1 enabled": 0,
      "Unclassified / other TLS": 0,
    };
    const attentionBuckets: Record<AttentionBucketKey, ReportImmediateAttentionAsset[]> = {
      dns: [],
      certificate: [],
      tls: [],
    };
    const suggestedChanges: ReportSuggestedChange[] = [];

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

      const findings: Array<{ label: string; value: string }> = [];
      const suggestions: string[] = [];
      const effectivePort = row.portNumber || 443;

      if (summary) {
        const supportedVersions = uniqueStrings([
          ...(summary.supportedTlsVersions || []),
          summary.primaryTlsVersion,
        ]);
        const hasTls13 = supportedVersions.some((version) => version.includes("1.3"));
        const hasTls12 = supportedVersions.some((version) => version.includes("1.2"));
        const hasDeprecatedTls = supportedVersions.some(
          (version) => version.includes("1.0") || version.includes("1.1")
        );

        findings.push({
          label: "TLS",
          value: summary.noTlsDetected
            ? "Not detected"
            : supportedVersions.length
              ? supportedVersions.map((version) => version.replace(/^TLSv/i, "TLS ")).join(", ")
              : "Version unknown",
        });

        if (summary.dnsMissing) {
          suggestions.push("Restore or correct the DNS record before rescanning the endpoint.");
        }
        if (summary.noTlsDetected) {
          if (EXPECTED_TLS_PORTS.has(effectivePort)) {
            suggestions.push("Enable TLS 1.2 and TLS 1.3 as the migration baseline.");
          } else if ([80, 3000, 8000, 8080, 8888].includes(effectivePort)) {
            suggestions.push("Redirect cleartext HTTP to a TLS-enabled HTTPS endpoint; do not treat this port as a TLS endpoint.");
          } else {
            suggestions.push("Confirm the service type. If it is intentionally non-TLS, exclude this port from TLS/PQC scoring; otherwise enable TLS.");
          }
        } else {
          if (hasDeprecatedTls) {
            suggestions.push("Disable TLS 1.0 and TLS 1.1. Retain TLS 1.2 and TLS 1.3 during migration.");
          }
          if (!hasTls13) {
            suggestions.push("Enable TLS 1.3; retain TLS 1.2 only where compatibility requires it.");
          } else if (hasTls12 && !hasDeprecatedTls) {
            suggestions.push("Move to TLS 1.3 only where compatibility permits to earn the full protocol score.");
          }
        }

        if (summary.strongCipher === false && !assessment) {
          suggestions.push("Replace weak cipher suites with AES-256-GCM or ChaCha20-Poly1305.");
        }
        if (typeof summary.daysRemaining === "number" && summary.daysRemaining < 0) {
          findings.push({ label: "Certificate", value: "Expired" });
          suggestions.push("Renew and deploy a currently valid certificate.");
        } else if (summary.certificateValid === false) {
          findings.push({ label: "Certificate", value: "Invalid validity window" });
          suggestions.push("Replace the certificate with one whose validity window covers the deployment.");
        } else if (summary.certificateValid === true) {
          findings.push({ label: "Certificate", value: "Valid" });
        }
        if (summary.selfSignedCert === true) {
          findings.push({ label: "Trust", value: "Self-signed certificate" });
          suggestions.push("Replace the self-signed certificate with a certificate issued by a trusted CA.");
        }
      } else {
        findings.push({ label: "Scan", value: "No structured TLS evidence" });
        suggestions.push("Run a successful TLS scan and review the endpoint configuration.");
      }

      if (assessment && summary && !summary.noTlsDetected) {
        findings.push(
          { label: "Key exchange", value: assessment.breakdown.keyExchange.label },
          { label: "Cipher", value: assessment.breakdown.symmetric.label },
          { label: "Authentication", value: assessment.breakdown.auth.label },
          { label: "Endpoint score", value: `${assessment.score}/100 (Tier ${assessment.tier})` }
        );
        if (assessment.breakdown.keyExchange.score < 40) {
          suggestions.push(
            assessment.breakdown.keyExchange.score === 20
              ? "Prefer the ML-KEM hybrid group so it is negotiated by default."
              : "Add ML-KEM hybrid support and make it the preferred key-exchange group."
          );
        }
        if (assessment.breakdown.symmetric.score < 30) {
          suggestions.push("Prefer AES-256-GCM or ChaCha20-Poly1305.");
        }
        if (assessment.breakdown.auth.score < 10) {
          suggestions.push("Use ECDSA/EdDSA or RSA with at least 3072 bits.");
        }
      }

      suggestedChanges.push({
        assetId: row.assetId,
        assetName: row.assetName,
        port: portLabel,
        findings,
        actions: Array.from(new Set(suggestions)).length
          ? Array.from(new Set(suggestions))
          : ["No immediate configuration change is indicated; continue monitoring."],
      });

      if (summary) {
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

        const supportedTlsVersions = uniqueStrings([
          ...(summary.supportedTlsVersions || []),
          summary.primaryTlsVersion,
        ]);
        const hasTls13 = supportedTlsVersions.some((version) => version.includes("1.3"));
        const hasTls12 = supportedTlsVersions.some((version) => version.includes("1.2"));
        const hasDeprecatedTls = supportedTlsVersions.some(
          (version) => version.includes("1.0") || version.includes("1.1")
        );

        if (!summary.dnsMissing && !summary.noTlsDetected) {
          if (hasDeprecatedTls) tlsVersionPosture["Danger: TLS 1.0 / 1.1 enabled"] += 1;
          else if (hasTls13 && !hasTls12) tlsVersionPosture["TLS 1.3 only"] += 1;
          else if (hasTls13 && hasTls12) tlsVersionPosture["TLS 1.2 + 1.3"] += 1;
          else if (hasTls12) tlsVersionPosture["TLS 1.2 only"] += 1;
          else tlsVersionPosture["Unclassified / other TLS"] += 1;
        }

        const maxTlsRank = Math.max(
          TLS_VERSION_RANK[summary.primaryTlsVersion || ""] || 0,
          ...supportedTlsVersions.map((version) => TLS_VERSION_RANK[version] || 0)
        );
        if (hasDeprecatedTls || (maxTlsRank > 0 && !hasTls13)) {
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
        } else if (hasDeprecatedTls || (maxTlsRank > 0 && !hasTls13)) {
          const strongestVersion =
            supportedTlsVersions
              .slice()
              .sort((left, right) => (TLS_VERSION_RANK[right] || 0) - (TLS_VERSION_RANK[left] || 0))[0] ||
            summary.primaryTlsVersion ||
            "TLSv1.2";
          pushAttention(attentionBuckets, "tls", {
            id: row.assetId,
            name: row.assetName,
            issue: hasDeprecatedTls
              ? `TLS 1.0 / 1.1 enabled on ${portLabel}`
              : `No TLS 1.3 support, max ${strongestVersion} on ${portLabel}`,
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
        tlsVersionMix: [
          "TLS 1.2 only",
          "TLS 1.2 + 1.3",
          "TLS 1.3 only",
          "Danger: TLS 1.0 / 1.1 enabled",
          ...(tlsVersionPosture["Unclassified / other TLS"] > 0 ? ["Unclassified / other TLS"] : []),
        ].map((name) => ({ name, value: tlsVersionPosture[name] || 0 })),
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
      suggestedChanges,
      assets,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Reporting payload fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const orgId = typeof body?.orgId === "string" ? body.orgId : "";
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const heading = typeof body.heading === "string" ? body.heading.trim().slice(0, 140) : "";
    const subtitle = typeof body.subtitle === "string" ? body.subtitle.trim().slice(0, 360) : "";
    const sectionKeys = Object.keys(DEFAULT_REPORT_SECTIONS) as ReportSectionKey[];
    const sections = sectionKeys.reduce<Record<ReportSectionKey, boolean>>(
      (result, key) => {
        result[key] = typeof body.sections?.[key] === "boolean" ? body.sections[key] : DEFAULT_REPORT_SECTIONS[key];
        return result;
      },
      { ...DEFAULT_REPORT_SECTIONS }
    );

    if (!Object.values(sections).some(Boolean)) {
      return NextResponse.json({ error: "Select at least one report section." }, { status: 400 });
    }

    const reportUrl = new URL(req.url);
    reportUrl.searchParams.set("orgId", orgId);
    const dataResponse = await GET(new NextRequest(reportUrl, { headers: req.headers }));
    if (!dataResponse.ok) return dataResponse;

    const data = (await dataResponse.json()) as OrganizationReportPayload;
    const pdf = await generateLatexPdf(data, {
      heading: heading || `${data.organization.name} Security Posture Report`,
      subtitle: subtitle || "TLS and post-quantum readiness assessment",
      sections,
    });
    const datePart = data.generatedAt.slice(0, 10);
    const slug = data.organization.slug.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "organization";

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}-security-posture-${datePart}.pdf"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("Server-side PDF generation failed:", error);
    const missingLatex = error?.code === "ENOENT";
    return NextResponse.json(
      {
        error: missingLatex
          ? "The server PDF engine is unavailable. Install pdflatex or rebuild the Docker image."
          : "The server could not generate the PDF report.",
      },
      { status: 500 }
    );
  }
}
