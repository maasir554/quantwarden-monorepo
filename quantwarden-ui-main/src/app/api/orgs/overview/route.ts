import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { hasKyberGroup } from "@/lib/pqc";
import { calculatePqcScore } from "@/lib/pqc-scoring";

type OverviewScanRow = {
  assetId: string;
  assetName: string;
  completedAt: string | null;
  createdAt: string;
  resultData: string | null;
  portNumber: number | null;
  portProtocol: string | null;
};

type RiskEntry = {
  id: string;
  name: string;
  issue: string;
  sortVal: number;
};

type CertificateIdentityAggregate = {
  displayName: string;
  issuerName: string;
  serialNumber: string;
  instances: number;
  assets: Set<string>;
};

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

function uniqueStrings(values: Array<string | null | undefined> | null | undefined): string[] {
  return Array.from(new Set((values || []).filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function buildChartData(counter: Record<string, number>, limit = 12) {
  return Object.entries(counter)
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function getPortLabel(portNumber: number | null, portProtocol: string | null) {
  return `${portNumber || 443}/${(portProtocol || "tcp").toUpperCase()}`;
}

function getLatestSupportedTlsVersion(summary: NonNullable<ReturnType<typeof parseOpenSSLScanResult>["summary"]>) {
  const discoveredTlsVersions = Array.from(
    new Set([...(summary.supportedTlsVersions || []), ...(summary.primaryTlsVersion ? [summary.primaryTlsVersion] : [])])
  );

  return discoveredTlsVersions.sort((left, right) => {
    const rankDelta = (TLS_VERSION_RANK[right] || 0) - (TLS_VERSION_RANK[left] || 0);
    return rankDelta !== 0 ? rankDelta : left.localeCompare(right);
  })[0] || null;
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

    const assetTypesRows = await prisma.$queryRawUnsafe<Array<{ type: string; isRoot: boolean }>>(
      `SELECT type, "isRoot"
         FROM "asset"
        WHERE "organizationId" = $1`,
      orgId
    );

    const totalAssets = assetTypesRows.length;
    let domains = 0;
    let subdomains = 0;
    let ips = 0;
    let cloud = 0;

    for (const asset of assetTypesRows) {
      if (asset.type === "domain") {
        if (asset.isRoot) domains += 1;
        else subdomains += 1;
      } else if (asset.type === "ip") {
        ips += 1;
      }
    }

    const latestEndpointScans = await prisma.$queryRawUnsafe<OverviewScanRow[]>(
      `SELECT DISTINCT ON (s."assetId", s."portNumber")
          s."assetId" as "assetId",
          a.value as "assetName",
          s."completedAt" as "completedAt",
          s."createdAt" as "createdAt",
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
    const tls13CipherNegotiated: Record<string, number> = {};
    const tls13CipherAccepted: Record<string, number> = {};
    const tls12CipherNegotiated: Record<string, number> = {};
    const tls12CipherAccepted: Record<string, number> = {};
    const certificateSignatureAlgorithms: Record<string, number> = {};
    const certificateKeySizes: Record<string, number> = {};
    const certificatePorts: Record<string, number> = {};
    const certificateExpiryWindows: Record<string, number> = {
      Expired: 0,
      "In 30 days": 0,
      "In 90 days": 0,
      "> 90 days": 0,
    };
    const tls13KeyExchange: Record<string, number> = {};
    const certificateIdentities = new Map<string, CertificateIdentityAggregate>();

    let strongCipherCount = 0;
    let weakCipherCount = 0;
    let selfSignedCount = 0;
    let tlsDowngradeVulnerable = 0;
    let expiredCerts = 0;
    let closeDeadlineCerts = 0;
    let validCerts = 0;
    let reachableTlsEndpointCount = 0;

    let kyberSupportedYes = 0;
    let kyberSupportedNo = 0;
    let kyberNegotiatedYes = 0;
    let kyberNegotiatedNo = 0;

    let pqcTotalScore = 0;
    let pqcPortsScored = 0;

    const riskByAsset = new Map<string, RiskEntry>();
    const immediateAttentionByAsset = new Map<string, RiskEntry>();
    const dnsAttentionByAsset = new Map<string, RiskEntry>();
    const certAttentionByAsset = new Map<string, RiskEntry>();
    const tlsAttentionByAsset = new Map<string, RiskEntry>();

    for (const row of latestEndpointScans) {
      const parsed = parseOpenSSLScanResult(row.resultData);
      const summary = parsed.summary;
      const portLabel = getPortLabel(row.portNumber, row.portProtocol);

      // Calculate PQC score for all valid scans (matching PQC route)
      if (parsed.raw) {
        const pqcAssessment = calculatePqcScore(parsed.raw);
        if (pqcAssessment) {
          pqcTotalScore += pqcAssessment.score;
          pqcPortsScored += 1;
        }
      }

      if (!summary) {
        if (parsed.error) {
          const timeoutIssue = /timed out/i.test(parsed.error);
          const riskEntry: RiskEntry = {
            id: row.assetId,
            name: row.assetName,
            issue: timeoutIssue ? `Scan Timeout • ${portLabel}` : `Scan Failed • ${portLabel}`,
            sortVal: timeoutIssue ? 2 : 3,
          };
          const existing = riskByAsset.get(row.assetId);
          if (!existing || riskEntry.sortVal < existing.sortVal) {
            riskByAsset.set(row.assetId, riskEntry);
          }
        }
        continue;
      }

      let riskEntry: RiskEntry | null = null;

      if (summary.dnsMissing) {
        riskEntry = {
          id: row.assetId,
          name: row.assetName,
          issue: `DNS Expired • ${portLabel}`,
          sortVal: -2,
        };
        const existingDns = dnsAttentionByAsset.get(row.assetId);
        if (!existingDns || riskEntry.sortVal < existingDns.sortVal) {
          dnsAttentionByAsset.set(row.assetId, riskEntry);
        }
      } else if (summary.noTlsDetected) {
        riskEntry = {
          id: row.assetId,
          name: row.assetName,
          issue: `No TLS on ${portLabel}`,
          sortVal: -1.5,
        };
        const existingTls = tlsAttentionByAsset.get(row.assetId);
        if (!existingTls || riskEntry.sortVal < existingTls.sortVal) {
          tlsAttentionByAsset.set(row.assetId, riskEntry);
        }
      } else {
        const supportedTlsVersions = uniqueStrings(summary.supportedTlsVersions);
        const maxTlsRank = Math.max(
          TLS_VERSION_RANK[summary.primaryTlsVersion || ""] || 0,
          ...supportedTlsVersions.map((version) => TLS_VERSION_RANK[version] || 0)
        );

        if (maxTlsRank > 0 && maxTlsRank < TLS_VERSION_RANK["TLSv1.3"]) {
          const strongestVersion = supportedTlsVersions
            .slice()
            .sort((left, right) => (TLS_VERSION_RANK[right] || 0) - (TLS_VERSION_RANK[left] || 0))[0] ||
            summary.primaryTlsVersion ||
            "TLSv1.2";

          const weakTlsEntry = {
            id: row.assetId,
            name: row.assetName,
            issue: `No TLS 1.3 • Max ${strongestVersion} on ${portLabel}`,
            sortVal: -1.25,
          };
          immediateAttentionByAsset.set(row.assetId, weakTlsEntry);
          const existingTls = tlsAttentionByAsset.get(row.assetId);
          if (!existingTls || weakTlsEntry.sortVal < existingTls.sortVal) {
            tlsAttentionByAsset.set(row.assetId, weakTlsEntry);
          }
        }
      }

      if (summary.dnsMissing || summary.noTlsDetected) {
        const existingImmediate = immediateAttentionByAsset.get(row.assetId);
        if (!existingImmediate || (riskEntry && riskEntry.sortVal < existingImmediate.sortVal)) {
          immediateAttentionByAsset.set(row.assetId, riskEntry as RiskEntry);
        }
      }

      if (summary.dnsMissing || summary.noTlsDetected) {
        const existing = riskByAsset.get(row.assetId);
        if (!existing || (riskEntry && riskEntry.sortVal < existing.sortVal)) {
          riskByAsset.set(row.assetId, riskEntry as RiskEntry);
        }
        continue;
      } else if (summary.certificateValid === false) {
        expiredCerts += 1;
        riskEntry = {
          id: row.assetId,
          name: row.assetName,
          issue: `Invalid Certificate • ${portLabel}`,
          sortVal: -1,
        };
        const existingCert = certAttentionByAsset.get(row.assetId);
        if (!existingCert || riskEntry.sortVal < existingCert.sortVal) {
          certAttentionByAsset.set(row.assetId, riskEntry);
        }
      } else if (typeof summary.daysRemaining === "number") {
        if (summary.daysRemaining <= 0) {
          expiredCerts += 1;
          riskEntry = {
            id: row.assetId,
            name: row.assetName,
            issue: `Certificate Expired • ${portLabel}`,
            sortVal: 0,
          };
          const existingCert = certAttentionByAsset.get(row.assetId);
          if (!existingCert || riskEntry.sortVal < existingCert.sortVal) {
            certAttentionByAsset.set(row.assetId, riskEntry);
          }
        } else if (summary.daysRemaining <= 30) {
          closeDeadlineCerts += 1;
          riskEntry = {
            id: row.assetId,
            name: row.assetName,
            issue: `Expires in ${summary.daysRemaining} days • ${portLabel}`,
            sortVal: summary.daysRemaining,
          };
        } else if (summary.certificateValid === true) {
          validCerts += 1;
        }
      } else if (summary.certificateValid === true) {
        validCerts += 1;
      }

      if (riskEntry) {
        const existing = riskByAsset.get(row.assetId);
        if (!existing || riskEntry.sortVal < existing.sortVal) {
          riskByAsset.set(row.assetId, riskEntry);
        }
      }

      if (summary.scanState !== "reachable") {
        continue;
      }

      reachableTlsEndpointCount += 1;

      incrementCounter(tlsVersions, getLatestSupportedTlsVersion(summary));
      incrementCounter(certificateSignatureAlgorithms, summary.signatureAlgorithm);
      incrementCounter(certificatePorts, `${row.portNumber || 443}`);

      if (summary.publicKeyAlgorithm && summary.publicKeyBits) {
        incrementCounter(
          certificateKeySizes,
          `${summary.publicKeyAlgorithm} ${summary.publicKeyBits}-bit`
        );
      }

      if (typeof summary.daysRemaining === "number") {
        if (summary.daysRemaining <= 0) {
          certificateExpiryWindows.Expired += 1;
        } else if (summary.daysRemaining <= 30) {
          certificateExpiryWindows["In 30 days"] += 1;
        } else if (summary.daysRemaining <= 90) {
          certificateExpiryWindows["In 90 days"] += 1;
        } else {
          certificateExpiryWindows["> 90 days"] += 1;
        }
      }

      if (summary.strongCipher === true) strongCipherCount += 1;
      if (summary.strongCipher === false) weakCipherCount += 1;
      if (summary.selfSignedCert === true) selfSignedCount += 1;
      if (summary.tlsVersionSecure === false) tlsDowngradeVulnerable += 1;

      if (hasKyberGroup(summary.supportedGroups)) kyberSupportedYes += 1;
      else kyberSupportedNo += 1;

      if (hasKyberGroup([summary.negotiatedGroup])) kyberNegotiatedYes += 1;
      else kyberNegotiatedNo += 1;

      if (!parsed.raw) continue;

      const certificate = parsed.raw.certificate || {};
      const subjectCommonName = summary.subjectCommonName || row.assetName;
      const issuerName = summary.issuerCommonName || certificate.issuer_normalized || certificate.issuer || "Unknown issuer";
      const serialNumber = certificate.serial_number || "Not reported";
      const fallbackIdentityTail = certificate.not_after || "Not reported";
      const certificateIdentityKey = certificate.serial_number
        ? `${issuerName}::${certificate.serial_number}`
        : `${subjectCommonName}::${issuerName}::${fallbackIdentityTail}`;

      const existingIdentity = certificateIdentities.get(certificateIdentityKey) || {
        displayName: subjectCommonName,
        issuerName,
        serialNumber,
        instances: 0,
        assets: new Set<string>(),
      };
      existingIdentity.instances += 1;
      existingIdentity.assets.add(row.assetId);
      certificateIdentities.set(certificateIdentityKey, existingIdentity);

      const supportedTls13 = (parsed.raw.tls_versions || []).some((probe) => {
        const version = probe.negotiated_protocol || probe.tls_version;
        return probe.supported && version === "TLSv1.3";
      });

      for (const probe of parsed.raw.tls_versions || []) {
        if (!probe.supported) continue;
        const version = probe.negotiated_protocol || probe.tls_version;

        if (version === "TLSv1.3") {
          incrementCounter(tls13CipherNegotiated, probe.negotiated_cipher || null);
          for (const cipher of uniqueStrings(probe.accepted_ciphers_in_client_offer_order)) {
            incrementCounter(tls13CipherAccepted, cipher);
          }
        }

        if (version === "TLSv1.2") {
          incrementCounter(tls12CipherNegotiated, probe.negotiated_cipher || null);
          for (const cipher of uniqueStrings(probe.accepted_ciphers_in_client_offer_order)) {
            incrementCounter(tls12CipherAccepted, cipher);
          }
        }
      }

      if (supportedTls13) {
        const groups = uniqueStrings(parsed.raw.supported_groups);
        const groupsToCount = groups.length > 0 ? groups : uniqueStrings([summary.negotiatedGroup]);
        for (const group of groupsToCount) {
          incrementCounter(tls13KeyExchange, group);
        }
      }
    }

    const pqcAvgScore = pqcPortsScored > 0 ? Math.round(pqcTotalScore / pqcPortsScored) : 0;

    const totalScanned = latestEndpointScans.length;
    
    let pqcTier = "D";
    if (pqcAvgScore >= 90) pqcTier = "A";
    else if (pqcAvgScore >= 75) pqcTier = "B";
    else if (pqcAvgScore >= 50) pqcTier = "C";

    const tierLabel: Record<string, string> = {
      A: "Quantum-Safe",
      B: "Transitional",
      C: "Legacy",
      D: "Vulnerable",
    };

    let tier = {
      grade: pqcTier,
      tier: `Tier ${pqcTier}`,
      label: tierLabel[pqcTier] || "Unknown",
      color: pqcTier === "A" ? "text-emerald-500" : pqcTier === "B" ? "text-blue-500" : pqcTier === "C" ? "text-amber-500" : "text-red-500",
      bg: pqcTier === "A" ? "bg-emerald-500/10 border-emerald-500/20" : pqcTier === "B" ? "bg-blue-500/10 border-blue-500/20" : pqcTier === "C" ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20",
      score: pqcAvgScore,
      portsScored: pqcPortsScored,
    };

    const tlsChartData = Object.entries(tlsVersions)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => {
        const rankDelta = (TLS_VERSION_RANK[right.name] || 0) - (TLS_VERSION_RANK[left.name] || 0);
        return rankDelta !== 0 ? rankDelta : right.value - left.value;
      });

    const topCertificatesByIdentity = Array.from(certificateIdentities.values())
      .map((aggregate) => ({
        name: aggregate.displayName,
        issuerName: aggregate.issuerName,
        serialNumber: aggregate.serialNumber,
        instances: aggregate.instances,
        uniqueAssets: aggregate.assets.size,
      }))
      .sort((left, right) => {
        const instanceDelta = right.instances - left.instances;
        if (instanceDelta !== 0) return instanceDelta;
        const assetDelta = right.uniqueAssets - left.uniqueAssets;
        return assetDelta !== 0 ? assetDelta : left.name.localeCompare(right.name);
      })
      .slice(0, 5);

    const topRiskAssets = Array.from(riskByAsset.values())
      .sort((left, right) => left.sortVal - right.sortVal)
      .slice(0, 3);
    const immediateAttentionAssets = Array.from(immediateAttentionByAsset.values())
      .sort((left, right) => left.sortVal - right.sortVal)
      .slice(0, 3);
    const immediateAttention = {
      dnsExpired: Array.from(dnsAttentionByAsset.values())
        .sort((left, right) => left.sortVal - right.sortVal)
        .slice(0, 4),
      certExpired: Array.from(certAttentionByAsset.values())
        .sort((left, right) => left.sortVal - right.sortVal)
        .slice(0, 4),
      noTlsWeakTls: Array.from(tlsAttentionByAsset.values())
        .sort((left, right) => left.sortVal - right.sortVal)
        .slice(0, 4),
    };

    return NextResponse.json({
      totalAssets,
      discovery: { domains, subdomains, ips, cloud },
      totalScanned,
      reachableTlsEndpointCount,
      expiredCerts,
      closeDeadlineCerts,
      validCerts,
      tlsChartData,
      tls13CipherNegotiated: buildChartData(tls13CipherNegotiated),
      tls13CipherAccepted: buildChartData(tls13CipherAccepted),
      tls12CipherNegotiated: buildChartData(tls12CipherNegotiated),
      tls12CipherAccepted: buildChartData(tls12CipherAccepted),
      kyberSupportedYesNo: [
        { name: "Yes", value: kyberSupportedYes },
        { name: "No", value: kyberSupportedNo },
      ],
      kyberNegotiatedYesNo: [
        { name: "Yes", value: kyberNegotiatedYes },
        { name: "No", value: kyberNegotiatedNo },
      ],
      certificateSignatureAlgorithms: buildChartData(certificateSignatureAlgorithms),
      certificateKeySizes: buildChartData(certificateKeySizes),
      certificatePorts: buildChartData(certificatePorts, 6),
      certificateExpiryWindows: Object.entries(certificateExpiryWindows)
        .map(([name, value]) => ({ name, value }))
        .filter((entry) => entry.value > 0),
      topCertificatesByIdentity,
      tls13KeyExchange: buildChartData(tls13KeyExchange),
      strongCipherCount,
      weakCipherCount,
      selfSignedCount,
      tlsDowngradeVulnerable,
      tier,
      topRiskAssets,
      immediateAttentionAssets,
      immediateAttention,
    });
  } catch (error) {
    console.error("Overview fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
