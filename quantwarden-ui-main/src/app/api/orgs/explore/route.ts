import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { hasKyberGroup } from "@/lib/pqc";
import { calculatePqcScore, PqcAssessment } from "@/lib/pqc-scoring";
import { buildAssetBucketOptions, inferAssetBucket, normalizeAssetBucket } from "@/lib/asset-buckets";

const TLS_VERSION_RANK: Record<string, number> = {
  "TLSv1.3": 4,
  "TLSv1.2": 3,
  "TLSv1.1": 2,
  "TLSv1.0": 1,
};

type AssetRow = {
  assetId: string;
  assetName: string;
  assetType: string;
  isRoot: boolean;
  addedAt: Date;
  resolvedIp: string | null;
  openPorts: string | null;
  scanStatus: string | null;
  bucket: string | null;
};

type AssetEndpointScanRow = {
  assetId: string;
  resultData: string | null;
  completedAt: Date | null;
  createdAt: Date;
  portNumber: number | null;
  portProtocol: string | null;
};

type AssetScanSummary = {
  valid: boolean;
  dnsMissing: boolean;
  timedOut: boolean;
  daysRemaining: number | null;
  cipher: string | null;
  discoveredCiphers: string[];
  tls: string | null;
  keySize: string | null;
  signatureAlgorithm: string | null;
  issue: string;
  pqc: PqcAssessment | null;
};

type TlsMatchMode = "" | "exact_latest";

function formatEndpointLabel(row: Pick<AssetEndpointScanRow, "portNumber" | "portProtocol">) {
  const portNumber = row.portNumber ?? 443;
  const portProtocol = (row.portProtocol || "tcp").toUpperCase();
  return `${portNumber}/${portProtocol}`;
}

function formatEndpointQueryValue(row: Pick<AssetEndpointScanRow, "portNumber" | "portProtocol">) {
  const portNumber = row.portNumber ?? 443;
  const portProtocol = (row.portProtocol || "tcp").toLowerCase();
  return `${portNumber}-${portProtocol}`;
}

function compareTlsVersions(left: string, right: string) {
  const rankDelta = (TLS_VERSION_RANK[right] || 0) - (TLS_VERSION_RANK[left] || 0);
  return rankDelta !== 0 ? rankDelta : left.localeCompare(right);
}

function getLatestSupportedTlsVersion(summary: NonNullable<ReturnType<typeof parseOpenSSLScanResult>["summary"]>) {
  const discoveredTlsVersions = Array.from(
    new Set([...(summary.supportedTlsVersions || []), ...(summary.primaryTlsVersion ? [summary.primaryTlsVersion] : [])])
  );

  return discoveredTlsVersions.sort(compareTlsVersions)[0] || null;
}

type ParsedScanEntry = {
  row: AssetEndpointScanRow;
  parsed: ReturnType<typeof parseOpenSSLScanResult>;
  completedAtTime: number;
};

function buildSummary(parsed: ReturnType<typeof parseOpenSSLScanResult>, rawData?: string | null): AssetScanSummary | null {
  const derived = parsed.summary;
  const hasTimedOut = Boolean(parsed.error && /timed out/i.test(parsed.error));

  if (!derived) {
    if (!hasTimedOut) return null;
    return {
      valid: false,
      dnsMissing: false,
      timedOut: true,
      daysRemaining: null,
      cipher: null,
      discoveredCiphers: [],
      tls: null,
      keySize: null,
      signatureAlgorithm: null,
      issue: "Scan Timeout",
      pqc: null,
    };
  }

  const isDnsMissing = derived.dnsMissing === true;
  const isNoTls = derived.noTlsDetected === true;
  const isInvalid = derived.certificateValid === false;
  const daysLeft = derived.daysRemaining;
  const isExpiring = typeof daysLeft === "number" && daysLeft <= 30;
  const isVuln = derived.tlsVersionSecure === false;

  return {
    valid: !isDnsMissing && !isNoTls && !isInvalid,
    dnsMissing: isDnsMissing,
    timedOut: hasTimedOut,
    daysRemaining: daysLeft,
    cipher: derived.preferredCipher,
    discoveredCiphers: derived.cipherPreferenceOrder || [],
    tls: derived.primaryTlsVersion,
    keySize:
      derived.publicKeyAlgorithm && derived.publicKeyBits
        ? `${derived.publicKeyAlgorithm} ${derived.publicKeyBits}-bit`
        : null,
    signatureAlgorithm: derived.signatureAlgorithm,
    issue: isDnsMissing
      ? "DNS Expired"
      : isNoTls
        ? "No TLS Detected"
        : isInvalid
          ? "Invalid Certificate"
          : isExpiring
            ? "Expiring Soon"
            : isVuln
              ? "TLS Vuln"
              : "",
    pqc: rawData ? calculatePqcScore(JSON.parse(rawData)) : null,
  };
}

function scanMatchesFilters(
  entry: Pick<ParsedScanEntry, "row" | "parsed">,
  filters: {
    dnsStateVal: string;
    certStateVal: string;
    tlsProfileVal: string;
    tlsMatchMode: TlsMatchMode;
    selfSignedVal: string;
    signatureAlgorithmVal: string;
    timeoutOnlyVal: "" | "true" | "false";
    noTlsFilter: "" | "true" | "false";
    selectedKexAlgos: string[];
    selectedKexGroups: string[];
    pqcSupportedFilter: "" | "true" | "false";
    pqcNegotiatedFilter: "" | "true" | "false";
    pqcTierVal: string;
    cipherVal: string;
    keySizeVal: string;
    tlsVal: string;
    endpointPortVal: string;
    certExpiryVal: string;
  }
) {
  const parsed = entry.parsed;
  const {
    dnsStateVal,
    certStateVal,
    tlsProfileVal,
    tlsMatchMode,
    selfSignedVal,
    signatureAlgorithmVal,
    timeoutOnlyVal,
    noTlsFilter,
    selectedKexAlgos,
    selectedKexGroups,
    pqcSupportedFilter,
    pqcNegotiatedFilter,
    pqcTierVal,
    cipherVal,
    keySizeVal,
    tlsVal,
    endpointPortVal,
    certExpiryVal,
  } = filters;

  const summary = parsed.summary;
  const hasTimedOut = Boolean(parsed.error && /timed out/i.test(parsed.error));
  const hasNoTls = Boolean(summary?.noTlsDetected);

  if (timeoutOnlyVal === "true" && !hasTimedOut) {
    return false;
  }
  if (timeoutOnlyVal === "false" && hasTimedOut) {
    return false;
  }
  if (noTlsFilter === "true" && !hasNoTls) {
    return false;
  }
  if (noTlsFilter === "false" && hasNoTls) {
    return false;
  }

  if (!summary) {
    const hasScanSpecificFilters =
      Boolean(dnsStateVal) ||
      Boolean(certStateVal) ||
      Boolean(tlsProfileVal) ||
      Boolean(selfSignedVal) ||
      Boolean(signatureAlgorithmVal) ||
      Boolean(cipherVal) ||
      Boolean(keySizeVal) ||
      Boolean(tlsVal) ||
      Boolean(endpointPortVal) ||
      Boolean(certExpiryVal) ||
      Boolean(noTlsFilter) ||
      selectedKexAlgos.length > 0 ||
      selectedKexGroups.length > 0 ||
      Boolean(pqcSupportedFilter) ||
      Boolean(pqcNegotiatedFilter) ||
      Boolean(pqcTierVal);

    return !hasScanSpecificFilters && hasTimedOut;
  }

  if (dnsStateVal === "found" && summary.dnsMissing) return false;
  if (dnsStateVal === "not_found" && !summary.dnsMissing) return false;

  const isExpiredOrInvalid =
    summary.certificateValid === false ||
    (typeof summary.daysRemaining === "number" && summary.daysRemaining <= 0);
  const isExpiringSoon =
    typeof summary.daysRemaining === "number" &&
    summary.daysRemaining > 0 &&
    summary.daysRemaining <= 30;
  if (certStateVal === "expired_or_invalid" && !isExpiredOrInvalid) return false;
  if (certStateVal === "expiring_soon" && !isExpiringSoon) return false;
  if (selfSignedVal === "true" && summary.selfSignedCert !== true) return false;
  if (signatureAlgorithmVal && summary.signatureAlgorithm !== signatureAlgorithmVal) return false;

  const supportedTlsVersions = new Set<string>([
    ...(summary.supportedTlsVersions || []),
    ...(summary.primaryTlsVersion ? [summary.primaryTlsVersion] : []),
  ]);
  const hasTls13 = supportedTlsVersions.has("TLSv1.3");
  const isLegacyOrMissing = hasNoTls || (!summary.dnsMissing && supportedTlsVersions.size > 0 && !hasTls13);
  if (tlsProfileVal === "legacy_or_missing" && !isLegacyOrMissing) return false;

  if (selectedKexAlgos.length > 0) {
    const rowAlgos = new Set(summary.keyExchangeAlgorithms || []);
    if (!selectedKexAlgos.some((algo) => rowAlgos.has(algo))) return false;
  }

  if (selectedKexGroups.length > 0) {
    const rowGroups = new Set(summary.negotiatedGroup ? [summary.negotiatedGroup] : []);
    if (!selectedKexGroups.some((group) => rowGroups.has(group))) return false;
  }

  const hasSupportedKyber = hasKyberGroup(summary.supportedGroups);
  const hasNegotiatedKyber = hasKyberGroup([summary.negotiatedGroup]);

  if (pqcSupportedFilter === "true" && !hasSupportedKyber) return false;
  if (pqcSupportedFilter === "false" && hasSupportedKyber) return false;
  if (pqcNegotiatedFilter === "true" && !hasNegotiatedKyber) return false;
  if (pqcNegotiatedFilter === "false" && hasNegotiatedKyber) return false;

  if (pqcTierVal) {
    if (!entry.parsed.raw) return false;
    try {
      const parsedData = { ...entry.parsed.raw, resolved_ip: "127.0.0.1" };
      const pqc = calculatePqcScore(parsedData);
      if (pqc?.tier !== pqcTierVal) return false;
    } catch {
      return false;
    }
  }

  if (cipherVal) {
    const discoveredCipherSuites = new Set<string>([
      ...(summary.cipherPreferenceOrder || []),
      ...(summary.preferredCipher ? [summary.preferredCipher] : []),
      ...(summary.negotiatedCipher ? [summary.negotiatedCipher] : []),
    ]);
    if (!discoveredCipherSuites.has(cipherVal)) return false;
  }

  if (keySizeVal) {
    const actualKey =
      summary.publicKeyAlgorithm && summary.publicKeyBits
        ? `${summary.publicKeyAlgorithm} ${summary.publicKeyBits}-bit`
        : "";
    if (actualKey !== keySizeVal) return false;
  }

  if (endpointPortVal) {
    const actualPort = String(entry.row.portNumber ?? 443);
    if (actualPort !== endpointPortVal) return false;
  }

  if (tlsVal) {
    const discoveredTlsVersions = new Set<string>([
      ...(summary.supportedTlsVersions || []),
      ...(summary.primaryTlsVersion ? [summary.primaryTlsVersion] : []),
    ]);
    const latestObservedTlsVersion = getLatestSupportedTlsVersion(summary);
    const selectedTlsRank = TLS_VERSION_RANK[tlsVal] || 0;
    const latestObservedTlsRank = Math.max(
      0,
      ...Array.from(discoveredTlsVersions).map((version) => TLS_VERSION_RANK[version] || 0)
    );

    if (selectedTlsRank === 0 || latestObservedTlsRank === 0) {
      return false;
    }

    if (tlsMatchMode === "exact_latest") {
      if (latestObservedTlsVersion !== tlsVal) return false;
    } else if (latestObservedTlsRank > selectedTlsRank) {
      return false;
    }
  }

  if (certExpiryVal) {
    const daysRemaining = summary.daysRemaining;
    if (typeof daysRemaining !== "number") {
      return false;
    }

    if (certExpiryVal === "expired" && daysRemaining > 0) return false;
    if (certExpiryVal === "in_30_days" && !(daysRemaining > 0 && daysRemaining <= 30)) return false;
    if (certExpiryVal === "in_90_days" && !(daysRemaining > 30 && daysRemaining <= 90)) return false;
    if (certExpiryVal === "over_90_days" && !(daysRemaining > 90)) return false;
  }

  return true;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: session.user.id },
    });
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dnsStateVal = searchParams.get("dnsState") || "";
    const certStateVal = searchParams.get("certState") || "";
    const tlsProfileVal = searchParams.get("tlsProfile") || "";
    const tlsMatchMode: TlsMatchMode =
      searchParams.get("tlsMatch") === "exact_latest" ? "exact_latest" : "";
    const selfSignedVal = searchParams.get("selfSigned") === "true" ? "true" : "";
    const signatureAlgorithmVal = searchParams.get("signatureAlgorithm") || "";
    const timeoutOnlyVal =
      searchParams.get("timeoutOnly") === "true"
        ? "true"
        : searchParams.get("timeoutOnly") === "false"
          ? "false"
          : "";
    const noTlsFilter =
      searchParams.get("noTls") === "true"
        ? "true"
        : searchParams.get("noTls") === "false"
          ? "false"
          : "";
    const selectedKexAlgos = (searchParams.get("kexAlgos") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const selectedKexGroups = (searchParams.get("kexGroups") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const pqcSupportedFilter =
      searchParams.get("pqcSupported") === "true"
        ? "true"
        : searchParams.get("pqcSupported") === "false"
          ? "false"
          : "";
    const pqcNegotiatedFilter =
      searchParams.get("pqcNegotiated") === "true"
        ? "true"
        : searchParams.get("pqcNegotiated") === "false"
          ? "false"
          : "";
    const pqcTierVal = searchParams.get("pqcTier") || "";
    const scanStatusVal = searchParams.get("scanStatus") || "";
    const bucketVal = searchParams.get("bucket") ? normalizeAssetBucket(searchParams.get("bucket")) : "";
    const cipherVal = searchParams.get("cipher") || "";
    const keySizeVal = searchParams.get("keySize") || "";
    const tlsVal = searchParams.get("tls") || "";
    const endpointPortVal = searchParams.get("port") || "";
    const certExpiryVal = searchParams.get("certExpiry") || "";
    const searchVal = (searchParams.get("search") || "").toLowerCase();
    const shouldPaginate = searchParams.get("paginate") !== "false";
    const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const requestedPageSize = Number.parseInt(searchParams.get("pageSize") || "25", 10);
    const pageSize = [10, 25, 50, 100].includes(requestedPageSize) ? requestedPageSize : 25;

    const filters: Parameters<typeof scanMatchesFilters>[1] = {
      dnsStateVal,
      certStateVal,
      tlsProfileVal,
      tlsMatchMode,
      selfSignedVal,
      signatureAlgorithmVal,
      timeoutOnlyVal,
      noTlsFilter,
      selectedKexAlgos,
      selectedKexGroups,
      pqcSupportedFilter,
      pqcNegotiatedFilter,
      pqcTierVal,
      cipherVal,
      keySizeVal,
      tlsVal,
      endpointPortVal,
      certExpiryVal,
    };

    const assetRows = await prisma.$queryRawUnsafe<AssetRow[]>(
      `SELECT
          a.id as "assetId",
          a.value as "assetName",
          a.type as "assetType",
          a."isRoot" as "isRoot",
          a."createdAt" as "addedAt",
          a."resolvedIp" as "resolvedIp",
          a."openPorts" as "openPorts",
          a."scanStatus" as "scanStatus",
          a."bucket" as "bucket"
       FROM "asset" a
       WHERE a."organizationId" = $1
       ORDER BY a."createdAt" DESC`,
      orgId
    );

    const endpointScanRows = await prisma.$queryRawUnsafe<AssetEndpointScanRow[]>(
      `SELECT DISTINCT ON (
          s."assetId",
          COALESCE(s."portNumber", 443),
          LOWER(COALESCE(s."portProtocol", 'tcp'))
       )
          s."assetId" as "assetId",
          s."resultData" as "resultData",
          s."completedAt" as "completedAt",
          s."createdAt" as "createdAt",
          s."portNumber" as "portNumber",
          s."portProtocol" as "portProtocol"
       FROM "asset_scan" s
       INNER JOIN "asset" a ON a.id = s."assetId"
       WHERE a."organizationId" = $1
         AND s.type = 'openssl'
         AND s.status IN ('completed', 'failed')
       ORDER BY
         s."assetId",
         COALESCE(s."portNumber", 443),
         LOWER(COALESCE(s."portProtocol", 'tcp')),
         s."completedAt" DESC NULLS LAST,
         s."createdAt" DESC`,
      orgId
    );

    const scansByAssetId = new Map<string, ParsedScanEntry[]>();

    const cipherOptions = new Set<string>();
    const keySizeOptions = new Set<string>();
    const tlsOptions = new Set<string>();
    const portOptions = new Set<string>();
    const kexAlgorithmOptions = new Set<string>();
    const negotiatedGroupOptions = new Set<string>();
    const signatureAlgorithmOptions = new Set<string>();

    for (const row of endpointScanRows) {
      const parsed = parseOpenSSLScanResult(row.resultData);
      const entry: ParsedScanEntry = {
        row,
        parsed,
        completedAtTime: new Date(row.completedAt || row.createdAt).getTime(),
      };

      const current = scansByAssetId.get(row.assetId) || [];
      current.push(entry);
      scansByAssetId.set(row.assetId, current);

      portOptions.add(String(row.portNumber ?? 443));

      if (!parsed.summary) continue;

      if (parsed.summary.preferredCipher) cipherOptions.add(parsed.summary.preferredCipher);
      if (parsed.summary.negotiatedCipher) cipherOptions.add(parsed.summary.negotiatedCipher);
      for (const cipher of parsed.summary.cipherPreferenceOrder || []) {
        if (cipher) cipherOptions.add(cipher);
      }
      if (parsed.summary.primaryTlsVersion) tlsOptions.add(parsed.summary.primaryTlsVersion);
      for (const version of parsed.summary.supportedTlsVersions || []) {
        if (version) tlsOptions.add(version);
      }
      if (parsed.summary.publicKeyAlgorithm && parsed.summary.publicKeyBits) {
        keySizeOptions.add(`${parsed.summary.publicKeyAlgorithm} ${parsed.summary.publicKeyBits}-bit`);
      }
      if (parsed.summary.signatureAlgorithm) {
        signatureAlgorithmOptions.add(parsed.summary.signatureAlgorithm);
      }
      for (const algorithm of parsed.summary.keyExchangeAlgorithms || []) {
        if (algorithm) kexAlgorithmOptions.add(algorithm);
      }
      if (parsed.summary.negotiatedGroup) negotiatedGroupOptions.add(parsed.summary.negotiatedGroup);
    }

    for (const assetScans of scansByAssetId.values()) {
      assetScans.sort((left, right) => right.completedAtTime - left.completedAtTime);
    }

    const filtered: Array<{
      id: string;
      name: string;
      type: string;
      isRoot: boolean;
      addedAt: Date;
      resolvedIp: string | null;
      openPorts: string | null;
      scanStatus: string | null;
      bucket: string;
      scanCompletedAt: Date | null;
      summary: AssetScanSummary | null;
      selectedEndpointLabel: string | null;
      matchingEndpointCount: number;
      matchingEndpointLabels: string[];
      matchingEndpoints: Array<{
        portNumber: number;
        portProtocol: string;
        portLabel: string;
        portQueryValue: string;
        scanCompletedAt: Date | null;
        summary: AssetScanSummary | null;
        isPreview: boolean;
      }>;
    }> = [];

    const hasScanFilters =
      Boolean(dnsStateVal) ||
      Boolean(certStateVal) ||
      Boolean(tlsProfileVal) ||
      Boolean(selfSignedVal) ||
      Boolean(signatureAlgorithmVal) ||
      timeoutOnlyVal === "true" ||
      Boolean(cipherVal) ||
      Boolean(keySizeVal) ||
      Boolean(tlsVal) ||
      Boolean(endpointPortVal) ||
      Boolean(certExpiryVal) ||
      Boolean(noTlsFilter) ||
      selectedKexAlgos.length > 0 ||
      selectedKexGroups.length > 0 ||
      Boolean(pqcSupportedFilter) ||
      Boolean(pqcNegotiatedFilter) ||
      Boolean(pqcTierVal);

    for (const asset of assetRows) {
      if (searchVal && !asset.assetName.toLowerCase().includes(searchVal)) {
        continue;
      }

      const normalizedBucket = normalizeAssetBucket(asset.bucket || inferAssetBucket(asset.assetName));
      if (bucketVal && normalizedBucket !== bucketVal) {
        continue;
      }

      const assetScans = scansByAssetId.get(asset.assetId) || [];

      if (scanStatusVal) {
        if (scanStatusVal === "unscanned" && assetScans.length > 0) continue;
        if (scanStatusVal === "scanned") {
          const hasScanned = assetScans.some((scan) => scan.parsed.summary && !scan.parsed.summary.dnsMissing && !scan.parsed.error?.includes("timed out"));
          if (!hasScanned) continue;
        }
        if (scanStatusVal === "no_dns") {
          const hasNoDns = assetScans.some((scan) => scan.parsed.summary?.dnsMissing);
          if (!hasNoDns) continue;
        }
        if (scanStatusVal === "unresponsive") {
          const hasTimeout = assetScans.some((scan) => scan.parsed.error?.includes("timed out"));
          if (!hasTimeout) continue;
        }
      }

      const matchingEntries = hasScanFilters
        ? assetScans.filter((entry) => scanMatchesFilters(entry, filters))
        : assetScans;

      let chosenEntry: ParsedScanEntry | null = null;

      if (hasScanFilters) {
        chosenEntry = matchingEntries[0] || null;
        if (!chosenEntry && scanStatusVal !== "unscanned") {
          continue;
        }
      } else {
        chosenEntry = assetScans[0] || null;
      }

      const summary = chosenEntry ? buildSummary(chosenEntry.parsed, chosenEntry.row.resultData) : null;
      const matchingEndpointLabels = Array.from(
        new Set(matchingEntries.map((entry) => formatEndpointLabel(entry.row)))
      );
      const matchingEndpoints = matchingEntries.map((entry) => ({
        portNumber: entry.row.portNumber ?? 443,
        portProtocol: (entry.row.portProtocol || "tcp").toLowerCase(),
        portLabel: formatEndpointLabel(entry.row),
        portQueryValue: formatEndpointQueryValue(entry.row),
        scanCompletedAt: entry.row.completedAt ?? null,
        summary: buildSummary(entry.parsed, entry.row.resultData),
        isPreview:
          Boolean(chosenEntry) &&
          formatEndpointQueryValue(entry.row) === formatEndpointQueryValue(chosenEntry.row),
      }));

      filtered.push({
        id: asset.assetId,
        name: asset.assetName,
        type: asset.assetType,
        isRoot: asset.isRoot,
        addedAt: asset.addedAt,
        resolvedIp: asset.resolvedIp ?? null,
        openPorts: asset.openPorts ?? null,
        scanStatus: asset.scanStatus ?? null,
        bucket: normalizedBucket,
        scanCompletedAt: chosenEntry?.row.completedAt ?? null,
        summary,
        selectedEndpointLabel: chosenEntry ? formatEndpointLabel(chosenEntry.row) : null,
        matchingEndpointCount: matchingEntries.length,
        matchingEndpointLabels,
        matchingEndpoints,
      });
    }
    filtered.sort((a, b) => {
      const getScore = (item: typeof filtered[0]) => {
        if (!item.summary) return 1;
        if (item.summary.dnsMissing) return 0;
        if (item.summary.issue === "No TLS Detected") return 1;
        return 2;
      };
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.addedAt.getTime() - a.addedAt.getTime();
    });

    const totalMatch = filtered.length;
    const totalPages = shouldPaginate ? Math.max(1, Math.ceil(totalMatch / pageSize)) : 1;
    const currentPage = shouldPaginate ? Math.min(Math.max(requestedPage || 1, 1), totalPages) : 1;
    const startIndex = shouldPaginate ? (currentPage - 1) * pageSize : 0;
    const paginatedAssets = shouldPaginate
      ? filtered.slice(startIndex, startIndex + pageSize)
      : filtered;

    return NextResponse.json({
      assets: paginatedAssets,
      totalMatch,
      currentPage,
      pageSize: shouldPaginate ? pageSize : totalMatch,
      totalPages,
      matchingEndpointCount: filtered.reduce(
        (sum, asset) => sum + Math.max(asset.matchingEndpointCount, 0),
        0
      ),
      usesEndpointMatching: hasScanFilters,
      filterOptions: {
        ciphers: [...cipherOptions].sort(),
        keySizes: [...keySizeOptions].sort(),
        tlsVersions: [...tlsOptions].sort(compareTlsVersions),
        ports: [...portOptions].sort((left, right) => Number(left) - Number(right)),
        kexAlgorithms: [...kexAlgorithmOptions].sort(),
        kexGroups: [...negotiatedGroupOptions].sort(),
        signatureAlgorithms: [...signatureAlgorithmOptions].sort(),
        buckets: buildAssetBucketOptions(
          assetRows.map((asset) => ({
            bucket: asset.bucket,
            value: asset.assetName,
          }))
        ),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to compile exploration data" }, { status: 500 });
  }
}
