"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, Info, Loader2, AlertTriangle, Search, Server, Telescope } from "lucide-react";
import { PqcMethodologyModal } from "./PqcMethodologyModal";
import { FirstScanAnalysisNotice } from "./OnboardingScanStatus";

interface PqcPostureProps {
  org: any;
}

export default function PqcPosture({ org }: PqcPostureProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [tierSortOrder, setTierSortOrder] = useState<"asc" | "desc" | null>(null);

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
  if (organization.totalPortsScored === 0 || data.initialScanPending) {
    return (
      <div className="w-full space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#3d200a] flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-[#8B0000]" />
              Post-Quantum Cryptography (PQC) Posture
            </h1>
            <p className="text-[#8a5d33]/70 mt-1 text-xs font-semibold">
              PQC scoring begins after the initial asset, port, and TLS discovery workflow completes.
            </p>
          </div>
          <button
            onClick={() => setShowInfoModal(true)}
            className="flex items-center gap-2 rounded-lg border border-white/60 bg-white/55 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition hover:border-[#8B0000]/30 hover:bg-white/70 hover:text-[#8B0000]"
          >
            <Info className="h-3.5 w-3.5" />
            Scoring Methodology
          </button>
        </div>
        <FirstScanAnalysisNotice orgId={org.id} orgSlug={org.slug} area="pqc" />
        <PqcMethodologyModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />
      </div>
    );
  }

  const filteredAssets = assets.filter((a: any) => {
    const matchesSearch = a.value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === "ALL" || a.tier === tierFilter;
    return matchesSearch && matchesTier;
  }).sort((a: any, b: any) => {
    if (!tierSortOrder) return 0;
    if (tierSortOrder === "asc") return a.tier.localeCompare(b.tier);
    return b.tier.localeCompare(a.tier);
  });

  const tierCounts = organization.tierCounts || {};
  const tierTotal = (tierCounts.D || 0) + (tierCounts.C || 0) + (tierCounts.B || 0) + (tierCounts.A || 0);
  const tierDistribution = [
    { tier: "D", label: "High risk", count: tierCounts.D || 0, color: "bg-[#a61b1b]", text: "text-red-800" },
    { tier: "C", label: "Legacy", count: tierCounts.C || 0, color: "bg-[#d97706]", text: "text-amber-800" },
    { tier: "B", label: "Transitional", count: tierCounts.B || 0, color: "bg-[#315f9f]", text: "text-blue-800" },
    { tier: "A", label: "Quantum-safe", count: tierCounts.A || 0, color: "bg-[#168267]", text: "text-emerald-800" },
  ];
  const riskMatrix = tierTotal > 0
    ? Array.from({ length: 16 }, (_, index) => {
        const position = ((index + 0.5) / 16) * tierTotal;
        let cumulative = 0;
        return tierDistribution.find((item) => {
          cumulative += item.count;
          return position <= cumulative;
        }) || tierDistribution[tierDistribution.length - 1];
      })
    : [];

  const organizationLabel =
    organization.tier === "A"
      ? "Quantum-safe"
      : organization.tier === "B"
        ? "Transitional"
        : organization.tier === "C"
          ? "Legacy"
          : "Vulnerable";

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#3d200a] flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#8B0000]" />
            Post-Quantum Cryptography (PQC) Posture
          </h1>
          <p className="text-[#8a5d33]/70 mt-1 text-xs font-semibold">Assess your organization's readiness against "Harvest Now, Decrypt Later" quantum threats.</p>
        </div>
        <button
          onClick={() => setShowInfoModal(true)}
          className="flex items-center gap-2 rounded-lg border border-white/60 bg-white/55 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition hover:border-[#8B0000]/30 hover:bg-white/70 hover:text-[#8B0000]"
        >
          <Info className="h-3.5 w-3.5" />
          Scoring Methodology
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-white/60 bg-white/55 shadow-sm ring-1 ring-[#8a5d33]/10 backdrop-blur-xl">
        <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">Organization readiness</h2>
              <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${getTierColor(organization.tier)}`}>
                Tier {organization.tier} · {organizationLabel}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-600">
              <span><strong className={`text-xl ${scoreColor(organization.averageScore)}`}>{organization.averageScore}</strong> / 100</span>
              <span><strong className="text-slate-900">{organization.totalPortsScored}</strong> ports assessed</span>
            </div>
          </div>

          {tierTotal > 0 ? (
            <div className="flex flex-col gap-3 border-t border-[#8a5d33]/10 pt-4 lg:min-w-[330px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Risk overview</h3>
                <p className="mt-0.5 text-xs text-slate-500">Select a tile to filter the asset rollup.</p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="grid w-fit grid-cols-4 gap-1.5" role="group" aria-label="PQC risk distribution">
                  {riskMatrix.map((item, index) => (
                    <button
                      key={`${item.tier}-${index}`}
                      type="button"
                      title={`${item.label}: ${item.count} asset${item.count === 1 ? "" : "s"}`}
                      aria-label={`Filter ${item.label} assets`}
                      aria-pressed={tierFilter === item.tier}
                      onClick={() => setTierFilter(tierFilter === item.tier ? "ALL" : item.tier)}
                      className={`aspect-square w-8 rounded-[4px] border border-white/60 shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30 ${item.color} ${tierFilter === item.tier ? "ring-2 ring-[#3d200a]/55 ring-offset-2 ring-offset-transparent" : ""}`}
                    />
                  ))}
                </div>
                <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  {tierDistribution.map((item) => (
                    <button
                      key={item.tier}
                      type="button"
                      onClick={() => setTierFilter(tierFilter === item.tier ? "ALL" : item.tier)}
                      className={`flex items-center gap-2 text-left text-[11px] font-medium transition hover:text-slate-900 ${tierFilter === item.tier ? item.text : "text-slate-600"}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-[2px] ${item.color}`} />
                      {item.label} {item.count} ({Math.round((item.count / tierTotal) * 100)}%)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="flex flex-col overflow-hidden rounded-xl border border-white/60 bg-white/55 shadow-sm ring-1 ring-[#8a5d33]/10 backdrop-blur-xl">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-[#8a5d33]/10 p-4 sm:flex-row sm:p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Server className="h-4 w-4 text-[#8B0000]" />
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
                className="w-full rounded-lg border border-white/70 bg-white/65 py-2 pl-9 pr-4 text-xs font-medium text-slate-900 shadow-sm backdrop-blur placeholder:text-slate-400 focus:border-[#8B0000] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/10"
              />
            </div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-lg border border-white/70 bg-white/65 py-2 pl-4 pr-10 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 sm:w-auto"
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
              <Link href={`/app/${org.slug}/explore?pqcTier=${tierFilter}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/70 bg-white/65 text-[#8B0000] shadow-sm backdrop-blur transition hover:bg-white/85">
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
                <tr className="border-b border-[#8a5d33]/10 bg-white/45 backdrop-blur-xl">
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
              <tbody className="divide-y divide-slate-200">
                {filteredAssets.map((asset: any) => {
                  // Grab primary breakdown from the best/first port
                  const summary = asset.ports[0]?.breakdown;
                  const assetUrl = `/app/${org.slug}/asset/${asset.id}`;
                  
                  return (
                    <tr key={asset.id} className="group cursor-pointer transition-colors hover:bg-white/45" onClick={() => window.location.href = assetUrl}>
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
