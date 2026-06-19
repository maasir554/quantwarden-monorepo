type KeyRow = {
  cryptographicAssetType: string;
  name: string;
  assetType: string;
  id: string;
  state: "active" | "revoked" | "expired" | "rotating";
  size: string;
  creationDate: string;
  activationDate: string;
};

const keyRows: KeyRow[] = [
  {
    cryptographicAssetType: "Keys",
    name: "TLS Edge Key - Gateway A",
    assetType: "key",
    id: "KEY-TLS-EDGE-00071",
    state: "active",
    size: "RSA 2048-bit",
    creationDate: "2024-08-11",
    activationDate: "2024-08-12",
  },
  {
    cryptographicAssetType: "Keys",
    name: "API mTLS Signing Key",
    assetType: "key",
    id: "KEY-MTLS-SIGN-00124",
    state: "rotating",
    size: "ECDSA P-256",
    creationDate: "2025-01-05",
    activationDate: "2025-01-09",
  },
  {
    cryptographicAssetType: "Keys",
    name: "Data Vault Key v3",
    assetType: "key",
    id: "KEY-VAULT-ENC-00033",
    state: "active",
    size: "AES 256-bit",
    creationDate: "2025-03-18",
    activationDate: "2025-03-18",
  },
  {
    cryptographicAssetType: "Keys",
    name: "Legacy Payments Cert Key",
    assetType: "key",
    id: "KEY-PAY-LEG-00009",
    state: "revoked",
    size: "RSA 1024-bit",
    creationDate: "2023-11-21",
    activationDate: "2023-11-22",
  },
  {
    cryptographicAssetType: "Keys",
    name: "Branch VPN Session Key",
    assetType: "key",
    id: "KEY-VPN-SESSION-00482",
    state: "expired",
    size: "AES 128-bit",
    creationDate: "2024-02-14",
    activationDate: "2024-02-14",
  },
  {
    cryptographicAssetType: "Keys",
    name: "HSM Root Wrap Key",
    assetType: "key",
    id: "KEY-HSM-WRAP-00001",
    state: "active",
    size: "AES 256-bit",
    creationDate: "2022-09-30",
    activationDate: "2022-10-01",
  },
];

function statePill(state: KeyRow["state"]) {
  if (state === "active") return "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";
  if (state === "rotating") return "bg-cyan-500/20 text-cyan-100 border-cyan-400/30";
  if (state === "revoked") return "bg-rose-500/20 text-rose-200 border-rose-400/30";
  return "bg-amber-500/20 text-amber-100 border-amber-400/30";
}

export default function CbomExplorerKeysPage() {
  const exportHref = `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(keyRows, null, 2)
  )}`;

  return (
    <div className="h-full">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Keys</h3>
          <p className="mt-1 text-xs text-slate-400">
            Element-wise key inventory based on the CBOM blueprint.
          </p>
        </div>
        <a
          href={exportHref}
          download="cbom-keys.json"
          className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
        >
          Export to JSON
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="cbom-explorer-table min-w-300 w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-slate-950/40 text-slate-300 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2.5">Cryptographic Asset Type</th>
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Asset Type</th>
              <th className="px-3 py-2.5">id</th>
              <th className="px-3 py-2.5">state</th>
              <th className="px-3 py-2.5">size</th>
              <th className="px-3 py-2.5">Creation Date</th>
              <th className="px-3 py-2.5">Activation Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {keyRows.map((row) => (
              <tr key={row.id} className="cbom-explorer-row hover:bg-white/3 align-top">
                <td className="px-3 py-3 text-slate-300">{row.cryptographicAssetType}</td>
                <td className="px-3 py-3 font-medium text-slate-100 whitespace-nowrap">{row.name}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.assetType}</td>
                <td className="px-3 py-3 font-mono text-[11px] whitespace-nowrap">{row.id}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${statePill(row.state)}`}>
                    {row.state}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{row.size}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.creationDate}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.activationDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
