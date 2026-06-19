"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Download,
  Filter,
  Search,
  SortAsc,
} from "lucide-react";

const allRows = [
  { asset: "netbanking.pnb.co.in",       url: "https://netbanking.pnb.co.in",       ip: "103.109.225.12",  owner: "Retail Banking IT",    type: "Web App",     risk: "High",     cert: "26 days",  status: "Monitored",  algo: "RSA-2048"    },
  { asset: "api.pnb.co.in",              url: "https://api.pnb.co.in",              ip: "103.109.225.77",  owner: "API Services Team",    type: "API Server",  risk: "Medium",   cert: "74 days",  status: "Monitored",  algo: "ECDHE-RSA"   },
  { asset: "payments.pnb.co.in",         url: "https://payments.pnb.co.in",         ip: "103.186.238.44",  owner: "Payments Division",    type: "Gateway",     risk: "Critical", cert: "9 days",   status: "Escalated",  algo: "RSA-1024"    },
  { asset: "trade.pnb.co.in",            url: "https://trade.pnb.co.in",            ip: "103.109.224.191", owner: "Treasury & Markets",   type: "Web App",     risk: "Low",      cert: "122 days", status: "Monitored",  algo: "ECDHE-RSA"   },
  { asset: "auth.pnb.co.in",             url: "https://auth.pnb.co.in",             ip: "103.177.168.201", owner: "Identity & Access",    type: "API Server",  risk: "High",     cert: "34 days",  status: "Mitigating", algo: "RSA-2048"    },
  { asset: "vault.pnb.co.in",            url: "https://vault.pnb.co.in",            ip: "103.109.225.128", owner: "Cybersecurity Ops",    type: "Infra",       risk: "Medium",   cert: "58 days",  status: "Monitored",  algo: "AES-256"     },
  { asset: "kyc.pnb.co.in",              url: "https://kyc.pnb.co.in",              ip: "103.109.225.201", owner: "Compliance & AML",     type: "API Server",  risk: "High",     cert: "41 days",  status: "Mitigating", algo: "RSA-2048"    },
  { asset: "docs.pnb.co.in",             url: "https://docs.pnb.co.in",             ip: "103.109.224.100", owner: "IT Infrastructure",    type: "Web App",     risk: "Low",      cert: "183 days", status: "Monitored",  algo: "ECDHE-RSA"   },
  { asset: "mail.pnb.co.in",             url: "https://mail.pnb.co.in",             ip: "103.186.238.20",  owner: "Corporate Messaging",  type: "Mail/Infra",  risk: "Medium",   cert: "67 days",  status: "Monitored",  algo: "TLS-RSA"     },
  { asset: "cdn.pnb.co.in",              url: "https://cdn.pnb.co.in",              ip: "103.177.168.44",  owner: "Platform Engineering", type: "Gateway",     risk: "Low",      cert: "211 days", status: "Monitored",  algo: "ECDHE-RSA"   },
  { asset: "corebanking.pnb.co.in",      url: "https://corebanking.pnb.co.in",      ip: "10.0.4.15",       owner: "Core Banking Systems", type: "Infra",       risk: "Critical", cert: "4 days",   status: "Escalated",  algo: "DES-CBC"     },
  { asset: "pnbone.pnb.co.in",           url: "https://pnbone.pnb.co.in",           ip: "103.109.224.249", owner: "Mobile Banking Team",  type: "API Server",  risk: "Medium",   cert: "91 days",  status: "Monitored",  algo: "ECDHE-RSA"   },
];

function riskPillColor(risk: string) {
  if (risk === "Critical") return "bg-rose-500/20 text-rose-200 border-rose-400/30";
  if (risk === "High") return "bg-amber-500/20 text-amber-100 border-amber-400/30";
  if (risk === "Medium") return "bg-cyan-500/20 text-cyan-100 border-cyan-400/30";
  return "bg-emerald-500/20 text-emerald-100 border-emerald-400/30";
}

function statusColor(status: string) {
  if (status === "Escalated") return "text-rose-300";
  if (status === "Mitigating") return "text-amber-300";
  return "text-emerald-300";
}

const riskFilters = ["All", "Critical", "High", "Medium", "Low"];

export default function AssetInventory() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");

  const filtered = allRows.filter((row) => {
    const matchSearch =
      row.asset.toLowerCase().includes(search.toLowerCase()) ||
      row.owner.toLowerCase().includes(search.toLowerCase()) ||
      row.ip.includes(search);
    const matchRisk = riskFilter === "All" || row.risk === riskFilter;
    return matchSearch && matchRisk;
  });

  const critical = allRows.filter((r) => r.risk === "Critical").length;
  const expiring = allRows.filter((r) => parseInt(r.cert) <= 30).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Assets", value: allRows.length, color: "text-cyan-300" },
          { label: "Critical Risk", value: critical, color: "text-rose-300" },
          { label: "Expiring ≤ 30d", value: expiring, color: "text-amber-300" },
          { label: "Monitored", value: allRows.filter((r) => r.status === "Monitored").length, color: "text-emerald-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-slate-900/65 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search asset, owner or IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-2 pl-9 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/80 p-1">
          <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
          {riskFilters.map((f) => (
            <button
              key={f}
              onClick={() => setRiskFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                riskFilter === f ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-medium text-slate-200">
            Asset Inventory
            <span className="ml-2 text-xs text-slate-500">({filtered.length} assets)</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            {expiring} assets approaching TLS expiry
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/5 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {["Asset Name", "URL", "IP Address", "Owner", "Type", "Risk", "Cert Expiry", "Cipher", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {h} <SortAsc className="h-3 w-3 opacity-40" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((row) => (
                <tr key={row.asset} className="hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-100">{row.asset}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-cyan-200 text-xs">{row.url}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300 font-mono text-xs">{row.ip}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">{row.owner}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400 text-xs">{row.type}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${riskPillColor(row.risk)}`}>
                      {row.risk}
                    </span>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-sm font-medium ${parseInt(row.cert) <= 30 ? "text-rose-300" : "text-slate-300"}`}>
                    {row.cert}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400 text-xs font-mono">{row.algo}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-xs font-medium ${statusColor(row.status)}`}>
                    {row.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
