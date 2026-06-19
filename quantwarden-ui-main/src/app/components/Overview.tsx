"use client";

import {
  Activity,
  Boxes,
  Globe,
  Server,
  ShieldAlert,
  Search,
  Cpu,
  Wifi,
  KeyRound,
  Lock,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const pqcProgress = [
  { label: "PQC Algorithm Adoption", pct: 33, color: "bg-cyan-400" },
  { label: "Key Exchange Migration", pct: 22, color: "bg-indigo-400" },
];

const cyberRatingTiers = [
  { grade: "A", tier: "Tier 1", label: "Excellent", color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-400/30" },
  { grade: "B", tier: "Tier 2", label: "Good", color: "text-cyan-300", bg: "bg-cyan-500/15 border-cyan-400/30" },
  { grade: "C", tier: "Tier 3", label: "Satisfactory", color: "text-amber-300", bg: "bg-amber-500/15 border-amber-400/30" },
  { grade: "D", tier: "Tier 4", label: "Needs Improvement", color: "text-rose-300", bg: "bg-rose-500/15 border-rose-400/30" },
];

const inventoryBreakdown = [
  { label: "SSL Certificates", value: "8,761", icon: Lock, color: "text-cyan-300" },
  { label: "Software Assets", value: "13,211", icon: Cpu, color: "text-indigo-300" },
  { label: "IoT Devices", value: "3,854", icon: Wifi, color: "text-emerald-300" },
  { label: "Login Forms", value: "1,198", icon: KeyRound, color: "text-amber-300" },
];

const discoveryBarData = [
  { name: "Domains", value: 212450 },
  { name: "Subdomains", value: 87320 },
  { name: "IPs", value: 61200 },
  { name: "Cloud", value: 13372 },
];

export default function Overview() {
  return (
    <div className="space-y-5">
      {/* Top metrics */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Total Assets Scanned", value: "1,284", delta: "+6.4%", icon: Boxes, tone: "text-cyan-300", bg: "from-cyan-500/20 to-cyan-300/5" },
          { title: "Public Web Apps", value: "412", delta: "+2.3%", icon: Globe, tone: "text-emerald-300", bg: "from-emerald-500/20 to-emerald-300/5" },
          { title: "APIs Servers Detected", value: "286", delta: "+9.1%", icon: Server, tone: "text-indigo-300", bg: "from-indigo-500/20 to-indigo-300/5" },
          { title: "Expiring Certificates", value: "57", delta: "Critical", icon: ShieldAlert, tone: "text-rose-300", bg: "from-rose-500/20 to-rose-300/5" },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.title} className="rounded-2xl border border-white/10 bg-slate-900/65 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">{metric.title}</p>
                <div className={`rounded-lg bg-linear-to-br ${metric.bg} p-2 ${metric.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className={`mt-3 text-3xl font-semibold tracking-tight ${metric.tone}`}>{metric.value}</p>
              <p className="mt-1 text-xs text-slate-400">{metric.delta} vs previous scan window</p>
            </article>
          );
        })}
      </section>

      {/* Main grid */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Asset Discovery */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-slate-100">Assets Discovery</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <p className="text-xl font-bold text-cyan-300">212,450</p>
              <p className="text-xs text-slate-400 mt-1">Domains, IPs & Subdomains</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <p className="text-xl font-bold text-indigo-300">13,372</p>
              <p className="text-xs text-slate-400 mt-1">Cloud Assets</p>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={discoveryBarData} barSize={28}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--overview-chart-grid)" />
                <XAxis dataKey="name" stroke="var(--overview-chart-axis)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--overview-chart-axis)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "var(--overview-tooltip-bg)", border: "1px solid var(--overview-tooltip-border)", borderRadius: "10px", color: "var(--overview-tooltip-text)" }}
                  formatter={(v: number) => [v.toLocaleString(), "Count"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  <Cell fill="#22d3ee" />
                  <Cell fill="#818cf8" />
                  <Cell fill="#38bdf8" />
                  <Cell fill="#34d399" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Cyber Rating */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-indigo-300" />
            <h2 className="text-sm font-semibold text-slate-100">Cyber Rating</h2>
          </div>
          <div className="space-y-3">
            {cyberRatingTiers.map((t) => (
              <div key={t.tier} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${t.bg}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-xl font-bold ${t.color}`}>{t.grade}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-100">{t.tier}</p>
                    <p className="text-xs text-slate-400">{t.label}</p>
                  </div>
                </div>
                <CheckCircle2 className={`h-4 w-4 ${t.color}`} />
              </div>
            ))}
          </div>
        </article>

        {/* Assets Inventory */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-semibold text-slate-100">Assets Inventory</h2>
          </div>
          <div className="space-y-3">
            {inventoryBreakdown.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${item.color}`} />
                    <p className="text-sm text-slate-300">{item.label}</p>
                  </div>
                  <p className={`text-lg font-semibold ${item.color}`}>{item.value}</p>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      {/* PQC Posture + CBOM */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-slate-100">Posture of PQC</h2>
            <span className="ml-auto text-xs text-slate-400">Progress on post-quantum cryptography adoption</span>
          </div>
          <div className="space-y-4">
            {pqcProgress.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between mb-1.5">
                  <p className="text-xs text-slate-300">{item.label}</p>
                  <p className="text-xs text-slate-400 font-medium">{item.pct}%</p>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-700/60">
                  <div className={`h-2.5 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="h-4 w-4 text-rose-300" />
            <h2 className="text-sm font-semibold text-slate-100">CBOM</h2>
            <span className="ml-1 text-xs text-slate-400">(Comprehensive Bill of Materials)</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Vulnerable Components", value: "8,248", color: "text-rose-300" },
              { label: "Total Applications", value: "17", color: "text-amber-300" },
              { label: "Sites Surveyed", value: "56", color: "text-cyan-300" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-center">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-slate-400 mt-1 leading-tight">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3">
            <p className="text-sm text-rose-200">8,248 vulnerable cryptographic components detected across 17 applications. Immediate review recommended.</p>
          </div>
        </article>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <p>QuantWarden | Punjab National Bank — Quantum-Proof Systems Scanner</p>
        <p>Coverage: India — 18 circles | Last intelligence sync: 2 min ago</p>
      </footer>
    </div>
  );
}
