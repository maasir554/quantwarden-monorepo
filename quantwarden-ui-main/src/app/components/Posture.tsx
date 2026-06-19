"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, XCircle, Info, User, Globe, Shield, Cpu } from "lucide-react";

const gradeData = [
  { name: "Elite", value: 37, color: "#22d3ee" },
  { name: "Critical", value: 2,  color: "#f43f5e" },
  { name: "Standard", value: 4,  color: "#818cf8" },
];

const appStatusData = [
  { name: "Elite-PQC Ready", value: 45, color: "#22d3ee" },
  { name: "Standard",        value: 30, color: "#818cf8" },
  { name: "Legacy",          value: 15, color: "#f59e0b" },
  { name: "Critical",        value: 10, color: "#f43f5e" },
];

// 4x4 risk heatmap colours: 0=safe, 1=medium, 2=high
const riskMatrix = [
  [0, 0, 1, 2],
  [0, 1, 2, 2],
  [1, 1, 2, 2],
  [1, 2, 2, 2],
];
const riskColors = {
  0: { bg: "bg-emerald-500/25 border-emerald-500/30", label: "Safe" },
  1: { bg: "bg-amber-500/25 border-amber-500/30", label: "Medium" },
  2: { bg: "bg-rose-500/25 border-rose-500/30", label: "High" },
};

const assetPqcRows = [
  { name: "netbanking.pnb.co.in (103.109.225.12)",   pqc: true  },
  { name: "auth.pnb.co.in (103.177.168.201)",        pqc: true  },
  { name: "corebanking.pnb.co.in (10.0.4.15)",       pqc: false },
  { name: "kyc.pnb.co.in (103.109.225.201)",         pqc: false },
  { name: "pnbone.pnb.co.in (103.109.224.249)",      pqc: true  },
];

const recommendations = [
  { icon: AlertTriangle, color: "text-amber-300", text: "Upgrade to TLS 1.3 with PQC" },
  { icon: Shield,        color: "text-cyan-300",  text: "Implement Kyber for Key Exchange" },
  { icon: Cpu,           color: "text-indigo-300",text: "Update Cryptographic Libraries" },
  { icon: Info,          color: "text-slate-300", text: "Develop PQC Migration Plan" },
];

const topStats = [
  { label: "Elite-PQC Ready", value: "45%", color: "text-cyan-300" },
  { label: "Standard",        value: "30%", color: "text-indigo-300" },
  { label: "Legacy",          value: "15%", color: "text-amber-300" },
  { label: "Critical Apps",   value: "8",   color: "text-rose-300" },
];

export default function Posture() {
  return (
    <div className="space-y-4">
      {/* Header stats bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {topStats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-slate-900/65 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Classification Grade Bar */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Assets by Classification Grade</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={gradeData} barSize={48}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="name" stroke="rgba(226,232,240,0.6)" fontSize={12} tickLine={false} />
                <YAxis stroke="rgba(226,232,240,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,0.25)", borderRadius: "10px" }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} label={{ position: "top", fill: "rgba(226,232,240,0.7)", fontSize: 13, fontWeight: 700 }}>
                  {gradeData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Application Status Pie */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Application Status</h2>
          <div className="h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={appStatusData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={76} strokeWidth={4} stroke="rgba(2,6,23,0.75)" label={({ name, value }) => `${value}%`} labelLine={false}>
                  {appStatusData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(148,163,184,0.25)", borderRadius: "10px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs mt-1">
            {appStatusData.map((e) => (
              <div key={e.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
                <span className="text-slate-300 truncate">{e.name}</span>
              </div>
            ))}
          </div>
        </article>

        {/* Risk Overview Matrix */}
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Risk Overview Matrix</h2>
          <div className="grid grid-cols-4 gap-1.5 mb-4">
            {riskMatrix.flat().map((val, i) => {
              const style = riskColors[val as 0 | 1 | 2];
              return (
                <div key={i} className={`h-12 rounded-lg border ${style.bg}`} />
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            {([2, 1, 0] as const).map((val) => {
              const style = riskColors[val];
              return (
                <div key={val} className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded border ${style.bg}`} />
                  <span className="text-slate-300">{style.label} Risk</span>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      {/* Assets + Recommendations + App Details */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* PQC Asset Table */}
        <div className="xl:col-span-1 rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-200">Assets &amp; PQC Support</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-slate-400 uppercase">Assets Name</th>
                <th className="px-4 py-3 text-center text-xs text-slate-400 uppercase">PQC Support</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {assetPqcRows.map((r) => (
                <tr key={r.name} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-xs text-slate-300">{r.name}</td>
                  <td className="px-4 py-3 text-center">
                    {r.pqc
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                      : <XCircle className="h-4 w-4 text-rose-400 mx-auto" />
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recommendations */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Improvement Recommendations</h2>
          <div className="space-y-3">
            {recommendations.map((rec, i) => {
              const Icon = rec.icon;
              return (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5">
                  <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${rec.color}`} />
                  <p className="text-sm text-slate-300">{rec.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* App Details */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">payments.pnb.co.in — Details</h2>
          <div className="space-y-3">
            {[
              { icon: Globe,  label: "App Name",  value: "PNB Payments Gateway" },
              { icon: User,   label: "Owner",     value: "Payments Division" },
              { icon: Globe,  label: "Exposure",  value: "Internet-Facing" },
              { icon: Shield, label: "TLS",       value: "RSA-1024 (Weak)" },
              { icon: Cpu,    label: "Score",     value: "210 (Critical)", alert: true },
              { icon: Info,   label: "Status",    value: "Legacy" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs">{item.label}</span>
                  </div>
                  <span className={`text-xs font-medium ${item.alert ? "text-rose-300" : "text-slate-200"}`}>{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
