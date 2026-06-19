type CertificateRow = {
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

const certificateRows: CertificateRow[] = [
  {
    cryptographicAssetType: "Certificates",
    name: "netbanking.pnb.co.in TLS Certificate",
    assetType: "certificate",
    subjectC: "IN",
    subjectCN: "netbanking.pnb.co.in",
    subjectO: "Punjab National Bank",
    issuerC: "US",
    issuerCN: "DigiCert TLS RSA SHA256 2020 CA1",
    issuerO: "DigiCert Inc",
    notValidBefore: "2025-02-10T00:00:00Z",
    notValidAfter: "2026-02-09T23:59:59Z",
    signatureAlgorithmReference: "sha256WithRSAEncryption (OID 1.2.840.113549.1.1.11)",
    subjectPublicKeyReference: "RSA 2048-bit / key-id: SPK-9f0a77e2",
    certificateFormat: "X.509 v3",
    certificateExtension: ".crt",
  },
  {
    cryptographicAssetType: "Certificates",
    name: "api.pnb.co.in mTLS Service Certificate",
    assetType: "certificate",
    subjectC: "IN",
    subjectCN: "api.pnb.co.in",
    subjectO: "Punjab National Bank",
    issuerC: "US",
    issuerCN: "Let's Encrypt R11",
    issuerO: "Let's Encrypt",
    notValidBefore: "2025-05-04T11:35:21Z",
    notValidAfter: "2025-08-02T11:35:20Z",
    signatureAlgorithmReference: "ecdsa-with-SHA256 (OID 1.2.840.10045.4.3.2)",
    subjectPublicKeyReference: "ECDSA P-256 / key-id: SPK-7c4d02af",
    certificateFormat: "X.509 v3",
    certificateExtension: ".pem",
  },
  {
    cryptographicAssetType: "Certificates",
    name: "payments.pnb.co.in Legacy Certificate",
    assetType: "certificate",
    subjectC: "IN",
    subjectCN: "payments.pnb.co.in",
    subjectO: "Punjab National Bank",
    issuerC: "GB",
    issuerCN: "COMODO RSA Domain Validation Secure Server CA",
    issuerO: "COMODO CA Ltd",
    notValidBefore: "2023-07-15T09:00:00Z",
    notValidAfter: "2025-07-14T08:59:59Z",
    signatureAlgorithmReference: "sha1WithRSAEncryption (OID 1.2.840.113549.1.1.5)",
    subjectPublicKeyReference: "RSA 1024-bit / key-id: SPK-0bc1de44",
    certificateFormat: "X.509 v3",
    certificateExtension: ".cer",
  },
  {
    cryptographicAssetType: "Certificates",
    name: "vpn.pnb.co.in Gateway Certificate",
    assetType: "certificate",
    subjectC: "IN",
    subjectCN: "vpn.pnb.co.in",
    subjectO: "Punjab National Bank",
    issuerC: "BE",
    issuerCN: "GlobalSign RSA OV SSL CA 2018",
    issuerO: "GlobalSign nv-sa",
    notValidBefore: "2024-11-21T05:12:44Z",
    notValidAfter: "2026-11-21T05:12:43Z",
    signatureAlgorithmReference: "sha384WithRSAEncryption (OID 1.2.840.113549.1.1.12)",
    subjectPublicKeyReference: "RSA 4096-bit / key-id: SPK-ae913bd8",
    certificateFormat: "X.509 v3",
    certificateExtension: ".crt",
  },
  {
    cryptographicAssetType: "Certificates",
    name: "cdn.pnb.co.in Edge Certificate",
    assetType: "certificate",
    subjectC: "IN",
    subjectCN: "cdn.pnb.co.in",
    subjectO: "Punjab National Bank",
    issuerC: "US",
    issuerCN: "Thawte TLS ECC SHA256 2020 CA1",
    issuerO: "Thawte",
    notValidBefore: "2025-01-29T14:02:10Z",
    notValidAfter: "2026-01-29T14:02:09Z",
    signatureAlgorithmReference: "ecdsa-with-SHA384 (OID 1.2.840.10045.4.3.3)",
    subjectPublicKeyReference: "ECDSA P-384 / key-id: SPK-d2f3a1b9",
    certificateFormat: "X.509 v3",
    certificateExtension: ".pem",
  },
];

export default function CbomExplorerCertificatesPage() {
  const exportHref = `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(certificateRows, null, 2)
  )}`;

  return (
    <div className="h-full">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Certificates</h3>
          <p className="mt-1 text-xs text-slate-400">
            Element-wise certificate inventory based on the CBOM blueprint.
          </p>
        </div>
        <a
          href={exportHref}
          download="cbom-certificates.json"
          className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
        >
          Export to JSON
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="cbom-explorer-table cbom-explorer-table-grid min-w-400 w-full border-collapse text-left text-xs">
          <thead className="border-b border-white/10 bg-slate-950/40 text-slate-300 uppercase tracking-wide">
            <tr>
              <th rowSpan={2} className="px-3 py-2.5">Cryptographic Asset Type</th>
              <th rowSpan={2} className="px-3 py-2.5">Name</th>
              <th rowSpan={2} className="px-3 py-2.5">Asset Type</th>
              <th colSpan={3} className="px-3 py-2.5 text-center">Subject Name</th>
              <th colSpan={3} className="px-3 py-2.5 text-center">Issuer Name</th>
              <th rowSpan={2} className="px-3 py-2.5">Not Valid Before</th>
              <th rowSpan={2} className="px-3 py-2.5">Not Valid After</th>
              <th rowSpan={2} className="px-3 py-2.5">Signature Algorithm Reference</th>
              <th rowSpan={2} className="px-3 py-2.5">Subject Public Key Reference</th>
              <th rowSpan={2} className="px-3 py-2.5">Certificate Format</th>
              <th rowSpan={2} className="px-3 py-2.5">Certificate Extension</th>
            </tr>
            <tr>
              <th className="px-3 py-2.5 text-center">C</th>
              <th className="px-3 py-2.5 text-center">CN</th>
              <th className="px-3 py-2.5 text-center">O</th>
              <th className="px-3 py-2.5 text-center">C</th>
              <th className="px-3 py-2.5 text-center">CN</th>
              <th className="px-3 py-2.5 text-center">O</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {certificateRows.map((row) => (
              <tr key={row.name} className="cbom-explorer-row hover:bg-white/3 align-top">
                <td className="px-3 py-3 text-slate-300">{row.cryptographicAssetType}</td>
                <td className="px-3 py-3 font-medium text-slate-100 whitespace-nowrap">{row.name}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.assetType}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.subjectC}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.subjectCN}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.subjectO}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.issuerC}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.issuerCN}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.issuerO}</td>
                <td className="px-3 py-3 font-mono text-[11px] whitespace-nowrap">{row.notValidBefore}</td>
                <td className="px-3 py-3 font-mono text-[11px] whitespace-nowrap">{row.notValidAfter}</td>
                <td className="px-3 py-3">{row.signatureAlgorithmReference}</td>
                <td className="px-3 py-3">{row.subjectPublicKeyReference}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.certificateFormat}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.certificateExtension}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
