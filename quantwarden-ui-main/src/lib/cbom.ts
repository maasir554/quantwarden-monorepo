import {
  parseOpenSSLScanResult,
  type OpenSSLCertificateSummary,
  type OpenSSLProfileResponse,
} from "@/lib/openssl-scan";

export const CBOM_NOT_REPORTED = "Not reported";

export type CbomAlgorithmRow = {
  cryptographicAssetType: string;
  name: string;
  assetType: string;
  primitive: string;
  mode: string;
  cryptoFunctions: string;
  classicalSecurityLevel: string;
  oid: string;
  list: string;
  assets: string[];
};

export type CbomKeyRow = {
  cryptographicAssetType: string;
  name: string;
  assetType: string;
  id: string;
  state: string;
  size: string;
  creationDate: string;
  activationDate: string;
};

export type CbomProtocolRow = {
  cryptographicAssetType: string;
  name: string;
  assetType: string;
  version: string;
  cipherSuites: string;
  oid: string;
};

export type CbomCertificateRow = {
  cryptographicAssetType: string;
  name: string;
  assetType: string;
  subjectC: string;
  subjectCN: string;
  subjectO: string;
  issuerC: string;
  issuerCN: string;
  issuerO: string;
  notValidBefore: string;
  notValidAfter: string;
  signatureAlgorithmReference: string;
  subjectPublicKeyReference: string;
  certificateFormat: string;
  certificateExtension: string;
};

export type CbomResponse = {
  generatedAt: string;
  notes: string[];
  missingFields: {
    algorithms: string[];
    keys: string[];
    protocols: string[];
    certificates: string[];
  };
  algorithms: CbomAlgorithmRow[];
  keys: CbomKeyRow[];
  protocols: CbomProtocolRow[];
  certificates: CbomCertificateRow[];
};

export type CbomScanSource = {
  assetId: string;
  assetName: string;
  assetType: string;
  portNumber: number | null;
  portProtocol: string | null;
  resultData: string | null;
};

type AlgorithmAggregate = Omit<CbomAlgorithmRow, "list" | "assets"> & {
  contexts: Set<string>;
  assets: Set<string>;
};

const TLS_VERSION_ORDER: Record<string, number> = {
  "TLSv1.3": 4,
  "TLSv1.2": 3,
  "TLSv1.1": 2,
  "TLSv1.0": 1,
};

const ALGORITHM_OID_MAP: Record<string, string> = {
  aes128gcm: "2.16.840.1.101.3.4.1.6",
  aes256gcm: "2.16.840.1.101.3.4.1.46",
  aes128ccm: "2.16.840.1.101.3.4.1.7",
  aes256ccm: "2.16.840.1.101.3.4.1.47",
  chacha20poly1305: "1.2.840.113549.1.9.16.3.18",
  sha1: "1.3.14.3.2.26",
  sha256: "2.16.840.1.101.3.4.2.1",
  sha384: "2.16.840.1.101.3.4.2.2",
  sha512: "2.16.840.1.101.3.4.2.3",
  sha1withrsaencryption: "1.2.840.113549.1.1.5",
  sha256withrsaencryption: "1.2.840.113549.1.1.11",
  sha384withrsaencryption: "1.2.840.113549.1.1.12",
  sha512withrsaencryption: "1.2.840.113549.1.1.13",
  rsassapss: "1.2.840.113549.1.1.10",
  rsa: "1.2.840.113549.1.1.1",
  ecpublickey: "1.2.840.10045.2.1",
  idecpublickey: "1.2.840.10045.2.1",
  ecdsa: "1.2.840.10045.4",
  ecdsawithsha256: "1.2.840.10045.4.3.2",
  ecdsawithsha384: "1.2.840.10045.4.3.3",
  ecdsawithsha512: "1.2.840.10045.4.3.4",
  secp256r1: "1.2.840.10045.3.1.7",
  secp384r1: "1.3.132.0.34",
  secp521r1: "1.3.132.0.35",
  x25519: "1.3.101.110",
  x448: "1.3.101.111",
  ed25519: "1.3.101.112",
  ed448: "1.3.101.113",
};

function normalizeLookupKey(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function formatPortLabel(portNumber: number | null, portProtocol: string | null) {
  return `${portNumber || 443}/${(portProtocol || "tcp").toUpperCase()}`;
}

function formatEndpointReference(row: Pick<CbomScanSource, "assetName" | "portNumber" | "portProtocol">) {
  return `${row.assetName}:${formatPortLabel(row.portNumber, row.portProtocol)}`;
}

function formatAssetContext(assetType: string, endpointReference: string) {
  if (assetType === "domain") return `Domain endpoint (${endpointReference})`;
  if (assetType === "ip") return `IP endpoint (${endpointReference})`;
  return `${assetType} endpoint (${endpointReference})`;
}

function extractDnAttribute(raw: string | null | undefined, candidateKeys: string[]) {
  if (!raw) return null;
  const lowerCandidates = candidateKeys.map((candidate) => candidate.toLowerCase());
  for (const part of raw.split(",")) {
    const [key, ...rest] = part.split("=");
    if (!key || rest.length === 0) continue;
    if (lowerCandidates.includes(key.trim().toLowerCase())) {
      return rest.join("=").trim();
    }
  }
  return null;
}

function pickAttribute(
  attributes: Record<string, string> | undefined,
  raw: string | null | undefined,
  candidateKeys: string[]
) {
  for (const key of candidateKeys) {
    const direct = attributes?.[key];
    if (direct) return direct;
  }
  return extractDnAttribute(raw, candidateKeys);
}

function cleanText(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : CBOM_NOT_REPORTED;
}

function preferReported(current: string, next: string) {
  return current === CBOM_NOT_REPORTED && next !== CBOM_NOT_REPORTED ? next : current;
}

function formatReference(name: string | null | undefined, oid: string | null | undefined) {
  if (!name && !oid) return CBOM_NOT_REPORTED;
  if (!oid) return cleanText(name);
  return `${cleanText(name)} (OID ${oid})`;
}

function formatPublicKeyReference(certificate: OpenSSLCertificateSummary) {
  const algorithm = certificate.public_key_algorithm?.name || null;
  const bits = certificate.public_key_bits ? `${certificate.public_key_bits}-bit` : null;
  const base = [algorithm, bits].filter(Boolean).join(" ");
  return formatReference(base || algorithm, certificate.public_key_algorithm?.oid || null);
}

function inferPrimitive(name: string) {
  const normalized = name.toLowerCase();
  if (/(sha[0-9]+|md5)/.test(normalized)) return "hash";
  if (normalized === "ecdsa") return "signature";
  if (/(ecdsa|ed25519|ed448|rsa)/.test(normalized) && /(sha|pss|encryption)/.test(normalized)) return "signature";
  if (/(ecdhe|dhe|ecdh|x25519|x448|secp[0-9]+r1|ffdhe[0-9]+|mlkem|kyber)/.test(normalized)) return "key exchange";
  if (/(aes|aria|camellia|chacha20|des|3des|rc4)/.test(normalized)) {
    return /(gcm|ccm|poly1305)/.test(normalized) ? "authenticated encryption" : "encryption";
  }
  if (
    normalized === "rsa" ||
    normalized === "ecpublickey" ||
    normalized === "id-ecpublickey" ||
    normalized === "idecpublickey"
  ) {
    return "signature";
  }
  return CBOM_NOT_REPORTED;
}

function inferMode(name: string, primitive: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("gcm")) return "gcm";
  if (normalized.includes("ccm")) return "ccm";
  if (normalized.includes("poly1305")) return "poly1305";
  if (normalized.includes("cbc")) return "cbc";
  if (normalized.includes("ctr")) return "ctr";
  if (primitive === "hash") return "digest";
  if (primitive === "signature" && normalized === "ecdsa") return "ecdsa";
  if (primitive === "signature" && (normalized === "ecpublickey" || normalized === "id-ecpublickey" || normalized === "idecpublickey")) {
    return "elliptic curve";
  }
  if (primitive === "signature" && normalized.includes("pss")) return "pss";
  if (primitive === "signature" && normalized.includes("rsa") && normalized.includes("sha")) return "pkcs1v1.5";
  if (primitive === "key exchange" && /(ecdhe|dhe)/.test(normalized)) return "ephemeral";
  if (primitive === "key exchange" && /(mlkem|kyber)/.test(normalized)) return "hybrid";
  if (primitive === "key exchange" && /(x25519|x448|secp[0-9]+r1|ffdhe[0-9]+)/.test(normalized)) return "group";
  return CBOM_NOT_REPORTED;
}

function inferCryptoFunctions(name: string, primitive: string) {
  const normalized = name.toLowerCase();
  if (normalized === "ecdsa") return "certificate signing, signature verification";
  if (normalized === "ecpublickey" || normalized === "id-ecpublickey" || normalized === "idecpublickey") {
    return "certificate signature verification, public key reference";
  }
  if (primitive === "hash") return "hashing, digest verification";
  if (primitive === "signature") return "signing, verification";
  if (primitive === "key exchange") return "key agreement, handshake negotiation";
  if (primitive === "authenticated encryption") return "encryption, decryption, integrity protection";
  if (primitive === "encryption") return "encryption, decryption";
  return CBOM_NOT_REPORTED;
}

function inferSecurityLevel(name: string) {
  const normalized = name.toLowerCase();
  if (/(aes[-_]?128|sha256)/.test(normalized)) return "128 bits";
  if (/(aes[-_]?256|sha512|chacha20|poly1305)/.test(normalized)) return "256 bits";
  if (normalized.includes("sha384")) return "192 bits";
  if (/(x25519|secp256r1|prime256v1|ecdhe)/.test(normalized)) return "128 bits";
  if (normalized.includes("secp384r1")) return "192 bits";
  if (/(secp521r1|x448)/.test(normalized)) return "224 bits";
  if (normalized === "ecdsa" || normalized === "ecpublickey" || normalized === "id-ecpublickey" || normalized === "idecpublickey") {
    return "Depends on curve";
  }
  if (normalized.includes("ffdhe2048")) return "112 bits";
  if (normalized.includes("ffdhe3072")) return "128 bits";
  if (normalized.includes("ffdhe4096")) return ">=128 bits";
  if (normalized.includes("ffdhe6144")) return ">=128 bits";
  if (normalized.includes("ffdhe8192")) return ">=192 bits";
  if (normalized.includes("mlkem768") || normalized.includes("kyber768")) return "128 bits classical / hybrid PQ";
  return CBOM_NOT_REPORTED;
}

function lookupAlgorithmOid(name: string, raw: OpenSSLProfileResponse | null) {
  const identifiers = raw?.identifiers;
  const normalizedName = normalizeLookupKey(name);

  const certificateIdentifier = identifiers?.certificate_algorithms?.find(
    (entry) => normalizeLookupKey(entry.name) === normalizedName && entry.oid
  );
  if (certificateIdentifier?.oid) return certificateIdentifier.oid;

  const tlsGroupIdentifier = identifiers?.tls_groups?.find(
    (entry) => normalizeLookupKey(entry.name) === normalizedName && entry.oid
  );
  if (tlsGroupIdentifier?.oid) return tlsGroupIdentifier.oid;

  return ALGORITHM_OID_MAP[normalizedName] || null;
}

function formatObservedList(contexts: Set<string>) {
  const ordered = [...contexts].sort((left, right) => left.localeCompare(right));
  if (ordered.length <= 6) return ordered.join(", ");
  return `${ordered.slice(0, 6).join(", ")} (+${ordered.length - 6} more)`;
}

function buildAlgorithmRows(scans: CbomScanSource[]) {
  const aggregates = new Map<string, AlgorithmAggregate>();

  const recordAlgorithm = (
    name: string | null | undefined,
    raw: OpenSSLProfileResponse | null,
    endpointReference: string,
    assetName: string,
    explicitOid?: string | null
  ) => {
    if (!name || !name.trim()) return;

    const algorithmName = name.trim();
    const primitive = inferPrimitive(algorithmName);
    const mode = inferMode(algorithmName, primitive);
    const oid = explicitOid || lookupAlgorithmOid(algorithmName, raw) || CBOM_NOT_REPORTED;
    const key = [normalizeLookupKey(algorithmName), primitive, mode].join("|");
    const existing = aggregates.get(key);

    if (existing) {
      existing.oid = preferReported(existing.oid, oid);
      existing.classicalSecurityLevel = preferReported(existing.classicalSecurityLevel, inferSecurityLevel(algorithmName));
      existing.contexts.add(endpointReference);
      existing.assets.add(assetName);
      return;
    }

    aggregates.set(key, {
      cryptographicAssetType: "Algorithms",
      name: algorithmName,
      assetType: "algorithm",
      primitive,
      mode,
      cryptoFunctions: inferCryptoFunctions(algorithmName, primitive),
      classicalSecurityLevel: inferSecurityLevel(algorithmName),
      oid,
      contexts: new Set([endpointReference]),
      assets: new Set([assetName]),
    });
  };

  for (const row of scans) {
    const parsed = parseOpenSSLScanResult(row.resultData);
    if (!parsed.raw || !parsed.summary || parsed.summary.noTlsDetected) continue;

    const endpointReference = formatEndpointReference(row);
    const raw = parsed.raw;
    const certificate = raw.certificate || {};

    recordAlgorithm(certificate.signature_algorithm?.name, raw, endpointReference, row.assetName, certificate.signature_algorithm?.oid || null);
    recordAlgorithm(certificate.public_key_algorithm?.name, raw, endpointReference, row.assetName, certificate.public_key_algorithm?.oid || null);

    for (const signatureAlgorithm of parsed.summary.signatureAlgorithms) {
      recordAlgorithm(signatureAlgorithm, raw, endpointReference, row.assetName);
    }

    for (const keyExchangeAlgorithm of parsed.summary.keyExchangeAlgorithms) {
      recordAlgorithm(keyExchangeAlgorithm, raw, endpointReference, row.assetName);
    }

    for (const encryptionAlgorithm of parsed.summary.encryptionAlgorithms) {
      recordAlgorithm(encryptionAlgorithm, raw, endpointReference, row.assetName);
    }

    for (const supportedGroup of parsed.summary.supportedGroups) {
      recordAlgorithm(supportedGroup, raw, endpointReference, row.assetName);
    }

    for (const probe of raw.tls_versions || []) {
      for (const breakdown of probe.cipher_breakdowns || []) {
        recordAlgorithm(breakdown.key_exchange, raw, endpointReference, row.assetName);
        recordAlgorithm(breakdown.authentication, raw, endpointReference, row.assetName);
        recordAlgorithm(breakdown.encryption, raw, endpointReference, row.assetName);
        recordAlgorithm(breakdown.hash, raw, endpointReference, row.assetName);
      }
    }
  }

  return [...aggregates.values()]
    .map((aggregate) => ({
      cryptographicAssetType: aggregate.cryptographicAssetType,
      name: aggregate.name,
      assetType: aggregate.assetType,
      primitive: aggregate.primitive,
      mode: aggregate.mode,
      cryptoFunctions: aggregate.cryptoFunctions,
      classicalSecurityLevel: aggregate.classicalSecurityLevel,
      oid: aggregate.oid,
      list: formatObservedList(aggregate.contexts),
      assets: [...aggregate.assets].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => {
      const primitiveDelta = left.primitive.localeCompare(right.primitive);
      return primitiveDelta !== 0 ? primitiveDelta : left.name.localeCompare(right.name);
    });
}

function buildKeyRows(scans: CbomScanSource[]) {
  const rows: CbomKeyRow[] = [];

  for (const row of scans) {
    const parsed = parseOpenSSLScanResult(row.resultData);
    const certificate = parsed.raw?.certificate;
    if (!parsed.summary || !certificate || parsed.summary.noTlsDetected) continue;

    const subjectCommonName =
      pickAttribute(certificate.subject_attributes, certificate.subject, ["CN", "commonName"]) || row.assetName;
    const size = [certificate.public_key_algorithm?.name, certificate.public_key_bits ? `${certificate.public_key_bits}-bit` : null]
      .filter(Boolean)
      .join(" ");

    if (!size) continue;

    rows.push({
      cryptographicAssetType: "Keys",
      name: `${subjectCommonName} public key`,
      assetType: `certificate public key (${formatAssetContext(row.assetType, formatEndpointReference(row))})`,
      id: CBOM_NOT_REPORTED,
      state: CBOM_NOT_REPORTED,
      size,
      creationDate: CBOM_NOT_REPORTED,
      activationDate: CBOM_NOT_REPORTED,
    });
  }

  return rows.sort((left, right) => left.name.localeCompare(right.name));
}

function buildProtocolRows(scans: CbomScanSource[]) {
  const rows: CbomProtocolRow[] = [];

  for (const row of scans) {
    const parsed = parseOpenSSLScanResult(row.resultData);
    if (!parsed.raw || !parsed.summary || parsed.summary.noTlsDetected) continue;

    const assetContext = formatAssetContext(row.assetType, formatEndpointReference(row));

    for (const probe of parsed.raw.tls_versions || []) {
      if (!probe.supported) continue;

      const version = probe.negotiated_protocol || probe.tls_version || null;
      const cipherSuites = uniqueStrings([
        ...(probe.accepted_ciphers_in_client_offer_order || []),
        probe.negotiated_cipher || undefined,
      ]);

      rows.push({
        cryptographicAssetType: "Protocols",
        name: "TLS",
        assetType: assetContext,
        version: version ? version.replace(/^TLSv/i, "") : CBOM_NOT_REPORTED,
        cipherSuites: cipherSuites.length ? cipherSuites.join(", ") : CBOM_NOT_REPORTED,
        oid: CBOM_NOT_REPORTED,
      });
    }
  }

  return rows.sort((left, right) => {
    const leftVersion = `TLSv${left.version}`;
    const rightVersion = `TLSv${right.version}`;
    const rankDelta = (TLS_VERSION_ORDER[rightVersion] || 0) - (TLS_VERSION_ORDER[leftVersion] || 0);
    return rankDelta !== 0 ? rankDelta : left.assetType.localeCompare(right.assetType);
  });
}

function buildCertificateRows(scans: CbomScanSource[]) {
  const rows: CbomCertificateRow[] = [];

  for (const row of scans) {
    const parsed = parseOpenSSLScanResult(row.resultData);
    const certificate = parsed.raw?.certificate;
    if (!parsed.summary || !certificate || parsed.summary.noTlsDetected) continue;

    const subjectCN = pickAttribute(certificate.subject_attributes, certificate.subject, ["CN", "commonName"]);
    const subjectO = pickAttribute(certificate.subject_attributes, certificate.subject, ["O", "organizationName"]);
    const subjectC = pickAttribute(certificate.subject_attributes, certificate.subject, ["C", "countryName"]);
    const issuerCN = pickAttribute(certificate.issuer_attributes, certificate.issuer, ["CN", "commonName"]);
    const issuerO = pickAttribute(certificate.issuer_attributes, certificate.issuer, ["O", "organizationName"]);
    const issuerC = pickAttribute(certificate.issuer_attributes, certificate.issuer, ["C", "countryName"]);

    rows.push({
      cryptographicAssetType: "Certificates",
      name: cleanText(subjectCN || `${row.assetName} certificate`),
      assetType: `certificate (${formatAssetContext(row.assetType, formatEndpointReference(row))})`,
      subjectC: cleanText(subjectC),
      subjectCN: cleanText(subjectCN),
      subjectO: cleanText(subjectO),
      issuerC: cleanText(issuerC),
      issuerCN: cleanText(issuerCN),
      issuerO: cleanText(issuerO),
      notValidBefore: cleanText(certificate.not_before),
      notValidAfter: cleanText(certificate.not_after),
      signatureAlgorithmReference: formatReference(
        certificate.signature_algorithm?.name,
        certificate.signature_algorithm?.oid || lookupAlgorithmOid(certificate.signature_algorithm?.name || null, parsed.raw)
      ),
      subjectPublicKeyReference: formatPublicKeyReference(certificate),
      certificateFormat: "X.509",
      certificateExtension: CBOM_NOT_REPORTED,
    });
  }

  return rows.sort((left, right) => {
    const leftExpiry = left.notValidAfter === CBOM_NOT_REPORTED ? Number.MAX_SAFE_INTEGER : new Date(left.notValidAfter).getTime();
    const rightExpiry = right.notValidAfter === CBOM_NOT_REPORTED ? Number.MAX_SAFE_INTEGER : new Date(right.notValidAfter).getTime();
    return leftExpiry - rightExpiry || left.name.localeCompare(right.name);
  });
}

export function buildCbomResponse(scans: CbomScanSource[]): CbomResponse {
  return {
    generatedAt: new Date().toISOString(),
    notes: [
      "Derived from the latest completed OpenSSL scan stored for each asset endpoint.",
      "Keys reflect observed certificate public keys. Key lifecycle fields are not present in the stored scan payload.",
      `"${CBOM_NOT_REPORTED}" indicates the current payload does not expose that CERT-In CBOM field.`,
    ],
    missingFields: {
      algorithms: ["Some OIDs and classical security levels require a broader canonical mapping set."],
      keys: ["id", "state", "creationDate", "activationDate"],
      protocols: ["oid"],
      certificates: ["certificateExtension"],
    },
    algorithms: buildAlgorithmRows(scans),
    keys: buildKeyRows(scans),
    protocols: buildProtocolRows(scans),
    certificates: buildCertificateRows(scans),
  };
}
