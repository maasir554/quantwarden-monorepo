"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const keyLengths = [
  { key: "4096", value: 28, color: "#22d3ee" },
  { key: "3078", value: 19, color: "#34d399" },
  { key: "2048", value: 24, color: "#818cf8" },
  { key: "2044", value: 12, color: "#38bdf8" },
  { key: "1024", value: 8,  color: "#f59e0b" },
  { key: "512",  value: 2,  color: "#f43f5e" },
];

const cipherUsage = [
  { name: "ECDHE-RSA-AES256-GCM-SHA384", count: 29, color: "#22d3ee" },
  { name: "ECDHE-ECDSA-AES256-GCM-SHA384", count: 23, color: "#818cf8" },
  { name: "AES256-GCM-SHA384", count: 19, color: "#34d399" },
  { name: "AES128-GCM-SHA256", count: 15, color: "#38bdf8" },
  { name: "TLS_RSA_WITH_DES_CBC_SHA", count: 9, color: "#f43f5e" },
];

const encryptionProtocols = [
  { name: "TLS 1.3", value: 58, color: "#22d3ee" },
  { name: "TLS 1.2", value: 22, color: "#818cf8" },
  { name: "TLS 1.1", value: 12, color: "#f59e0b" },
  { name: "TLS 1.0", value: 8,  color: "#f43f5e" },
];

const topCaData = [
  { name: "DigiCert", value: 39, color: "#22d3ee" },
  { name: "Thawte",   value: 39, color: "#818cf8" },
  { name: "Let's Encrypt", value: 16, color: "#34d399" },
  { name: "COMODO",   value: 6,  color: "#38bdf8" },
];

const caTable = [
  { app: "netbanking.pnb.co.in",  keyLen: "2048-Bit", cipher: "ECDHE-RSA-AES256-GCM-SHA384", ca: "DigiCert",    risk: false },
  { app: "payments.pnb.co.in",    keyLen: "1024-Bit", cipher: "TLS_RSA_WITH_DES_CBC_SHA",    ca: "COMODO",      risk: true  },
  { app: "vpn.pnb.co.in",         keyLen: "4096-Bit", cipher: "TCSHE-RSA-AES256-GCM-SHA384", ca: "COMODO",      risk: false },
  { app: "cdn.pnb.co.in",         keyLen: "4096-Bit", cipher: "TLS_RSA_AES256_GCM_SHA384",   ca: "GlobalSign",  risk: false },
];

const topMetrics = [
  { label: "Total Applications", value: "17" },
  { label: "Sites Surveyed",     value: "56" },
  { label: "Active Certificates",value: "93" },
  { label: "Weak Cryptography",  value: "22", warn: true },
  { label: "Certificate Issues", value: "7",  warn: true },
];

type CbomProps = {
  isExplorerOpen?: boolean;
  onCloseExplorer?: () => void;
  closeExplorerHref?: string;
};

export default function Cbom({ isExplorerOpen = false, onCloseExplorer, closeExplorerHref }: CbomProps) {
  const explorerOpen = isExplorerOpen;

  if (explorerOpen) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 min-h-140">
          <div className="mb-4 flex justify-start">
            {closeExplorerHref ? (
              <Link
                href={closeExplorerHref}
                aria-label="Back"
                className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Link>
            ) : (
              <button
                onClick={onCloseExplorer}
                aria-label="Back"
                className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </button>
            )}
          </div>

          <div className="min-h-110 overflow-x-auto rounded-xl border border-dashed border-white/10" aria-label="CBOM table explorer">
            <table className="min-w-full text-left text-xs" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top metrics */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
        {topMetrics.map((m) => (
          <div key={m.label} className={`rounded-2xl border px-4 py-3 ${m.warn ? "border-rose-400/60 bg-white shadow-[0_10px_30px_rgba(244,63,94,0.12)] ring-1 ring-rose-300/35" : "border-white/10 bg-slate-900/65"}`}>
            <p className={`mb-1 text-xs ${m.warn ? "text-rose-500" : "text-slate-400"}`}>{m.label}</p>
            <p className={`text-3xl font-bold ${m.warn ? "text-rose-600" : "text-slate-100"}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Key Length Distribution */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Key Length Distribution</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={keyLengths} barSize={28}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--overview-chart-grid)" />
                <XAxis dataKey="key" stroke="var(--overview-chart-axis)" fontSize={11} tickLine={false} label={{ value: "bits", position: "insideBottom", offset: -2, fill: "var(--overview-chart-axis)", fontSize: 10 }} />
                <YAxis stroke="var(--overview-chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--overview-tooltip-bg)", border: "1px solid var(--overview-tooltip-border)", borderRadius: "10px", color: "var(--overview-tooltip-text)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {keyLengths.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Cipher Usage */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Cipher Usage</h2>
          <div className="space-y-3">
            {cipherUsage.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between mb-1">
                  <span className={`text-xs font-mono ${c.color === "#f43f5e" ? "text-rose-300" : "text-slate-300"}`}
                    style={{ fontSize: "10px" }}
                  >{c.name}</span>
                  <span className="text-xs text-slate-400 ml-2">{c.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-700/60">
                  <div className="h-2 rounded-full" style={{ width: `${(c.count / 30) * 100}%`, background: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Top Certificate Authorities Donut */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-2">Top Certificate Authorities</h2>
          <div className="h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={topCaData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} strokeWidth={2} stroke="rgba(2,6,23,0.75)">
                  {topCaData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--overview-tooltip-bg)", border: "1px solid var(--overview-tooltip-border)", borderRadius: "10px", color: "var(--overview-tooltip-text)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {topCaData.map((e) => (
              <div key={e.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                <span className="text-slate-300 truncate">{e.name}</span>
                <span className="text-slate-500 ml-auto">{e.value}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* CA Table + Encryption Protocols */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* CA Details Table */}
        <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-200">Certificate Authority Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-white/5 text-slate-400 uppercase tracking-wide">
                <tr>
                  {["Application", "Key Length", "Cipher", "Certificate Authority"].map((h) => (
                    <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {caTable.map((row, i) => (
                  <tr key={i} className={`hover:bg-white/3 ${i === 0 ? "bg-cyan-500/5" : ""}`}>
                    <td className="px-4 py-3 text-slate-100 font-medium whitespace-nowrap">{row.app}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{row.keyLen}</td>
                    <td className={`px-4 py-3 font-mono whitespace-nowrap rounded-sm ${row.risk ? "text-rose-200 bg-rose-500/10" : "text-slate-300"}`} style={{ fontSize: "10px" }}>
                      {row.cipher}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{row.ca}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Encryption Protocols */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Encryption Protocols</h2>
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={encryptionProtocols} dataKey="value" nameKey="name" innerRadius={40} outerRadius={66} strokeWidth={2} stroke="rgba(2,6,23,0.75)">
                  {encryptionProtocols.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--overview-tooltip-bg)", border: "1px solid var(--overview-tooltip-border)", borderRadius: "10px", color: "var(--overview-tooltip-text)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {encryptionProtocols.map((e) => (
              <div key={e.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                  <span className="text-slate-300">{e.name}</span>
                </div>
                <span className="text-slate-400">{e.value}%</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
