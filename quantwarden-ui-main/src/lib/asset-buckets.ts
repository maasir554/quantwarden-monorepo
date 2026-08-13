export const DEFAULT_ASSET_BUCKET = "General";

export const PREDEFINED_ASSET_BUCKETS = [
  "API",
  "Mobile Apps",
  "Internet Banking",
  "Payments",
  "Cards & Loans",
  "Identity & KYC",
  "Admin & Internal",
  "Email & Collaboration",
  "Data & Analytics",
  "Public Web",
  DEFAULT_ASSET_BUCKET,
] as const;

const BUCKET_RULES: Array<{ bucket: string; patterns: RegExp[] }> = [
  { bucket: "API", patterns: [/^api$/i, /^api[-_]/i, /[-_]api$/i, /^apim/i, /rest[-_]?api/i, /web[-_]?api/i, /service(s)?/i] },
  { bucket: "Mobile Apps", patterns: [/mobile/i, /^mob([_-]|$)/i, /mobapps/i, /yono/i, /(^|[-_])mbs($|[-_])/i, /appmbs/i, /apimbs/i] },
  { bucket: "Internet Banking", patterns: [/banking/i, /ibanking/i, /netbank/i, /icorp/i, /corpmbs/i, /retmbs/i, /iretail/i, /retail/i, /digital[-_]?bank/i] },
  { bucket: "Payments", patterns: [/(^|[-_])pay(ment|ments)?($|[-_])/i, /(^|[-_])upi($|[-_])/i, /imps/i, /bbps/i, /fastag/i, /(^|[-_])netc($|[-_])/i, /npci/i, /mandate/i, /(^|[-_])fee(s)?($|[-_])/i] },
  { bucket: "Cards & Loans", patterns: [/credit[-_]?card/i, /(^|[-_])cards?($|[-_])/i, /loan/i, /lending/i, /(^|[-_])kcc($|[-_])/i, /gold[-_]?loan/i, /tractor/i] },
  { bucket: "Identity & KYC", patterns: [/kyc/i, /vkyc/i, /ckyc/i, /rekyc/i, /(^|[-_])iam($|[-_])/i, /sso/i, /auth/i, /login/i] },
  { bucket: "Admin & Internal", patterns: [/admin/i, /portal/i, /hrms/i, /(^|[-_])mdm($|[-_])/i, /(^|[-_])crm($|[-_])/i, /monitor/i, /(^|[-_])nms($|[-_])/i, /dashboard/i, /kibana/i, /harbor/i, /minio/i, /private/i, /(^|[-_])(prd|dr|uat|int)($|[-_])/i, /preprod/i, /smartit/i, /support/i] },
  { bucket: "Email & Collaboration", patterns: [/email/i, /smtp/i, /mail/i, /meet/i, /collab/i, /share/i] },
  { bucket: "Data & Analytics", patterns: [/analytics/i, /(^|[-_])data($|[-_])/i, /(^|[-_])agg($|[-_])/i, /insight/i, /report/i, /bureau/i, /pfms/i, /ifms/i] },
  { bucket: "Public Web", patterns: [/^www$/i, /^web([_-]|$)/i, /webapps/i, /(^|[-_])apps?($|[-_])/i, /application/i, /apply/i, /locate/i, /join/i] },
];

export function normalizeAssetBucket(value: unknown) {
  if (typeof value !== "string") return DEFAULT_ASSET_BUCKET;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || DEFAULT_ASSET_BUCKET;
}

export function inferAssetBuckets(assetValue: string) {
  const labels = assetValue.trim().toLowerCase().split(".").filter(Boolean);
  const searchableParts = labels
    .slice(0, Math.max(1, labels.length - 2))
    .flatMap((label) => [label, ...label.split(/[-_]/g)])
    .filter(Boolean);
  const matches = BUCKET_RULES
    .filter((rule) => searchableParts.some((part) => rule.patterns.some((pattern) => pattern.test(part))))
    .map((rule) => rule.bucket);

  return matches.length > 0 ? Array.from(new Set(matches)).slice(0, 4) : [DEFAULT_ASSET_BUCKET];
}

export function inferAssetBucket(assetValue: string) {
  return inferAssetBuckets(assetValue)[0] || DEFAULT_ASSET_BUCKET;
}

export function normalizeAssetBuckets(value: unknown, assetValue = "") {
  let candidates: unknown[] = [];
  if (Array.isArray(value)) candidates = value;
  else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      candidates = Array.isArray(parsed) ? parsed : [value];
    } catch {
      candidates = value.split(",");
    }
  }

  const normalized = Array.from(new Set(candidates.map(normalizeAssetBucket).filter(Boolean)));
  if (normalized.length === 0 || (normalized.length === 1 && normalized[0] === DEFAULT_ASSET_BUCKET && assetValue)) {
    return inferAssetBuckets(assetValue);
  }
  return normalized.slice(0, 8);
}

export function buildAssetBucketOptions(assets: Array<{ bucket?: string | null; buckets?: string[] | string | null; value?: string | null }>) {
  const bucketSet = new Set<string>(PREDEFINED_ASSET_BUCKETS);
  for (const asset of assets) {
    normalizeAssetBuckets(asset.buckets || asset.bucket, asset.value || "").forEach((bucket) => bucketSet.add(bucket));
  }
  return Array.from(bucketSet).sort((left, right) => {
    if (left === DEFAULT_ASSET_BUCKET) return 1;
    if (right === DEFAULT_ASSET_BUCKET) return -1;
    return left.localeCompare(right);
  });
}
