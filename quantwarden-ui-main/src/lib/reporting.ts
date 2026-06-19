export type ReportSectionKey =
  | "executiveSummary"
  | "securityOverview"
  | "pqcPosture"
  | "tierMethodology"
  | "tierDistribution"
  | "tierAssets"
  | "pqcSupport"
  | "immediateAttention";

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
    label: "Tier distribution",
    helper: "Color-coded asset distribution across PQC tiers with infographic bars and percentages.",
  },
  {
    key: "tierAssets",
    label: "Assets by tier",
    helper: "Top 5 assets for each populated tier, followed by the matching Asset Explorer filter link.",
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
    description: "Rewards TLS 1.3, gives partial credit to TLS 1.2, and penalizes deprecated protocol exposure.",
  },
  {
    label: "Authentication and certificate strength",
    weight: "10 points",
    description: "Rewards ECDSA/EdDSA and strong RSA while reducing confidence for weaker certificate posture.",
  },
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
