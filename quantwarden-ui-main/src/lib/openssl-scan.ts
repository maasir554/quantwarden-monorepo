const DAY_IN_MS = 24 * 60 * 60 * 1000;

const TLS_VERSION_ORDER: Record<string, number> = {
  "TLSv1.3": 4,
  "TLSv1.2": 3,
  "TLSv1.1": 2,
  "TLSv1.0": 1,
};

const STRONG_CIPHER_PATTERNS = [
  "GCM",
  "CHACHA20",
  "POLY1305",
  "CCM",
];

const WEAK_CIPHER_PATTERNS = [
  "RC4",
  "3DES",
  "DES",
  "MD5",
  "NULL",
  "EXPORT",
  "anon",
];

export interface OpenSSLVersionProbe {
  tls_version: string;
  supported: boolean;
  negotiated_cipher?: string | null;
  negotiated_protocol?: string | null;
  negotiated_group?: string | null;
  accepted_ciphers_in_client_offer_order?: string[];
  cipher_breakdowns?: OpenSSLCipherBreakdown[];
}

export interface OpenSSLCipherBreakdown {
  suite: string;
  tls_version: string;
  key_exchange?: string | null;
  authentication?: string | null;
  encryption: string;
  hash?: string | null;
}

export interface OpenSSLCertificateSummary {
  subject?: string | null;
  subject_normalized?: string | null;
  subject_attributes?: Record<string, string>;
  issuer?: string | null;
  issuer_normalized?: string | null;
  issuer_attributes?: Record<string, string>;
  serial_number?: string | null;
  not_before?: string | null;
  not_after?: string | null;
  signature_algorithm?: {
    name: string;
    normalized_name: string;
    oid?: string | null;
  } | null;
  public_key_algorithm?: {
    name: string;
    normalized_name: string;
    oid?: string | null;
  } | null;
  public_key_bits?: number | null;
  san_dns?: string[];
}

export interface OpenSSLNamedIdentifier {
  name: string;
  oid?: string | null;
  iana_code?: number | null;
}

export interface OpenSSLProfileResponse {
  target: string;
  port: number;
  resolved_ip?: string | null;
  scanned_at: string;
  tls_versions: OpenSSLVersionProbe[];
  tls_negotiation_order?: string[];
  tls_key_exchange_algorithms?: string[];
  tls_encryption_algorithms?: string[];
  tls_signature_algorithms?: string[];
  queried_groups?: string[];
  supported_groups?: string[];
  certificate: OpenSSLCertificateSummary;
  identifiers?: {
    certificate_algorithms?: OpenSSLNamedIdentifier[];
    tls_groups?: OpenSSLNamedIdentifier[];
  };
  metadata?: Record<string, unknown>;
}

export interface OpenSSLDerivedSummary {
  scanState: "reachable" | "dns_missing" | "no_tls";
  dnsMissing: boolean;
  noTlsDetected: boolean;
  certificatePresent: boolean;
  tlsEvidencePresent: boolean;
  dnsStatusLabel: string | null;
  portSecurityLabel: string | null;
  certificateValid: boolean | null;
  tlsVersionSecure: boolean | null;
  strongCipher: boolean | null;
  keySizeAdequate: boolean | null;
  selfSignedCert: boolean | null;
  warnings: string[];
  expiryDate: string | null;
  daysRemaining: number | null;
  primaryTlsVersion: string | null;
  supportedTlsVersions: string[];
  preferredCipher: string | null;
  negotiatedCipher: string | null;
  negotiatedGroup: string | null;
  subjectCommonName: string | null;
  issuerCommonName: string | null;
  sanCount: number;
  signatureAlgorithm: string | null;
  publicKeyAlgorithm: string | null;
  publicKeyBits: number | null;
  cipherPreferenceOrder: string[];
  keyExchangeAlgorithms: string[];
  encryptionAlgorithms: string[];
  signatureAlgorithms: string[];
  queriedGroups: string[];
  supportedGroups: string[];
}

export interface ParsedOpenSSLScan {
  raw: OpenSSLProfileResponse | null;
  summary: OpenSSLDerivedSummary | null;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function uniqueStrings(values: (string | null | undefined)[] | undefined): string[] {
  return Array.from(new Set((values || []).filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function getCommonName(attributes: Record<string, string> | undefined, raw: string | null | undefined): string | null {
  if (attributes?.commonName) return attributes.commonName;
  if (!raw) return null;
  const cnMatch = raw.match(/CN=([^,]+)/i);
  return cnMatch ? cnMatch[1].trim() : null;
}

function computeDaysRemaining(notAfter: string | null | undefined): number | null {
  if (!notAfter) return null;
  const expiryTime = new Date(notAfter).getTime();
  if (Number.isNaN(expiryTime)) return null;
  return Math.ceil((expiryTime - Date.now()) / DAY_IN_MS);
}

function getVersionRank(version: string | null | undefined): number {
  if (!version) return 0;
  return TLS_VERSION_ORDER[version] || 0;
}

function getPrimaryProbe(probes: OpenSSLVersionProbe[]): OpenSSLVersionProbe | null {
  const supported = probes.filter((probe) => probe.supported);
  if (supported.length === 0) return null;
  return [...supported].sort((left, right) => {
    return getVersionRank(right.negotiated_protocol || right.tls_version) - getVersionRank(left.negotiated_protocol || left.tls_version);
  })[0] || null;
}

function isStrongCipher(cipher: string | null | undefined): boolean | null {
  if (!cipher) return null;
  if (WEAK_CIPHER_PATTERNS.some((pattern) => cipher.toUpperCase().includes(pattern.toUpperCase()))) {
    return false;
  }
  if (STRONG_CIPHER_PATTERNS.some((pattern) => cipher.toUpperCase().includes(pattern.toUpperCase()))) {
    return true;
  }
  return null;
}

function normalizePublicKeyAlgorithm(certificate: OpenSSLCertificateSummary): string | null {
  const normalized = certificate.public_key_algorithm?.normalized_name || certificate.public_key_algorithm?.name || "";
  if (!normalized) return null;
  const lower = normalized.toLowerCase();
  if (lower.includes("rsa")) return "RSA";
  if (lower.includes("ecpublickey") || lower.includes("ecdsa") || lower.includes("elliptic")) return "EC";
  if (lower.includes("ed25519")) return "Ed25519";
  if (lower.includes("ed448")) return "Ed448";
  return certificate.public_key_algorithm?.name || null;
}

function isKeySizeAdequate(algorithm: string | null | undefined, bits: number | null | undefined): boolean | null {
  if (!algorithm || !bits) return null;
  const normalized = algorithm.toLowerCase();
  if (normalized.includes("rsa")) return bits >= 2048;
  if (normalized.includes("ec") || normalized.includes("ecdsa")) return bits >= 256;
  if (normalized.includes("ed25519") || normalized.includes("ed448")) return true;
  return bits >= 2048;
}

function isSelfSigned(certificate: OpenSSLCertificateSummary): boolean | null {
  const subject = certificate.subject_normalized || certificate.subject || null;
  const issuer = certificate.issuer_normalized || certificate.issuer || null;
  if (!subject || !issuer) return null;
  return subject === issuer;
}

function isCertificateCurrentlyValid(certificate: OpenSSLCertificateSummary): boolean | null {
  const { not_before, not_after } = certificate;
  if (!not_before || !not_after) return null;
  const notBeforeMs = new Date(not_before).getTime();
  const notAfterMs = new Date(not_after).getTime();
  if (Number.isNaN(notBeforeMs) || Number.isNaN(notAfterMs)) return null;
  const now = Date.now();
  return now >= notBeforeMs && now <= notAfterMs;
}

function isTlsVersionSecure(probes: OpenSSLVersionProbe[]): boolean | null {
  const supportedVersions = probes.filter((probe) => probe.supported).map((probe) => probe.negotiated_protocol || probe.tls_version);
  if (supportedVersions.length === 0) return null;
  return !supportedVersions.some((version) => version === "TLSv1.0" || version === "TLSv1.1");
}

export function deriveOpenSSLScanSummary(payload: OpenSSLProfileResponse): OpenSSLDerivedSummary {
  const primaryProbe = getPrimaryProbe(payload.tls_versions || []);
  const certificate = payload.certificate || {};
  const supportedProbeCount = (payload.tls_versions || []).filter((probe) => probe.supported).length;
  const certificatePresent = Boolean(
    certificate.subject ||
      certificate.subject_normalized ||
      certificate.not_before ||
      certificate.not_after ||
      certificate.issuer ||
      certificate.issuer_normalized ||
      certificate.serial_number ||
      certificate.san_dns?.length
  );
  const dnsMissing =
    payload.resolved_ip === null &&
    supportedProbeCount === 0 &&
    !certificate.subject &&
    !certificate.not_after;
  const subjectCommonName = getCommonName(certificate.subject_attributes, certificate.subject);
  const issuerCommonName = getCommonName(certificate.issuer_attributes, certificate.issuer);
  const expiryDate = certificate.not_after || null;
  const daysRemaining = computeDaysRemaining(expiryDate);
  const certificateValid = isCertificateCurrentlyValid(certificate);
  const selfSignedCert = isSelfSigned(certificate);
  const primaryTlsVersion = primaryProbe?.negotiated_protocol || primaryProbe?.tls_version || null;
  const negotiatedCipher = primaryProbe?.negotiated_cipher || null;
  const preferredCipher =
    primaryProbe?.accepted_ciphers_in_client_offer_order?.[0] ||
    negotiatedCipher ||
    payload.tls_negotiation_order?.[0] ||
    null;
  const strongCipher = isStrongCipher(preferredCipher || negotiatedCipher);
  const publicKeyAlgorithm = normalizePublicKeyAlgorithm(certificate);
  const publicKeyBits = certificate.public_key_bits ?? null;
  const keySizeAdequate = isKeySizeAdequate(publicKeyAlgorithm, publicKeyBits);
  const tlsVersionSecure = isTlsVersionSecure(payload.tls_versions || []);
  const supportedTlsVersions = (payload.tls_versions || [])
    .filter((probe) => probe.supported)
    .map((probe) => probe.negotiated_protocol || probe.tls_version);
  const tlsEvidencePresent = Boolean(
    supportedProbeCount > 0 ||
      primaryTlsVersion ||
      negotiatedCipher ||
      preferredCipher ||
      payload.tls_negotiation_order?.length ||
      payload.tls_key_exchange_algorithms?.length ||
      payload.tls_encryption_algorithms?.length
  );
  const noTlsDetected = !dnsMissing && !certificatePresent && !tlsEvidencePresent;

  const warnings: string[] = [];
  if (dnsMissing) warnings.push("This domain no longer resolves in DNS.");
  if (noTlsDetected) warnings.push("No TLS or certificate was detected on this port.");
  if (noTlsDetected && payload.port === 80) warnings.push("This often indicates a plain HTTP service, but no TLS was detected on this port.");
  if (certificateValid === false) warnings.push("Certificate is expired or outside its validity window.");
  if (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 30) warnings.push(`Certificate expires in ${daysRemaining} days.`);
  if (selfSignedCert) warnings.push("Certificate appears to be self-signed.");
  if (keySizeAdequate === false) warnings.push("Public key size is below the recommended baseline.");
  if (tlsVersionSecure === false) warnings.push("Legacy TLS versions are still enabled on this asset.");
  if (strongCipher === false) warnings.push("Preferred cipher selection is not considered strong.");

  return {
    scanState: dnsMissing ? "dns_missing" : noTlsDetected ? "no_tls" : "reachable",
    dnsMissing,
    noTlsDetected,
    certificatePresent,
    tlsEvidencePresent,
    dnsStatusLabel: dnsMissing ? "DNS Expired" : noTlsDetected ? "No TLS Detected" : null,
    portSecurityLabel: dnsMissing ? "DNS Expired" : noTlsDetected ? "No TLS Detected" : null,
    certificateValid,
    tlsVersionSecure,
    strongCipher,
    keySizeAdequate,
    selfSignedCert,
    warnings,
    expiryDate,
    daysRemaining,
    primaryTlsVersion,
    supportedTlsVersions: uniqueStrings(supportedTlsVersions),
    preferredCipher,
    negotiatedCipher,
    negotiatedGroup: primaryProbe?.negotiated_group || null,
    subjectCommonName,
    issuerCommonName,
    sanCount: certificate.san_dns?.length || 0,
    signatureAlgorithm: certificate.signature_algorithm?.name || null,
    publicKeyAlgorithm,
    publicKeyBits,
    cipherPreferenceOrder: uniqueStrings(payload.tls_negotiation_order),
    keyExchangeAlgorithms: uniqueStrings(payload.tls_key_exchange_algorithms),
    encryptionAlgorithms: uniqueStrings(payload.tls_encryption_algorithms),
    signatureAlgorithms: uniqueStrings(payload.tls_signature_algorithms),
    queriedGroups: uniqueStrings(payload.queried_groups),
    supportedGroups: uniqueStrings(payload.supported_groups),
  };
}

export function isOpenSSLProfileResponse(value: unknown): value is OpenSSLProfileResponse {
  return isRecord(value) && Array.isArray(value.tls_versions) && isRecord(value.certificate);
}

export function parseOpenSSLScanResult(resultData: string | Record<string, unknown> | null | undefined): ParsedOpenSSLScan {
  if (!resultData) {
    return { raw: null, summary: null, error: null };
  }

  let parsed: unknown = resultData;

  if (typeof resultData === "string") {
    try {
      parsed = JSON.parse(resultData);
    } catch {
      return { raw: null, summary: null, error: "Failed to parse stored scan output." };
    }
  }

  if (isRecord(parsed) && typeof parsed.error === "string") {
    return { raw: null, summary: null, error: parsed.error };
  }

  if (!isOpenSSLProfileResponse(parsed)) {
    return { raw: null, summary: null, error: "Stored scan payload does not match the OpenSSL API format." };
  }

  return {
    raw: parsed,
    summary: deriveOpenSSLScanSummary(parsed),
    error: null,
  };
}
