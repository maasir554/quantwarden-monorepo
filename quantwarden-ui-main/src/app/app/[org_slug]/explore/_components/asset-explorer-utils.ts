import { BooleanFilter } from "./asset-explorer-types";
import { normalizeAssetOpenPorts } from "@/lib/port-discovery";

export const ALL_FILTER_VALUE = "__all__";
export const FILTER_QUERY_KEYS = [
  "filter",
  "search",
  "dnsState",
  "certState",
  "tlsProfile",
  "tlsMatch",
  "selfSigned",
  "signatureAlgorithm",
  "port",
  "certExpiry",
  "timeoutOnly",
  "noTls",
  "cipher",
  "keySize",
  "tls",
  "pqcSupported",
  "pqcNegotiated",
  "pqcTier",
  "scanStatus",
  "bucket",
  "kexAlgos",
  "kexGroups",
  "page",
  "pageSize",
];

export const expandTransition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const miniNavTopOffset = 96;
export const pageSizeOptions = [10, 25, 50, 100];

export function normalizeBooleanFilter(value: string): BooleanFilter {
  return value === "true" ? "true" : value === "false" ? "false" : "";
}

export function buildFilterQueryParams({
  dnsState,
  certState,
  tlsProfile,
  tlsMatch,
  selfSigned,
  signatureAlgorithm,
  port,
  certExpiry,
  timeoutOnly,
  noTlsOnly,
  cipher,
  keySize,
  tls,
  pqcSupportedOnly,
  pqcNegotiatedOnly,
  pqcTier,
  scanStatus,
  bucket,
  kexAlgorithms,
  kexGroups,
  page,
  pageSize,
}: {
  dnsState: string;
  certState: string;
  tlsProfile: string;
  tlsMatch: string;
  selfSigned: string;
  signatureAlgorithm: string;
  port: string;
  certExpiry: string;
  timeoutOnly: BooleanFilter;
  noTlsOnly: BooleanFilter;
  cipher: string;
  keySize: string;
  tls: string;
  pqcSupportedOnly: BooleanFilter;
  pqcNegotiatedOnly: BooleanFilter;
  pqcTier: string;
  scanStatus: string;
  bucket: string;
  kexAlgorithms: string[];
  kexGroups: string[];
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  if (dnsState) params.set("dnsState", dnsState);
  if (certState) params.set("certState", certState);
  if (tlsProfile) params.set("tlsProfile", tlsProfile);
  if (tlsMatch) params.set("tlsMatch", tlsMatch);
  if (selfSigned) params.set("selfSigned", selfSigned);
  if (signatureAlgorithm) params.set("signatureAlgorithm", signatureAlgorithm);
  if (port) params.set("port", port);
  if (certExpiry) params.set("certExpiry", certExpiry);
  if (timeoutOnly) params.set("timeoutOnly", timeoutOnly);
  if (noTlsOnly) params.set("noTls", noTlsOnly);
  if (cipher) params.set("cipher", cipher);
  if (keySize) params.set("keySize", keySize);
  if (tls) params.set("tls", tls);
  if (pqcSupportedOnly) params.set("pqcSupported", pqcSupportedOnly);
  if (pqcNegotiatedOnly) params.set("pqcNegotiated", pqcNegotiatedOnly);
  if (pqcTier) params.set("pqcTier", pqcTier);
  if (scanStatus) params.set("scanStatus", scanStatus);
  if (bucket) params.set("bucket", bucket);
  if (kexAlgorithms.length > 0) params.set("kexAlgos", kexAlgorithms.join(","));
  if (kexGroups.length > 0) params.set("kexGroups", kexGroups.join(","));
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 25) params.set("pageSize", String(pageSize));

  return params;
}

export function countActiveFilters({
  dnsState,
  certState,
  tlsProfile,
  tlsMatch,
  selfSigned,
  signatureAlgorithm,
  port,
  certExpiry,
  timeoutOnly,
  noTlsOnly,
  cipher,
  keySize,
  tls,
  pqcSupportedOnly,
  pqcNegotiatedOnly,
  pqcTier,
  scanStatus,
  bucket,
  kexAlgorithms,
  kexGroups,
}: {
  dnsState: string;
  certState: string;
  tlsProfile: string;
  tlsMatch: string;
  selfSigned: string;
  signatureAlgorithm: string;
  port: string;
  certExpiry: string;
  timeoutOnly: BooleanFilter;
  noTlsOnly: BooleanFilter;
  cipher: string;
  keySize: string;
  tls: string;
  pqcSupportedOnly: BooleanFilter;
  pqcNegotiatedOnly: BooleanFilter;
  kexAlgorithms: string[];
  kexGroups: string[];
  pqcTier: string;
  scanStatus: string;
  bucket: string;
}) {
  return [
    dnsState,
    certState,
    tlsProfile,
    tlsMatch,
    selfSigned,
    signatureAlgorithm,
    port,
    certExpiry,
    timeoutOnly,
    noTlsOnly,
    cipher,
    keySize,
    tls,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    pqcTier,
    scanStatus,
    bucket,
    ...kexAlgorithms,
    ...kexGroups,
  ].filter(Boolean).length;
}

export function countAdvancedFilters({
  timeoutOnly,
  noTlsOnly,
  pqcSupportedOnly,
  pqcNegotiatedOnly,
  pqcTier,
  scanStatus,
  bucket,
  kexAlgorithms,
  kexGroups,
}: {
  timeoutOnly: BooleanFilter;
  noTlsOnly: BooleanFilter;
  pqcSupportedOnly: BooleanFilter;
  pqcNegotiatedOnly: BooleanFilter;
  pqcTier: string;
  scanStatus: string;
  bucket: string;
  kexAlgorithms: string[];
  kexGroups: string[];
}) {
  return [
    timeoutOnly,
    noTlsOnly,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    pqcTier,
    scanStatus,
    bucket,
    ...kexAlgorithms,
    ...kexGroups,
  ].filter(Boolean).length;
}

export function assetMatchesClientSearch(asset: any, normalizedSearch: string) {
  if (!normalizedSearch) return true;

  const portTokens = normalizeAssetOpenPorts(asset.openPorts).flatMap((port) => [
    String(port.number),
    `${port.number}/${port.protocol}`,
    `${port.number}/${port.protocol.toUpperCase()}`,
  ]);
  const endpointTokens = (asset.matchingEndpoints || []).flatMap((endpoint: any) => [
    endpoint.portLabel,
    endpoint.portProtocol,
    endpoint.summary?.issue,
    endpoint.summary?.tls,
    endpoint.summary?.keySize,
    endpoint.summary?.cipher,
    ...(endpoint.summary?.discoveredCiphers || []),
  ]);
  const haystack = [
    asset.name,
    asset.type,
    asset.resolvedIp,
    asset.scanStatus,
    asset.bucket,
    asset.selectedEndpointLabel,
    asset.summary?.issue,
    asset.summary?.tls,
    asset.summary?.keySize,
    asset.summary?.cipher,
    ...(asset.summary?.discoveredCiphers || []),
    ...(asset.matchingEndpointLabels || []),
    ...portTokens,
    ...endpointTokens,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}
