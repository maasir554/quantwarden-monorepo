"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Info, Loader2, AlertTriangle, CheckCircle, Search, Server, X, Telescope } from "lucide-react";
import { PqcAssessment } from "@/lib/pqc-scoring";
import { PqcMethodologyModal } from "./PqcMethodologyModal";

function PqcGauge({ score }: { score: number }) {
  const pointerAngle = Math.max(-90, Math.min(90, -90 + (score / 100) * 180));

  return (
    <div className="flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-500">
      <div className="relative w-48 h-28">
        <svg className="w-full h-full overflow-visible drop-shadow-sm" viewBox="0 0 200 110">
          <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#ef4444" strokeWidth="22" strokeLinecap="round" />
          <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#ef4444" strokeWidth="22" />
          <path d="M 100 20 A 80 80 0 0 1 156.56 43.43" fill="none" stroke="#f59e0b" strokeWidth="22" />
          <path d="M 156.56 43.43 A 80 80 0 0 1 176.08 75.27" fill="none" stroke="#3b82f6" strokeWidth="22" />
          <path d="M 176.08 75.27 A 80 80 0 0 1 180 100" fill="none" stroke="#10b981" strokeWidth="22" strokeLinecap="round" />
          <path d="M 176.08 75.27 A 80 80 0 0 1 180 100" fill="none" stroke="#10b981" strokeWidth="22" />

          <g transform={`translate(100, 100) rotate(${pointerAngle})`}>
            <path d="M -4 0 L 0 -72 L 4 0 Z" fill="#3d200a" className="drop-shadow-md" />
            <circle cx="0" cy="0" r="8" fill="#3d200a" />
            <circle cx="0" cy="0" r="3" fill="#ffffff" />
          </g>
        </svg>
      </div>
      <div className="mt-3 flex flex-col items-center select-none">
        <span className="text-[2.5rem] font-black leading-none text-[#3d200a] text-shadow-sm">{score}</span>
      </div>
    </div>
  );
}

interface PqcPostureProps {
  org: any;
}

export default function PqcPosture({ org }: PqcPostureProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [tierSortOrder, setTierSortOrder] = useState<"asc" | "desc" | null>(null);
  const [infoTab, setInfoTab] = useState<"score" | "tier">("score");
  const [showPqcInfoTooltip, setShowPqcInfoTooltip] = useState(false);

  useEffect(() => {
    const fetchPqcData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orgs/pqc?orgId=${org.id}`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to load PQC posture");
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPqcData();
  }, [org.id]);

  const scoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600";
    if (score >= 75) return "text-blue-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const getTierColor = (tier: string) => {
    if (tier === "A") return "bg-emerald-100 text-emerald-700 border-emerald-300";
    if (tier === "B") return "bg-blue-100 text-blue-700 border-blue-300";
    if (tier === "C") return "bg-amber-100 text-amber-700 border-amber-300";
    if (tier === "D" || tier === "F") return "bg-red-100 text-red-700 border-red-300";
    return "bg-stone-100 text-stone-500 border-stone-300";
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center flex-col gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B0000]" />
        <p className="text-sm text-gray-500">Analyzing cryptographic agility...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 border border-red-100">
        <div className="flex gap-3 text-red-600">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const { organization, assets } = data;
  const filteredAssets = assets.filter((a: any) => {
    const matchesSearch = a.value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === "ALL" || a.tier === tierFilter;
    return matchesSearch && matchesTier;
  }).sort((a: any, b: any) => {
    if (!tierSortOrder) return 0;
    if (tierSortOrder === "asc") return a.tier.localeCompare(b.tier);
    return b.tier.localeCompare(a.tier);
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#3d200a] flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#8B0000]" />
            Post-Quantum Cryptography (PQC) Posture
          </h1>
          <p className="text-[#8a5d33]/70 mt-1 text-xs font-semibold">Assess your organization's readiness against "Harvest Now, Decrypt Later" quantum threats.</p>
        </div>
        <button
          onClick={() => setShowInfoModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-950 to-[#8B0000] rounded-full text-xs font-bold text-white hover:opacity-90 transition shadow-sm"
        >
          <Info className="h-3.5 w-3.5" />
          Scoring Methodology
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="col-span-1 lg:col-span-2 bg-gradient-to-br from-white to-amber-50/50 backdrop-blur-sm rounded-2xl border border-amber-500/20 shadow-sm p-6 lg:p-8 flex items-center justify-between gap-8 flex-wrap lg:flex-nowrap">
          <div className="flex-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a5d33]/60 mb-3">Organization Rating</h2>
            <div className="flex items-baseline gap-3 mb-4">
              <span className={`text-4xl font-black ${getTierColor(organization.tier).split(" ")[1]}`}>
                Tier {organization.tier}
              </span>
              <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${getTierColor(organization.tier)}`}>
                {organization.tier === "A" ? "Quantum-Safe" : organization.tier === "B" ? "Transitional" : organization.tier === "C" ? "Legacy" : "Vulnerable"}
              </span>
            </div>
            <p className="text-xs text-[#8a5d33]/80 leading-relaxed max-w-md">
              Based on the latest OpenSSL analysis across <strong className="text-[#3d200a]">{organization.totalPortsScored} active ports</strong>. High scores indicate strong symmetric encryption and ML-KEM key exchange implementation.
            </p>
          </div>
          <div className="shrink-0 flex justify-center w-full lg:w-auto">
            <PqcGauge score={organization.averageScore} />
          </div>
        </div>

        {/* Risk Overview Matrix */}
        {organization.tierCounts && (
          <div className="col-span-1 lg:col-span-2 rounded-2xl border border-amber-500/20 bg-white/70 backdrop-blur-sm p-5 lg:p-6 relative overflow-hidden flex flex-col">
            <div className="relative z-10">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a5d33]/60 mb-4">Risk Overview Matrix</h3>
              <div className="grid grid-cols-4 grid-rows-4 gap-1.5 mb-4">
                {(function() {
                  const counts = organization.tierCounts;
                  const total = (counts.D || 0) + (counts.C || 0) + (counts.B || 0) + (counts.A || 0);
                  if (total === 0) return null;
                  
                  // Normalize counts to 16 cells proportionally
                  const d = Math.round(((counts.D || 0) / total) * 16);
                  const c = Math.round(((counts.C || 0) / total) * 16);
                  const b = Math.round(((counts.B || 0) / total) * 16);
                  const a = 16 - d - c - b;
                  
                  const cells = [];
                  let cellIndex = 0;
                  
                  for (let i = 0; i < d && cellIndex < 16; i++, cellIndex++) {
                    cells.push(<button key={`d-${i}`} onClick={() => setTierFilter(tierFilter === 'D' ? 'ALL' : 'D')} className="h-6 sm:h-8 rounded-sm bg-red-500 transition-transform hover:scale-110 hover:ring-2 hover:ring-white/50" />);
                  }
                  for (let i = 0; i < c && cellIndex < 16; i++, cellIndex++) {
                    cells.push(<button key={`c-${i}`} onClick={() => setTierFilter(tierFilter === 'C' ? 'ALL' : 'C')} className="h-6 sm:h-8 rounded-sm bg-amber-500 transition-transform hover:scale-110 hover:ring-2 hover:ring-white/50" />);
                  }
                  for (let i = 0; i < b && cellIndex < 16; i++, cellIndex++) {
                    cells.push(<button key={`b-${i}`} onClick={() => setTierFilter(tierFilter === 'B' ? 'ALL' : 'B')} className="h-6 sm:h-8 rounded-sm bg-blue-500 transition-transform hover:scale-110 hover:ring-2 hover:ring-white/50" />);
                  }
                  for (let i = 0; i < a && cellIndex < 16; i++, cellIndex++) {
                    cells.push(<button key={`a-${i}`} onClick={() => setTierFilter(tierFilter === 'A' ? 'ALL' : 'A')} className="h-6 sm:h-8 rounded-sm bg-emerald-500 transition-transform hover:scale-110 hover:ring-2 hover:ring-white/50" />);
                  }
                  
                  while (cells.length < 16) {
                    cells.push(<div key={`empty-${cells.length}`} className="h-6 sm:h-8 rounded-sm bg-[#8a5d33]/10" />);
                  }
                  
                  return cells;
                })()}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold text-[#3d200a]">
                <button onClick={() => setTierFilter(tierFilter === 'D' ? 'ALL' : 'D')} className={`flex items-center gap-1.5 hover:underline ${tierFilter === 'D' ? 'text-red-600 underline' : ''}`}>
                  <span className="h-2 w-2 rounded bg-red-500" /> High {organization.tierCounts.D || 0} ({Math.round(((organization.tierCounts.D || 0) / ((organization.tierCounts.D||0)+(organization.tierCounts.C||0)+(organization.tierCounts.B||0)+(organization.tierCounts.A||0))) * 100) || 0}%)
                </button>
                <button onClick={() => setTierFilter(tierFilter === 'C' ? 'ALL' : 'C')} className={`flex items-center gap-1.5 hover:underline ${tierFilter === 'C' ? 'text-amber-600 underline' : ''}`}>
                  <span className="h-2 w-2 rounded bg-amber-500" /> Medium {organization.tierCounts.C || 0} ({Math.round(((organization.tierCounts.C || 0) / ((organization.tierCounts.D||0)+(organization.tierCounts.C||0)+(organization.tierCounts.B||0)+(organization.tierCounts.A||0))) * 100) || 0}%)
                </button>
                <button onClick={() => setTierFilter(tierFilter === 'B' ? 'ALL' : 'B')} className={`flex items-center gap-1.5 hover:underline ${tierFilter === 'B' ? 'text-blue-600 underline' : ''}`}>
                  <span className="h-2 w-2 rounded bg-blue-500" /> Safe {organization.tierCounts.B || 0} ({Math.round(((organization.tierCounts.B || 0) / ((organization.tierCounts.D||0)+(organization.tierCounts.C||0)+(organization.tierCounts.B||0)+(organization.tierCounts.A||0))) * 100) || 0}%)
                </button>
                <button onClick={() => setTierFilter(tierFilter === 'A' ? 'ALL' : 'A')} className={`flex items-center gap-1.5 hover:underline ${tierFilter === 'A' ? 'text-emerald-600 underline' : ''}`}>
                  <span className="h-2 w-2 rounded bg-emerald-500" /> Quantum {organization.tierCounts.A || 0} ({Math.round(((organization.tierCounts.A || 0) / ((organization.tierCounts.D||0)+(organization.tierCounts.C||0)+(organization.tierCounts.B||0)+(organization.tierCounts.A||0))) * 100) || 0}%)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Asset Table */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100/50 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-amber-500/20 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="font-black text-[#3d200a] flex items-center gap-2">
            <Server className="h-4 w-4 text-[#8a5d33]" />
            Asset PQC Rollup
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a5d33]/50" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-amber-50/50 border border-amber-500/20 rounded-lg text-xs font-semibold text-[#3d200a] placeholder-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] transition-all"
              />
            </div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="w-full sm:w-auto pl-4 pr-10 py-2 bg-amber-50/50 border border-amber-500/20 rounded-lg text-xs font-bold text-[#3d200a] outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] appearance-none cursor-pointer hover:bg-amber-50 transition-colors"
              style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a5d33' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em 1em' }}
            >
              <option value="ALL">All Tiers</option>
              <option value="A">Tier A</option>
              <option value="B">Tier B</option>
              <option value="C">Tier C</option>
              <option value="D">Tier D</option>
              <option value="F">Tier F</option>
            </select>
            {tierFilter !== 'ALL' && (
              <Link href={`/app/${org.slug}/explore?pqcTier=${tierFilter}`} className="inline-flex items-center justify-center rounded-full bg-amber-100 border border-amber-500/30 text-amber-700 hover:bg-amber-200 transition-colors">
                <Telescope className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
        
        {filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-[#8a5d33]/70">
            No active scans found with valid TLS configurations.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative rounded-b-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-gradient-to-r from-amber-50 to-white border-b border-amber-500/20">
                  <th className="py-3.5 px-5 text-[10px] font-black uppercase tracking-[0.15em] text-[#8a5d33]/70">Asset</th>
                  <th className="py-3.5 px-5 text-[10px] font-black uppercase tracking-[0.15em] text-[#8a5d33]/70 text-center">Score</th>
                  <th onClick={() => setTierSortOrder(prev => prev === "asc" ? "desc" : prev === "desc" ? null : "asc")} className="py-3.5 px-5 text-[10px] font-black uppercase tracking-[0.15em] text-[#8a5d33]/70 cursor-pointer hover:bg-amber-50/50 transition-colors group select-none">
                    <div className="flex items-center gap-2">
                      PQC Tier
                      {tierSortOrder === "asc" ? (
                        <div className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center transition-all" title="Ascending (Good to Bad)">
                          <svg className="w-2.5 h-2.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                        </div>
                      ) : tierSortOrder === "desc" ? (
                        <div className="w-4 h-4 rounded bg-red-100 flex items-center justify-center transition-all" title="Descending (Bad to Good)">
                          <svg className="w-2.5 h-2.5 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-amber-100" title="Sort by Tier">
                          <svg className="w-2.5 h-2.5 text-[#8a5d33]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-black uppercase tracking-[0.15em] text-[#8a5d33]/70">Key Exchange</th>
                  <th className="py-3.5 px-5 text-[10px] font-black uppercase tracking-[0.15em] text-[#8a5d33]/70">Encryption</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {filteredAssets.map((asset: any) => {
                  // Grab primary breakdown from the best/first port
                  const summary = asset.ports[0]?.breakdown;
                  const assetUrl = `/app/${org.slug}/asset/${asset.id}`;
                  
                  return (
                    <tr key={asset.id} className="hover:bg-amber-50/40 transition-colors group cursor-pointer" onClick={() => window.location.href = assetUrl}>
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[#3d200a] group-hover:text-[#8B0000] group-hover:underline transition-colors">{asset.value}</div>
                        <div className="text-[10px] text-[#8a5d33]/60 mt-0.5">{asset.ports.length} port{asset.ports.length > 1 ? 's' : ''} assessed</div>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`text-base font-black ${scoreColor(asset.averageScore)}`}>{asset.averageScore}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${getTierColor(asset.tier)}`}>
                          Tier {asset.tier}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-[11px] font-semibold text-[#8a5d33]/80">
                        {summary?.keyExchange.label || "N/A"}
                      </td>
                      <td className="py-3.5 px-5 text-[11px] font-semibold text-[#8a5d33]/80">
                        {summary?.symmetric.label || "N/A"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PqcMethodologyModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </div>
  );
}
