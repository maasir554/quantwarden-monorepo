import {
  CBOM_NOT_REPORTED,
  type CbomAlgorithmRow,
  type CbomAssetDetail,
  type CbomResponse,
} from "@/lib/cbom";

export const CYCLONEDX_CBOM_SPEC_VERSION = "1.6";
export const SPDX_INTEROP_SPEC_VERSION = "SPDX-2.3";

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function reported(value: string) {
  return value !== CBOM_NOT_REPORTED && value.trim().length > 0;
}

function parseInteger(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function toCycloneDxMode(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const supported = new Set(["cbc", "ecb", "ccm", "gcm", "cfb", "ofb", "ctr"]);
  return supported.has(normalized) ? normalized : null;
}

function toCycloneDxPrimitive(row: CbomAlgorithmRow) {
  const primitiveMap: Record<string, string> = {
    hash: "hash",
    signature: "signature",
    "key exchange": /mlkem|kyber/i.test(row.name) ? "kem" : "key-agree",
    "authenticated encryption": "ae",
    encryption: /chacha|rc4/i.test(row.name) ? "stream-cipher" : "block-cipher",
  };
  return primitiveMap[row.primitive] || "unknown";
}

function algorithmComponent(row: CbomAlgorithmRow, index: number, assetName?: string) {
  const securityLevel = parseInteger(row.classicalSecurityLevel);
  const mode = reported(row.mode) ? toCycloneDxMode(row.mode) : null;
  return {
    type: "cryptographic-asset",
    name: row.name,
    "bom-ref": `crypto-algorithm-${slug(row.name)}-${index}`,
    cryptoProperties: {
      assetType: "algorithm",
      algorithmProperties: {
        primitive: toCycloneDxPrimitive(row),
        ...(mode ? { mode } : {}),
        ...(securityLevel !== null ? { classicalSecurityLevel: securityLevel } : {}),
      },
      ...(reported(row.oid) ? { oid: row.oid } : {}),
    },
    properties: [
      { name: "quantwarden:cert-in:asset-type", value: row.assetType },
      { name: "quantwarden:cert-in:crypto-functions", value: row.cryptoFunctions },
      ...(reported(row.mode) ? [{ name: "quantwarden:cert-in:reported-mode", value: row.mode }] : []),
      { name: "quantwarden:observed-assets", value: assetName || row.assets.join(", ") },
    ],
  };
}

function buildCycloneDxComponents(inventory: Pick<CbomResponse, "algorithms" | "keys" | "protocols" | "certificates">, assetName?: string) {
  const algorithms = inventory.algorithms.map((row, index) => algorithmComponent(row, index, assetName));
  const keys = inventory.keys.map((row, index) => ({
    type: "cryptographic-asset",
    name: row.name,
    "bom-ref": `crypto-key-${slug(row.name)}-${index}`,
    cryptoProperties: {
      assetType: "related-crypto-material",
      relatedCryptoMaterialProperties: {
        type: "public-key",
        ...(reported(row.id) ? { id: row.id } : {}),
        ...(parseInteger(row.size) !== null ? { size: parseInteger(row.size) } : {}),
        ...(reported(row.state) && ["pre-activation", "active", "suspended", "deactivated", "compromised", "destroyed"].includes(row.state)
          ? { state: row.state }
          : {}),
      },
    },
    properties: [
      { name: "quantwarden:cert-in:asset-type", value: row.assetType },
      ...(assetName ? [{ name: "quantwarden:observed-asset", value: assetName }] : []),
    ],
  }));
  const protocols = inventory.protocols.map((row, index) => ({
    type: "cryptographic-asset",
    name: `${row.name} ${row.version}`,
    "bom-ref": `crypto-protocol-${slug(`${row.name}-${row.version}`)}-${index}`,
    cryptoProperties: {
      assetType: "protocol",
      protocolProperties: {
        type: "tls",
        ...(reported(row.version) ? { version: row.version } : {}),
        ...(reported(row.cipherSuites)
          ? { cipherSuites: row.cipherSuites.split(",").map((name) => ({ name: name.trim() })).filter((item) => item.name) }
          : {}),
      },
      ...(reported(row.oid) ? { oid: row.oid } : {}),
    },
    properties: [
      { name: "quantwarden:cert-in:asset-type", value: row.assetType },
      ...(assetName ? [{ name: "quantwarden:observed-asset", value: assetName }] : []),
    ],
  }));
  const certificates = inventory.certificates.map((row, index) => {
    const subjectName = [row.subjectCN, row.subjectO, row.subjectC].filter(reported).join(", ");
    const issuerName = [row.issuerCN, row.issuerO, row.issuerC].filter(reported).join(", ");
    return {
      type: "cryptographic-asset",
      name: row.name,
      "bom-ref": `crypto-certificate-${slug(row.name)}-${index}`,
      cryptoProperties: {
        assetType: "certificate",
        certificateProperties: {
          ...(subjectName ? { subjectName } : {}),
          ...(issuerName ? { issuerName } : {}),
          ...(reported(row.notValidBefore) ? { notValidBefore: row.notValidBefore } : {}),
          ...(reported(row.notValidAfter) ? { notValidAfter: row.notValidAfter } : {}),
          ...(reported(row.certificateFormat) ? { certificateFormat: row.certificateFormat } : {}),
          ...(reported(row.certificateExtension) ? { certificateExtension: row.certificateExtension } : {}),
        },
      },
      properties: [
        { name: "quantwarden:cert-in:asset-type", value: row.assetType },
        { name: "quantwarden:cert-in:signature-algorithm", value: row.signatureAlgorithmReference },
        { name: "quantwarden:cert-in:subject-public-key", value: row.subjectPublicKeyReference },
        ...(assetName ? [{ name: "quantwarden:observed-asset", value: assetName }] : []),
      ],
    };
  });

  return [...algorithms, ...keys, ...protocols, ...certificates];
}

export function buildCycloneDxCbom(data: CbomResponse, serialUuid: string, asset?: CbomAssetDetail) {
  const inventory = asset || data;
  const assetName = asset?.assetName;
  return {
    $schema: `https://cyclonedx.org/schema/bom-${CYCLONEDX_CBOM_SPEC_VERSION}.schema.json`,
    bomFormat: "CycloneDX",
    specVersion: CYCLONEDX_CBOM_SPEC_VERSION,
    serialNumber: `urn:uuid:${serialUuid}`,
    version: 1,
    metadata: {
      timestamp: data.generatedAt,
      lifecycles: [{ phase: "operations" }],
      tools: { components: [{ type: "application", name: "QuantWarden", version: "1" }] },
      properties: [
        { name: "quantwarden:inventory-profile", value: asset ? "per-asset CBOM" : "organization CBOM" },
        { name: "quantwarden:cert-in-guideline", value: "Technical Guidelines on SBOM, QBOM & CBOM, AIBOM and HBOM v2.0" },
        ...(asset ? [{ name: "quantwarden:asset-id", value: asset.assetId }] : []),
      ],
    },
    components: buildCycloneDxComponents(inventory, assetName),
  };
}

export function buildSpdxInteropDocument(data: CbomResponse, namespaceUuid: string) {
  const components = buildCycloneDxComponents(data);
  const packages = components.map((component, index) => ({
    SPDXID: `SPDXRef-CryptoAsset-${index + 1}`,
    name: component.name,
    versionInfo: "observed",
    downloadLocation: "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: "NOASSERTION",
    copyrightText: "NOASSERTION",
    primaryPackagePurpose: "OTHER",
    comment: JSON.stringify(component.cryptoProperties),
  }));

  return {
    spdxVersion: SPDX_INTEROP_SPEC_VERSION,
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: "QuantWarden cryptographic inventory interoperability export",
    documentNamespace: `https://quantwarden.local/spdxdocs/${namespaceUuid}`,
    creationInfo: {
      created: data.generatedAt,
      creators: ["Tool: QuantWarden"],
      licenseListVersion: "3.27.0",
    },
    documentDescribes: packages.map((item) => item.SPDXID),
    packages,
    comment: "SPDX 2.3 does not define native CBOM cryptographic-asset classes. Cryptographic properties are retained in package comments for interoperability; use the CycloneDX 1.6 export for standards-native CBOM semantics.",
  };
}

export function buildPerAssetCbomExport(data: CbomResponse) {
  return {
    exportFormat: "QuantWarden per-asset CBOM collection",
    exportVersion: "1.0",
    generatedAt: data.generatedAt,
    standard: {
      name: "CycloneDX",
      specVersion: CYCLONEDX_CBOM_SPEC_VERSION,
      schema: `https://cyclonedx.org/schema/bom-${CYCLONEDX_CBOM_SPEC_VERSION}.schema.json`,
    },
    assets: data.assets.map((asset) => ({
      asset: {
        id: asset.assetId,
        name: asset.assetName,
        type: asset.assetType,
        endpoints: asset.endpoints,
      },
      cbom: buildCycloneDxCbom(data, crypto.randomUUID(), asset),
    })),
  };
}
