"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Globe,
  Server,
  ShieldCheck,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { normalizeAssetOpenPorts } from "@/lib/port-discovery";
import { ResultSummaryProps } from "./asset-explorer-types";
import { expandTransition } from "./asset-explorer-utils";

function renderPortChips(ports: unknown) {
  const normalizedPorts = Array.from(
    new Map(
      normalizeAssetOpenPorts(ports)
        .filter((port) => Number.isFinite(port.number))
        .sort((left, right) => left.number - right.number)
        .map((port) => [`${port.number}-${port.protocol}`, port])
    ).values()
  );
  const visiblePorts = normalizedPorts.slice(0, 4);
  const remainingCount = Math.max(0, normalizedPorts.length - visiblePorts.length);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-[#8a5d33]/45">
        Ports:
      </span>
      {visiblePorts.map((port) => (
        <span
          key={`${port.number}-${port.protocol}`}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
            port.protocol === "udp"
              ? "bg-violet-500/10 text-violet-700"
              : "bg-emerald-500/10 text-emerald-700"
          )}
        >
          {port.number}/{port.protocol.toUpperCase()}
        </span>
      ))}
      {remainingCount > 0 ? (
        <span className="inline-flex items-center rounded-full bg-[#8a5d33]/10 px-2 py-0.5 text-[10px] font-bold text-[#8a5d33]">
          +{remainingCount}
        </span>
      ) : null}
    </div>
  );
}

function ResolvedIpChip({
  value,
  type,
  resolvedIp,
}: {
  value: string;
  type: "domain" | "ip" | "unknown";
  resolvedIp?: string | null;
}) {
  const displayIp = type === "ip" ? value : resolvedIp;

  if (displayIp) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-[#1d4ed8]/10 px-2 py-0.5 text-[10px] font-bold text-[#1d4ed8]">
        IP {displayIp}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 cursor-help items-center rounded-full bg-[#1d4ed8]/10 px-2 py-0.5 text-[10px] font-bold text-[#1d4ed8]">
          <span className="mr-1 inline-flex items-center">
            <AlertTriangle className="h-3 w-3" />
          </span>
          IP
        </span>
      </TooltipTrigger>
      <TooltipContent>Run ports and IP scan to see the resolved IP.</TooltipContent>
    </Tooltip>
  );
}

function ResultsSummary({
  usesEndpointMatching,
  totalMatch,
  matchingEndpointCount,
  assetCount,
}: ResultSummaryProps) {
  if (usesEndpointMatching) {
    return (
      <p className="mb-4 px-2 text-sm font-bold text-[#6d3f1d]">
        Found <span className="rounded-full bg-white/55 px-2 py-0.5 text-[#7a1f1f]">{totalMatch}</span> matching
        asset{totalMatch === 1 ? "" : "s"} across{" "}
        <span className="rounded-full bg-white/55 px-2 py-0.5 text-[#7a1f1f]">{matchingEndpointCount}</span> matching
        TLS endpoint{matchingEndpointCount === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <p className="mb-4 px-2 text-sm font-bold text-[#6d3f1d]">
      Found <span className="rounded-full bg-white/55 px-2 py-0.5 text-[#7a1f1f]">{assetCount}</span> matching
      asset{assetCount === 1 ? "" : "s"}
    </p>
  );
}

type AssetExplorerAssetListProps = {
  assets: any[];
  expandedAssetIds: Record<string, boolean>;
  matchingEndpointCount: number;
  onToggleAssetExpansion: (assetId: string) => void;
  orgSlug: string;
  totalMatch: number;
  usesEndpointMatching: boolean;
};

export default function AssetExplorerAssetList({
  assets,
  expandedAssetIds,
  matchingEndpointCount,
  onToggleAssetExpansion,
  orgSlug,
  totalMatch,
  usesEndpointMatching,
}: AssetExplorerAssetListProps) {
  return (
    <div className="space-y-3 pb-28 sm:pb-32">
      <ResultsSummary
        usesEndpointMatching={usesEndpointMatching}
        totalMatch={totalMatch}
        matchingEndpointCount={matchingEndpointCount}
        assetCount={totalMatch}
      />
      {assets.map((asset) => {
        const isDnsExpired = asset.summary?.dnsMissing || asset.summary?.issue === "DNS Expired";
        const canExpandMatches = asset.matchingEndpointCount > 0;
        const isExpanded = Boolean(expandedAssetIds[asset.id]);
        const nameTone = isDnsExpired
          ? "text-red-700 group-hover:text-red-800"
          : asset.summary?.issue
            ? "text-[#8B0000] group-hover:text-red-700"
            : "text-[#3d200a] group-hover:text-amber-900";

        return (
          <div key={asset.id} className="group">
            <div
              className={cn(
                "rounded-2xl border bg-white/45 px-5 py-4 shadow-sm backdrop-blur-md transition-all duration-200",
                asset.summary?.issue
                  ? "border-red-500/20 hover:border-red-500/40 hover:bg-white/95"
                  : "border-amber-500/20 hover:border-amber-500/40 hover:bg-white/95"
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={canExpandMatches ? () => onToggleAssetExpansion(asset.id) : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-4 text-left",
                    canExpandMatches ? "cursor-pointer" : "cursor-default"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      asset.summary?.issue ? "bg-red-100" : "bg-amber-100"
                    )}
                  >
                    {asset.type === "ip" ? (
                      <Server className={cn("h-5 w-5", asset.summary?.issue ? "text-red-600" : "text-amber-600")} />
                    ) : (
                      <Globe className={cn("h-5 w-5", asset.summary?.issue ? "text-red-600" : "text-amber-600")} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 truncate pr-4">
                    <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                      <p className={cn("truncate text-sm font-bold transition-colors sm:text-base", nameTone)}>
                        {asset.name}
                      </p>
                      {canExpandMatches ? (
                        <span className="inline-flex items-center justify-center rounded-full bg-white/70 p-1 text-[#8B0000]">
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </span>
                      ) : null}
                      <ResolvedIpChip value={asset.name} type={asset.type} resolvedIp={asset.resolvedIp} />
                      {isDnsExpired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex shrink-0 cursor-help items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>The domain was not found in DNS.</TooltipContent>
                        </Tooltip>
                      ) : null}
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest",
                          asset.isRoot ? "bg-[#3d200a]/10 text-[#3d200a]" : "bg-[#8B0000]/10 text-[#8B0000]"
                        )}
                      >
                        {asset.isRoot ? "Root" : "Leaf"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {asset.summary?.issue ? (
                        <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          {asset.summary.issue}
                        </div>
                      ) : asset.summary?.timedOut ? (
                        <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Scan timeout
                        </div>
                      ) : !asset.summary ? (
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#6d3f1d]">
                          No scan data
                        </p>
                      ) : null}
                      {renderPortChips(asset.openPorts)}
                      {canExpandMatches ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#8a5d33]/45">
                            {usesEndpointMatching ? "Matched:" : "Available:"}
                          </span>
                          {asset.matchingEndpointLabels?.slice(0, 3).map((label: string) => (
                            <span
                              key={`${asset.id}-${label}`}
                              className="inline-flex items-center rounded-full bg-[#8B0000]/10 px-2 py-0.5 text-[10px] font-bold text-[#8B0000]"
                            >
                              {label}
                            </span>
                          ))}
                          {asset.matchingEndpointCount > 3 ? (
                            <span className="inline-flex items-center rounded-full bg-[#8a5d33]/10 px-2 py-0.5 text-[10px] font-bold text-[#8a5d33]">
                              +{asset.matchingEndpointCount - 3}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-6 pl-14 sm:pl-0">
                  <div className="hidden items-center gap-6 md:flex">
                    {asset.summary?.pqc ? (
                      <div className="flex flex-col items-end">
                        <p className="text-[10px] font-bold uppercase text-[#6d3f1d]">PQC Tier</p>
                        <p
                          className={cn(
                            "text-xs font-bold",
                            asset.summary.pqc.tier === "A" ? "text-emerald-700" : asset.summary.pqc.tier === "B" ? "text-blue-700" : asset.summary.pqc.tier === "C" ? "text-amber-600" : "text-red-600"
                          )}
                        >
                          Tier {asset.summary.pqc.tier}
                        </p>
                      </div>
                    ) : null}

                    {asset.summary?.daysRemaining !== undefined && asset.summary?.daysRemaining !== null ? (
                      <div className="flex flex-col items-end">
                        <p className="text-[10px] font-bold uppercase text-[#6d3f1d]">Expiry</p>
                        <p
                          className={cn(
                            "text-xs font-bold",
                            asset.summary.daysRemaining <= 30 ? "text-red-600" : "text-emerald-700"
                          )}
                        >
                          {asset.summary.daysRemaining} days left
                        </p>
                      </div>
                    ) : null}

                    {asset.summary?.tls ? (
                      <div className="flex w-24 flex-col items-end">
                        <p className="text-[10px] font-bold uppercase text-[#6d3f1d]">Protocol</p>
                        <p className="truncate text-xs font-bold text-[#8B0000]">{asset.summary.tls}</p>
                      </div>
                    ) : null}
                  </div>

                  <Link
                    href={`/app/${orgSlug}/asset/${asset.id}`}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                      asset.summary?.issue ? "bg-red-50 hover:bg-red-100" : "bg-amber-50 hover:bg-amber-100"
                    )}
                  >
                    <ChevronRight
                      className={cn("h-4 w-4", asset.summary?.issue ? "text-red-500" : "text-amber-600")}
                    />
                  </Link>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {canExpandMatches && isExpanded ? (
                  <motion.div
                    key={`expanded-${asset.id}`}
                    initial={{ height: 0, opacity: 0, y: -6 }}
                    animate={{ height: "auto", opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: -6 }}
                    transition={expandTransition}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 border-t border-amber-500/10 pt-4">
                      <div className="space-y-2">
                        {asset.matchingEndpoints.map((endpoint: any) => (
                          <motion.div
                            key={`${asset.id}-${endpoint.portQueryValue}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                          >
                            <Link
                              href={`/app/${orgSlug}/asset/${asset.id}?port=${endpoint.portQueryValue}`}
                              className="block rounded-xl border border-amber-500/15 bg-white/70 px-4 py-3 transition duration-200 hover:border-amber-500/30 hover:bg-white"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-[#8B0000]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#8B0000]">
                                      {endpoint.portLabel}
                                    </span>
                                    {endpoint.summary?.issue ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                        <AlertTriangle className="h-3 w-3" />
                                        {endpoint.summary.issue}
                                      </span>
                                    ) : endpoint.summary?.timedOut ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                        <AlertTriangle className="h-3 w-3" />
                                        Scan timeout
                                      </span>
                                    ) : endpoint.summary?.valid ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                        <ShieldCheck className="h-3 w-3" />
                                        Secured
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                        No scan data
                                      </span>
                                    )}
                                    {endpoint.isPreview ? (
                                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                        Preview
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#8a5d33]">
                                    {endpoint.summary?.pqc ? (
                                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] uppercase font-bold", endpoint.summary.pqc.tier === "A" ? "bg-emerald-100 text-emerald-700" : endpoint.summary.pqc.tier === "B" ? "bg-blue-100 text-blue-700" : endpoint.summary.pqc.tier === "C" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                                        PQC Tier {endpoint.summary.pqc.tier}
                                      </span>
                                    ) : null}
                                    {endpoint.summary?.tls ? <span>TLS {endpoint.summary.tls}</span> : null}
                                    {endpoint.summary?.daysRemaining !== undefined && endpoint.summary?.daysRemaining !== null ? (
                                      <span>{endpoint.summary.daysRemaining} days left</span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-[#8a5d33]">
                                  <span className="text-[11px] font-bold uppercase tracking-widest">Open Port</span>
                                  <ChevronRight className="h-4 w-4" />
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}

