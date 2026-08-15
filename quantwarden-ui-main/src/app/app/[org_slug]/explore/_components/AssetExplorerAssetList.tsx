"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Globe, Server, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeAssetOpenPorts } from "@/lib/port-discovery";
import { ResultSummaryProps } from "./asset-explorer-types";

function ResultsSummary({ usesEndpointMatching, totalMatch, matchingEndpointCount }: ResultSummaryProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-slate-600">
      <p>
        <strong className="text-slate-900">{totalMatch}</strong> asset{totalMatch === 1 ? "" : "s"}
        {usesEndpointMatching ? (
          <> · <strong className="text-slate-900">{matchingEndpointCount}</strong> matching endpoint{matchingEndpointCount === 1 ? "" : "s"}</>
        ) : null}
      </p>
      <p className="text-xs">Each port opens its own scan record.</p>
    </div>
  );
}

function statusFor(summary: any) {
  if (summary?.issue) return { label: summary.issue, tone: "bg-red-100/80 text-red-700", icon: AlertTriangle };
  if (summary?.timedOut) return { label: "Scan timeout", tone: "bg-red-100/80 text-red-700", icon: AlertTriangle };
  if (summary?.valid) return { label: "Secured", tone: "bg-emerald-100/80 text-emerald-800", icon: ShieldCheck };
  return { label: "Not scanned", tone: "bg-slate-200/70 text-slate-600", icon: Server };
}

function pqcTone(tier?: string | null) {
  if (tier === "A") return "text-emerald-700";
  if (tier === "B") return "text-blue-700";
  if (tier === "C") return "text-amber-700";
  return "text-red-700";
}

function endpointRows(asset: any, usesEndpointMatching: boolean) {
  const scanned = Array.isArray(asset.matchingEndpoints) ? asset.matchingEndpoints : [];
  if (usesEndpointMatching) return scanned;

  const byPort = new Map<string, any>();
  for (const endpoint of scanned) byPort.set(endpoint.portQueryValue, endpoint);

  for (const port of normalizeAssetOpenPorts(asset.openPorts)) {
    if (!Number.isFinite(port.number)) continue;
    const protocol = (port.protocol || "tcp").toLowerCase();
    const key = `${port.number}-${protocol}`;
    if (!byPort.has(key)) {
      byPort.set(key, {
        portNumber: port.number,
        portProtocol: protocol,
        portLabel: `${port.number}/${protocol.toUpperCase()}`,
        portQueryValue: key,
        summary: null,
      });
    }
  }

  return Array.from(byPort.values()).sort((left, right) => left.portNumber - right.portNumber);
}

function AssetHeader({ asset, endpoints, orgSlug }: { asset: any; endpoints: any[]; orgSlug: string }) {
  const pqcAssessments = endpoints.map((endpoint) => endpoint.summary?.pqc).filter(Boolean);
  const overallPqc = pqcAssessments.sort((left, right) => left.score - right.score)[0] || asset.summary?.pqc || null;
  const tlsVersions = Array.from(new Set(endpoints.map((endpoint) => endpoint.summary?.tls).filter(Boolean))) as string[];
  const expiries = endpoints
    .map((endpoint) => endpoint.summary?.daysRemaining)
    .filter((value): value is number => typeof value === "number");
  const nearestExpiry = expiries.length > 0 ? Math.min(...expiries) : null;
  const resolvedIp = asset.type === "ip" ? asset.name : asset.resolvedIp;

  return (
    <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#8B0000]/8 text-[#8B0000]">
          {asset.type === "ip" ? <Server className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <Link href={`/app/${orgSlug}/asset/${asset.id}`} className="block truncate text-base font-semibold text-slate-950 hover:text-[#8B0000] sm:text-lg">
            {asset.name}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className={cn("inline-flex items-center gap-1.5", !resolvedIp && "font-medium text-red-700")}>
              <Server className="h-3.5 w-3.5" /> {resolvedIp || "IP not resolved"}
            </span>
            <span>{endpoints.length} port{endpoints.length === 1 ? "" : "s"}</span>
            {asset.summary?.issue ? <span className="font-medium text-red-700">{asset.summary.issue}</span> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:justify-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Overall PQC</p>
          <p className={cn("mt-0.5 text-sm font-semibold", overallPqc ? pqcTone(overallPqc.tier) : "text-slate-500")}>
            {overallPqc ? `${overallPqc.score}/100 · Tier ${overallPqc.tier}` : "Not scored"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">TLS</p>
          <p className="mt-0.5 max-w-48 truncate text-sm font-semibold text-slate-900">{tlsVersions.join(", ") || "Not detected"}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Nearest expiry</p>
          <p className={cn("mt-0.5 text-sm font-semibold", nearestExpiry !== null && nearestExpiry <= 30 ? "text-red-700" : "text-slate-900")}>
            {nearestExpiry === null ? "Not available" : `${nearestExpiry} days`}
          </p>
        </div>
        <Link href={`/app/${orgSlug}/asset/${asset.id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#8a5d33]/30 bg-white/55 px-3 text-xs font-semibold text-[#8B0000] transition hover:bg-white/80">
          Asset details <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function AssetExplorerAssetList({
  assets,
  matchingEndpointCount,
  orgSlug,
  totalMatch,
  usesEndpointMatching,
}: {
  assets: any[];
  matchingEndpointCount: number;
  orgSlug: string;
  totalMatch: number;
  usesEndpointMatching: boolean;
}) {
  return (
    <div className="space-y-4 pb-28 sm:pb-32">
      <ResultsSummary usesEndpointMatching={usesEndpointMatching} totalMatch={totalMatch} matchingEndpointCount={matchingEndpointCount} assetCount={totalMatch} />

      {assets.map((asset) => {
        const endpoints = endpointRows(asset, usesEndpointMatching);
        return (
          <section key={asset.id} className="overflow-hidden rounded-xl border border-[#8a5d33]/30 bg-white/30 shadow-sm backdrop-blur-xl">
            <AssetHeader asset={asset} endpoints={endpoints} orgSlug={orgSlug} />
            <div className="border-t border-[#8a5d33]/20">
              <div className="grid grid-cols-[100px_minmax(0,1fr)_auto] gap-3 bg-white/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:grid-cols-[120px_160px_minmax(0,1fr)_130px_24px]">
                <span>Port</span><span className="hidden sm:block">Status</span><span>TLS posture</span><span className="hidden sm:block">PQC rating</span><span />
              </div>
              {endpoints.length > 0 ? (
                <div className="divide-y divide-[#8a5d33]/15">
                  {endpoints.map((endpoint) => {
                    const status = statusFor(endpoint.summary);
                    const StatusIcon = status.icon;
                    return (
                      <Link
                        key={`${asset.id}-${endpoint.portQueryValue}`}
                        href={`/app/${orgSlug}/asset/${asset.id}?port=${endpoint.portQueryValue}`}
                        className="grid grid-cols-[100px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-white/40 sm:grid-cols-[120px_160px_minmax(0,1fr)_130px_24px]"
                      >
                        <span className="font-mono text-sm font-semibold text-slate-950">{endpoint.portLabel}</span>
                        <span className={cn("hidden w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex", status.tone)}>
                          <StatusIcon className="h-3.5 w-3.5" /> {status.label}
                        </span>
                        <span className="min-w-0 text-xs text-slate-600">
                          <strong className="block truncate font-semibold text-slate-900">{endpoint.summary?.tls || "No TLS evidence"}</strong>
                          {endpoint.summary?.cipher ? <span className="block truncate">{endpoint.summary.cipher}</span> : null}
                        </span>
                        <span className={cn("hidden text-sm font-semibold sm:block", endpoint.summary?.pqc ? pqcTone(endpoint.summary.pqc.tier) : "text-slate-500")}>
                          {endpoint.summary?.pqc ? `${endpoint.summary.pqc.score} · Tier ${endpoint.summary.pqc.tier}` : "Not scored"}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[#8B0000]" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-slate-500">No ports are available for this asset.</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
