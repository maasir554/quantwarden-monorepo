export type ReportSectionKey =
  | "executiveSummary"
  | "securityOverview"
  | "pqcPosture"
  | "tierMethodology"
  | "tierDistribution"
  | "tierAssets"
  | "pqcSupport"
  | "immediateAttention"
  | "suggestedChanges";

export type ReportTier = "A" | "B" | "C" | "D" | "F";

export type ReportTone = "emerald" | "blue" | "amber" | "red";

export interface ReportMetricCard {
  key: string;
  label: string;
  helper: string;
  value: number;
  tone: ReportTone;
}

export interface ReportAssetEntry {
  id: string;
  value: string;
  averageScore: number;
  tier: ReportTier;
  status: string;
  portCount: number;
  primaryKeyExchange: string | null;
  primaryEncryption: string | null;
  supportsPqc: boolean;
  negotiatedPqc: boolean;
}

export interface ReportTierBucket {
  tier: ReportTier;
  label: string;
  status: string;
  count: number;
  percent: number;
  assets: ReportAssetEntry[];
}

export interface ReportSupportBucket {
  key: "supported" | "unsupported";
  label: string;
  description: string;
  count: number;
  percent: number;
  negotiatedCount: number;
  assets: ReportAssetEntry[];
}

export interface ReportImmediateAttentionAsset {
  id: string;
  name: string;
  issue: string;
}

export interface ReportImmediateAttentionBucket {
  key: "dns" | "certificate" | "tls";
  label: string;
  description: string;
  tone: ReportTone;
  count: number;
  assets: ReportImmediateAttentionAsset[];
}

export interface ReportSuggestedChange {
  assetId: string;
  assetName: string;
  port: string;
  findings: Array<{ label: string; value: string }>;
  actions: string[];
}

export interface OrganizationReportPayload {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  generatedAt: string;
  summaryHighlights: string[];
  coverage: {
    totalAssets: number;
    totalScannedEndpoints: number;
    reachableTlsEndpoints: number;
    totalAssetsScored: number;
    totalPortsScored: number;
  };
  overview: {
    metrics: ReportMetricCard[];
    tlsVersionMix: Array<{ name: string; value: number }>;
    certificateHealth: Array<{ label: string; value: number; tone: ReportTone }>;
    strongCipherCount: number;
    weakCipherCount: number;
    selfSignedCount: number;
    tlsDowngradeVulnerable: number;
  };
  pqc: {
    averageScore: number;
    tier: ReportTier | "Pending";
    status: string;
    totalAssetsScored: number;
    totalPortsScored: number;
  };
  tierDistribution: ReportTierBucket[];
  pqcSupport: ReportSupportBucket[];
  immediateAttention: ReportImmediateAttentionBucket[];
  suggestedChanges: ReportSuggestedChange[];
  assets: ReportAssetEntry[];
}

export const REPORT_SECTION_META: Array<{
  key: ReportSectionKey;
  label: string;
  helper: string;
}> = [
  {
    key: "executiveSummary",
    label: "Executive summary",
    helper: "Cover page with the report heading, posture headline, coverage, and key findings.",
  },
  {
    key: "securityOverview",
    label: "Security overview",
    helper: "Formal TLS and certificate summary pulled from the latest organization scans.",
  },
  {
    key: "pqcPosture",
    label: "PQC posture",
    helper: "Organization score, readiness tier, and a meter matching the asset intelligence visual language.",
  },
  {
    key: "tierMethodology",
    label: "Tier rules and meanings",
    helper: "Brief scoring bands, tier meanings, and the PQC evaluation pillars used in the report.",
  },
  {
    key: "tierDistribution",
    label: "Tier risk overview",
    helper: "Controllable tier distribution with asset counts, exposure share, risk level, and interpretation.",
  },
  {
    key: "tierAssets",
    label: "Asset-wise risk table",
    helper: "Controllable asset table with score, tier, covered ports, and primary cryptographic evidence.",
  },
  {
    key: "pqcSupport",
    label: "PQC support split",
    helper: "Supported versus unsupported ML-KEM posture with counts, percentages, and examples.",
  },
  {
    key: "immediateAttention",
    label: "Immediate attention",
    helper: "DNS, certificate, and TLS issues that should be prioritized from the current scan set.",
  },
  {
    key: "suggestedChanges",
    label: "Suggested changes",
    helper: "Per-asset and per-port remediation guidance derived from the latest endpoint evidence.",
  },
];

export const DEFAULT_REPORT_SECTIONS: Record<ReportSectionKey, boolean> = {
  executiveSummary: true,
  securityOverview: true,
  pqcPosture: true,
  tierMethodology: false,
  tierDistribution: true,
  tierAssets: true,
  pqcSupport: true,
  immediateAttention: true,
  suggestedChanges: true,
};

export const REPORT_TIER_ORDER: ReportTier[] = ["A", "B", "C", "D", "F"];
export const REPORT_ACTION_TIER_ORDER: ReportTier[] = ["D", "C", "B", "A", "F"];

export const REPORT_TIER_BANDS: Array<{
  tier: ReportTier;
  scoreRange: string;
  meaning: string;
  guidance: string;
}> = [
  {
    tier: "A",
    scoreRange: "90-100",
    meaning: "Quantum-Safe",
    guidance: "ML-KEM is present or negotiated and the surrounding TLS posture is modern.",
  },
  {
    tier: "B",
    scoreRange: "75-89",
    meaning: "Transitional",
    guidance: "Strong posture overall, but not yet consistently negotiating the preferred post-quantum path.",
  },
  {
    tier: "C",
    scoreRange: "50-74",
    meaning: "Legacy",
    guidance: "Modern enough to function, but still relying on classical defaults or weaker cryptographic choices.",
  },
  {
    tier: "D",
    scoreRange: "0-49",
    meaning: "Vulnerable",
    guidance: "Meaningful uplift is required across key exchange, protocol version, or certificate posture.",
  },
  {
    tier: "F",
    scoreRange: "Reserved",
    meaning: "Critical/Override",
    guidance: "Reserved for future hard-fail states if reporting introduces explicit fatal override classes.",
  },
];

export const REPORT_SCORING_PILLARS: Array<{
  label: string;
  weight: string;
  description: string;
}> = [
  {
    label: "Key exchange and encapsulation",
    weight: "40 points",
    description: "Rewards ML-KEM negotiation first, then ML-KEM support, then strong classical key exchange fallback.",
  },
  {
    label: "Symmetric encryption",
    weight: "30 points",
    description: "Rewards AES-256-GCM and ChaCha20-Poly1305 ahead of AES-128 and legacy symmetric choices.",
  },
  {
    label: "Protocol version",
    weight: "20 points",
    description: "Awards 20 points for TLS 1.3 only, 5 for TLS 1.2 plus 1.3, and 0 for TLS 1.2 only; deprecated protocol exposure is penalized separately.",
  },
  {
    label: "Authentication and certificate strength",
    weight: "10 points",
    description: "Rewards ECDSA/EdDSA and strong RSA while reducing confidence for weaker certificate posture.",
  },
];

export const REPORT_SCORING_RULES: Array<{
  pillar: string;
  condition: string;
  points: string;
}> = [
  { pillar: "Key exchange", condition: "ML-KEM is negotiated by the endpoint", points: "+40" },
  { pillar: "Key exchange", condition: "ML-KEM is supported but is not the negotiated default", points: "+20" },
  { pillar: "Key exchange", condition: "Strong classical group: X25519, X448, secp384r1, or secp521r1", points: "+15" },
  { pillar: "Key exchange", condition: "Standard classical group: secp256r1 or DHE", points: "+10" },
  { pillar: "Key exchange", condition: "Legacy, missing, or unknown key exchange", points: "0" },
  { pillar: "Symmetric encryption", condition: "AES-256-GCM or ChaCha20-Poly1305 is available", points: "+30" },
  { pillar: "Symmetric encryption", condition: "AES-128-GCM is the strongest available option", points: "+15" },
  { pillar: "Symmetric encryption", condition: "Another legacy symmetric algorithm is reported", points: "+5" },
  { pillar: "Symmetric encryption", condition: "No symmetric encryption evidence is reported", points: "0" },
  { pillar: "Protocol version", condition: "TLS 1.3 only; TLS 1.2 and deprecated versions are disabled", points: "+20" },
  { pillar: "Protocol version", condition: "TLS 1.2 and TLS 1.3 are enabled", points: "+5" },
  { pillar: "Protocol version", condition: "TLS 1.3 is enabled together with deprecated TLS", points: "+5" },
  { pillar: "Protocol version", condition: "TLS 1.2 only, with no TLS 1.3 support", points: "0" },
  { pillar: "Authentication", condition: "ECDSA, EdDSA, or RSA with at least 3072 bits", points: "+10" },
  { pillar: "Authentication", condition: "RSA with at least 2048 bits but fewer than 3072 bits", points: "+5" },
  { pillar: "Authentication", condition: "Weak, missing, or unknown authentication key", points: "0" },
];

export const REPORT_SCORING_PENALTIES: Array<{
  condition: string;
  points: string;
}> = [
  { condition: "Self-signed certificate", points: "-50" },
  { condition: "TLS 1.0 or TLS 1.1 is enabled", points: "-30" },
  { condition: "RSA key is below 2048 bits", points: "-50" },
  { condition: "Certificate signature uses SHA-1 or MD5", points: "-50" },
];

export function getTierStatus(tier: ReportTier | "Pending") {
  if (tier === "A") return "Quantum-Safe";
  if (tier === "B") return "Transitional";
  if (tier === "C") return "Legacy";
  if (tier === "D" || tier === "F") return "Vulnerable";
  return "Pending";
}

export function getTierLabel(tier: ReportTier) {
  return `Tier ${tier}`;
}

export function getTierMeta(tier: ReportTier | "Pending") {
  if (tier === "A") {
    return {
      tone: "emerald" as const,
      textClass: "text-emerald-700",
      borderClass: "border-emerald-200",
      bgClass: "bg-emerald-50",
      accent: "#10b981",
      softAccent: "#d1fae5",
    };
  }
  if (tier === "B") {
    return {
      tone: "blue" as const,
      textClass: "text-blue-700",
      borderClass: "border-blue-200",
      bgClass: "bg-blue-50",
      accent: "#3b82f6",
      softAccent: "#dbeafe",
    };
  }
  if (tier === "C") {
    return {
      tone: "amber" as const,
      textClass: "text-amber-700",
      borderClass: "border-amber-200",
      bgClass: "bg-amber-50",
      accent: "#f59e0b",
      softAccent: "#fef3c7",
    };
  }
  if (tier === "D" || tier === "F") {
    return {
      tone: "red" as const,
      textClass: "text-red-700",
      borderClass: "border-red-200",
      bgClass: "bg-red-50",
      accent: "#ef4444",
      softAccent: "#fee2e2",
    };
  }
  return {
    tone: "amber" as const,
    textClass: "text-[#8a5d33]",
    borderClass: "border-amber-200",
    bgClass: "bg-[#fff7e6]",
    accent: "#8B0000",
    softAccent: "#fff1c9",
  };
}

export function getToneMeta(tone: ReportTone) {
  if (tone === "emerald") {
    return {
      textClass: "text-emerald-700",
      borderClass: "border-emerald-200",
      bgClass: "bg-emerald-50",
      accent: "#10b981",
      softAccent: "#d1fae5",
    };
  }
  if (tone === "blue") {
    return {
      textClass: "text-blue-700",
      borderClass: "border-blue-200",
      bgClass: "bg-blue-50",
      accent: "#3b82f6",
      softAccent: "#dbeafe",
    };
  }
  if (tone === "red") {
    return {
      textClass: "text-red-700",
      borderClass: "border-red-200",
      bgClass: "bg-red-50",
      accent: "#ef4444",
      softAccent: "#fee2e2",
    };
  }
  return {
    textClass: "text-amber-700",
    borderClass: "border-amber-200",
    bgClass: "bg-amber-50",
    accent: "#f59e0b",
    softAccent: "#fef3c7",
  };
}

export function getTierFromScore(score: number): ReportTier {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 50) return "C";
  return "D";
}
