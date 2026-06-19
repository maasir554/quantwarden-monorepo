"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const tierRows = [
  {
    tier: "Tier-1 Elite",
    secLevel: "Modern best-practise crypto posture",
    criteria: "TLS 1.2 / TLS 1.3 only; Strong Ciphers (AES-GCM / ChaCha20); Forward Secrecy (ECDHE); certificate >2048-bit (prefer 3072/4096); no weak protocols; no known vulnerabilities; HSTS enabled",
    action: "Maintain Configuration; periodic monitoring; recommended baseline for public-facing apps",
    color: "border-emerald-400/30 bg-emerald-500/5",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  },
  {
    tier: "Tier-2 Standard",
    secLevel: "Acceptable enterprise configuration",
    criteria: "TLS 1.2 supported but legacy protocols allowed; Key>2048-bit; Mostly strong ciphers but backward compatibility allowed; Forward secrecy optional",
    action: "Improve gradually; disable legacy protocols; standardise cipher suites.",
    color: "border-cyan-400/30 bg-cyan-500/5",
    badge: "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
  },
  {
    tier: "Tier-3 Legacy",
    secLevel: "Weak but still operational",
    criteria: "TLS 1.0 / TLS 1.1 enabled; weak ciphers (CBC, 3DES); Forward secrecy missing; Key possibly 1024-bit",
    action: "Remediation required; upgrade TLS stack; rotate certificates; remove weak cipher suites",
    color: "border-amber-400/30 bg-amber-500/5",
    badge: "bg-amber-500/20 text-amber-200 border-amber-400/30",
  },
  {
    tier: "Critical",
    secLevel: "Insecure / exploitable",
    criteria: "SSL v2 /SSL v3 enabled; Key <1024-bit; weak cipher suites (<112-bit security); Known vulnerabilities",
    action: "Immediate action: block or isolate service; replace certificate and TLS configuration; patch vulnerabilities",
    color: "border-rose-400/30 bg-rose-500/5",
    badge: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  },
];

const pqcRatingRef = [
  { status: "Legacy",   range: "< 400",       icon: XCircle,       color: "text-rose-300",    bg: "bg-rose-500/10 border-rose-400/20" },
  { status: "Standard", range: "400 – 700",    icon: AlertTriangle, color: "text-amber-300",   bg: "bg-amber-500/10 border-amber-400/20" },
  { status: "Elite-PQC",range: "> 700",        icon: CheckCircle2,  color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-400/20" },
  { status: "Max Score*",range: "1000",        icon: CheckCircle2,  color: "text-cyan-300",    bg: "bg-cyan-500/10 border-cyan-400/20" },
];

const urlScores = [
  { url: "netbanking.pnb.co.in",   score: 820, tier: "Elite-PQC" },
  { url: "payments.pnb.co.in",     score: 210, tier: "Legacy"    },
  { url: "corebanking.pnb.co.in",  score: 185, tier: "Legacy"    },
  { url: "auth.pnb.co.in",         score: 755, tier: "Elite-PQC" },
  { url: "mail.pnb.co.in",         score: 375, tier: "Legacy"    },
  { url: "api.pnb.co.in",          score: 640, tier: "Standard"  },
  { url: "kyc.pnb.co.in",          score: 510, tier: "Standard"  },
  { url: "cdn.pnb.co.in",          score: 870, tier: "Elite-PQC" },
];

const scoreColor = (score: number) =>
  score >= 700 ? "text-emerald-300" : score >= 400 ? "text-amber-300" : "text-rose-300";
const tierBadge = (tier: string) =>
  tier === "Elite-PQC" ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30"
  : tier === "Standard" ? "bg-amber-500/15 text-amber-200 border-amber-400/30"
  : "bg-rose-500/15 text-rose-200 border-rose-400/30";

type Tab = "score" | "tiers";

export default function CyberRating() {
  const [tab, setTab] = useState<Tab>("score");
  const totalScore = 755;
  const maxScore = 1000;
  const angle = (totalScore / maxScore) * 240 - 120; // -120 to +120 deg sweep

  // SVG gauge arc helper
  const r = 80;
  const cx = 110;
  const cy = 95;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcPath = (startDeg: number, endDeg: number, radius: number) => {
    const s = { x: cx + radius * Math.cos(toRad(startDeg)), y: cy + radius * Math.sin(toRad(startDeg)) };
    const e = { x: cx + radius * Math.cos(toRad(endDeg)), y: cy + radius * Math.sin(toRad(endDeg)) };
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-slate-900/60 p-1 w-fit">
        {(["score", "tiers"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-2 text-sm transition capitalize ${
              tab === t ? "bg-cyan-500/20 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t === "score" ? "Enterprise Score" : "Tier Reference"}
          </button>
        ))}
      </div>

      {tab === "score" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Score Card */}
          <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-sm font-semibold text-slate-200 mb-1">Consolidated Enterprise-Level Cyber-Rating Score</h2>
            <p className="text-xs text-slate-500 mb-6">Post-Quantum Cryptography readiness score</p>

            {/* SVG Gauge */}
            <div className="flex justify-center mb-4">
              <svg width="220" height="160" viewBox="0 0 220 160">
                {/* Background arc */}
                <path d={arcPath(150, 390, r)} fill="none" stroke="var(--gauge-track)" strokeWidth="14" strokeLinecap="round" />
                {/* Colored segments */}
                <path d={arcPath(150, 230, r)} fill="none" stroke="#f43f5e" strokeWidth="14" strokeLinecap="round" opacity="0.8" />
                <path d={arcPath(230, 330, r)} fill="none" stroke="#f59e0b" strokeWidth="14" strokeLinecap="round" opacity="0.8" />
                <path d={arcPath(330, 390, r)} fill="none" stroke="#22d3ee" strokeWidth="14" strokeLinecap="round" opacity="0.8" />
                {/* Needle */}
                {(() => {
                  const needleAngle = 150 + (totalScore / maxScore) * 240;
                  const nx = cx + 60 * Math.cos(toRad(needleAngle));
                  const ny = cy + 60 * Math.sin(toRad(needleAngle));
                  return (
                    <>
                      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--gauge-needle)" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx={cx} cy={cy} r="5" fill="var(--gauge-needle)" />
                    </>
                  );
                })()}
                {/* Score text — below arc center, above the bottom arc edge */}
                <text x={cx} y={cy + 20} textAnchor="middle" fill="var(--gauge-score)" fontSize="22" fontWeight="bold">{totalScore}</text>
                <text x={cx} y={cy + 33} textAnchor="middle" fill="var(--gauge-subtext)" fontSize="11">/ {maxScore}</text>
                {/* Labels — positioned outside the arc near each segment endpoint */}
                <text x="8"  y="152" fill="rgba(244,63,94,0.8)"  fontSize="9" textAnchor="start">Legacy</text>
                <text x={cx} y="158" fill="rgba(245,158,11,0.8)" fontSize="9" textAnchor="middle">Standard</text>
                <text x="212" y="152" fill="rgba(34,211,238,0.8)" fontSize="9" textAnchor="end">Elite</text>
              </svg>
            </div>

            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-center">
              <p className="text-xs text-emerald-400 uppercase tracking-widest mb-0.5">Status</p>
              <p className="text-lg font-bold text-emerald-200">Elite-PQC</p>
              <p className="text-xs text-slate-400 mt-0.5">Indicates a stronger security posture</p>
            </div>

            {/* Rating reference */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {pqcRatingRef.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.status} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${item.bg}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${item.color}`} />
                    <div>
                      <p className={`text-xs font-medium ${item.color}`}>{item.status}</p>
                      <p className="text-xs text-slate-500">{item.range}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          {/* URL Scores */}
          <article className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
            <div className="border-b border-white/10 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-200">PQC Score by Asset</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 uppercase">URL</th>
                  <th className="px-4 py-3 text-center text-xs text-slate-400 uppercase">PQC Score</th>
                  <th className="px-4 py-3 text-center text-xs text-slate-400 uppercase">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {urlScores.map((row) => (
                  <tr key={row.url} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-300 text-xs">{row.url}</td>
                    <td className={`px-4 py-3 text-center text-xl font-bold ${scoreColor(row.score)}`}>{row.score}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tierBadge(row.tier)}`}>
                        {row.tier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      )}

      {tab === "tiers" && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-800/60">
                  {["Tier", "Security Level", "Compliance Criteria", "Priority / Action"].map((h) => (
                    <th key={h} className="px-5 py-4 text-left text-xs font-semibold text-slate-200 uppercase tracking-wide border-b border-white/10">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tierRows.map((row) => (
                  <tr key={row.tier} className={`${row.color} hover:brightness-110`}>
                    <td className="px-5 py-4 align-top">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${row.badge}`}>
                        {row.tier}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-300 align-top text-xs leading-relaxed max-w-[140px]">{row.secLevel}</td>
                    <td className="px-5 py-4 text-slate-400 align-top text-xs leading-relaxed max-w-[340px]">{row.criteria}</td>
                    <td className="px-5 py-4 text-slate-300 align-top text-xs leading-relaxed max-w-[200px]">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
