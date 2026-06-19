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
  {
    bucket: "API",
    patterns: [/\bapi\b/i, /^api/i, /api$/i, /apim/i, /restapi/i, /webapi/i, /mvcapi/i, /services?/i],
  },
  {
    bucket: "Mobile Apps",
    patterns: [/mobile/i, /\bmob/i, /mobapps/i, /yono/i, /mbs/i, /appmbs/i, /apimbs/i],
  },
  {
    bucket: "Internet Banking",
    patterns: [/banking/i, /ibanking/i, /netbank/i, /icorp/i, /corpmbs/i, /retmbs/i, /iretail/i, /retail/i, /digitalbanking/i],
  },
  {
    bucket: "Payments",
    patterns: [/pay/i, /payment/i, /upi/i, /imps/i, /bbps/i, /fastag/i, /netc/i, /npci/i, /mandate/i, /fee/i],
  },
  {
    bucket: "Cards & Loans",
    patterns: [/creditcard/i, /card/i, /loan/i, /lending/i, /kcc/i, /home/i, /goldloan/i, /tractor/i],
  },
  {
    bucket: "Identity & KYC",
    patterns: [/kyc/i, /vkyc/i, /ckyc/i, /rekyc/i, /\biam\b/i, /sso/i, /rsso/i, /auth/i, /login/i],
  },
  {
    bucket: "Admin & Internal",
    patterns: [/admin/i, /portal/i, /hrms/i, /mdm/i, /crm/i, /monitor/i, /\bnms\b/i, /dashboard/i, /kibana/i, /harbor/i, /minio/i, /private/i, /\bprd\b/i, /\bdr\b/i, /\buat\b/i, /preprod/i, /\bint\b/i, /smartit/i, /support/i],
  },
  {
    bucket: "Email & Collaboration",
    patterns: [/email/i, /smtp/i, /mail/i, /meet/i, /collab/i, /share/i],
  },
  {
    bucket: "Data & Analytics",
    patterns: [/analytics/i, /data/i, /agg/i, /insight/i, /report/i, /bureau/i, /pfms/i, /ifms/i],
  },
  {
    bucket: "Public Web",
    patterns: [/^www$/i, /^web/i, /webapps/i, /apps/i, /application/i, /apply/i, /locate/i, /join/i],
  },
];

export function normalizeAssetBucket(value: unknown) {
  if (typeof value !== "string") return DEFAULT_ASSET_BUCKET;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || DEFAULT_ASSET_BUCKET;
}

export function inferAssetBucket(assetValue: string) {
  const hostname = assetValue.trim().toLowerCase();
  const labels = hostname.split(".").filter(Boolean);
  const searchableLabels = labels.slice(0, Math.max(1, labels.length - 2));
  const searchable = searchableLabels
    .flatMap((label) => [label, ...label.split(/[-_]/g)])
    .filter(Boolean)
    .join(" ");

  for (const rule of BUCKET_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(searchable))) {
      return rule.bucket;
    }
  }

  return DEFAULT_ASSET_BUCKET;
}

export function buildAssetBucketOptions(assets: Array<{ bucket?: string | null; value?: string | null }>) {
  const bucketSet = new Set<string>(PREDEFINED_ASSET_BUCKETS);

  for (const asset of assets) {
    bucketSet.add(normalizeAssetBucket(asset.bucket || inferAssetBucket(asset.value || "")));
  }

  return Array.from(bucketSet).sort((left, right) => {
    if (left === DEFAULT_ASSET_BUCKET) return 1;
    if (right === DEFAULT_ASSET_BUCKET) return -1;
    return left.localeCompare(right);
  });
}
