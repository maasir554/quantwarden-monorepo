type AlgorithmRow = {
  cryptographicAssetType: string;
  name: string;
  assetType: string;
  primitive: string;
  mode: string;
  cryptoFunctions: string;
  classicalSecurityLevel: string;
  oid: string;
  list: string;
};

const algorithmRows: AlgorithmRow[] = [
  {
    cryptographicAssetType: "Algorithms",
    name: "AES-128-GCM",
    assetType: "algorithm",
    primitive: "encryption",
    mode: "gcm",
    cryptoFunctions: "key generation, encryption, decryption, tag generation",
    classicalSecurityLevel: "128 bits",
    oid: "2.16.840.1.101.3.4.1.6",
    list: "TLS 1.2, TLS 1.3, web gateways, API edge proxies",
  },
  {
    cryptographicAssetType: "Algorithms",
    name: "AES-256-GCM",
    assetType: "algorithm",
    primitive: "encryption",
    mode: "gcm",
    cryptoFunctions: "key generation, encryption, decryption, tag generation",
    classicalSecurityLevel: "256 bits",
    oid: "2.16.840.1.101.3.4.1.46",
    list: "HSM-backed data stores, secure backups, VPN tunnels",
  },
  {
    cryptographicAssetType: "Algorithms",
    name: "SHA512withRSA",
    assetType: "algorithm",
    primitive: "signature",
    mode: "pkcs1v1.5",
    cryptoFunctions: "hashing, signing, signature verification",
    classicalSecurityLevel: "~128 bits (with RSA-3072)",
    oid: "1.2.840.113549.1.1.13",
    list: "code signing, document signing, TLS certificate signatures",
  },
  {
    cryptographicAssetType: "Algorithms",
    name: "ECDHE",
    assetType: "algorithm",
    primitive: "key exchange",
    mode: "ephemeral",
    cryptoFunctions: "ephemeral key agreement, forward secrecy",
    classicalSecurityLevel: "128 bits (P-256)",
    oid: "1.3.132.1.12",
    list: "TLS 1.2/1.3 handshakes, mTLS service mesh",
  },
  {
    cryptographicAssetType: "Algorithms",
    name: "ChaCha20-Poly1305",
    assetType: "algorithm",
    primitive: "authenticated encryption",
    mode: "aead",
    cryptoFunctions: "stream encryption, integrity protection, tag verification",
    classicalSecurityLevel: "256 bits",
    oid: "1.3.6.1.4.1.11591.15.1",
    list: "mobile TLS sessions, constrained devices, low-latency APIs",
  },
];

export default function CbomExplorerAlgorithmsPage() {
  const exportHref = `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(algorithmRows, null, 2)
  )}`;

  return (
    <div className="h-full">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Algorithms</h3>
          <p className="mt-1 text-xs text-slate-400">
            Element-wise algorithm inventory based on the CBOM blueprint.
          </p>
        </div>
        <a
          href={exportHref}
          download="cbom-algorithms.json"
          className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
        >
          Export to JSON
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="cbom-explorer-table min-w-325 w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-slate-950/40 text-slate-300 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2.5">Cryptographic Asset Type</th>
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Asset Type</th>
              <th className="px-3 py-2.5">Primitive</th>
              <th className="px-3 py-2.5">Mode</th>
              <th className="px-3 py-2.5">Crypto Functions</th>
              <th className="px-3 py-2.5">Classical Security Level</th>
              <th className="px-3 py-2.5">OID</th>
              <th className="px-3 py-2.5">List</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {algorithmRows.map((row) => (
              <tr key={`${row.name}-${row.oid}`} className="cbom-explorer-row hover:bg-white/3 align-top">
                <td className="px-3 py-3 text-slate-300">{row.cryptographicAssetType}</td>
                <td className="px-3 py-3 font-medium text-slate-100 whitespace-nowrap">{row.name}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.assetType}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.primitive}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.mode}</td>
                <td className="px-3 py-3">{row.cryptoFunctions}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.classicalSecurityLevel}</td>
                <td className="px-3 py-3 font-mono text-[11px] whitespace-nowrap">{row.oid}</td>
                <td className="px-3 py-3">{row.list}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
