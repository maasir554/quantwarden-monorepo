"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Zap,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { deriveOpenSSLAssetRollup } from "@/lib/openssl-port-rollup";
import { calculatePqcScore } from "@/lib/pqc-scoring";
import { PqcMethodologyModal } from "../../../_components/PqcMethodologyModal";
import { useScanActivity } from "@/components/scan-activity-provider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function SectionCard({
  title,
  icon: Icon,
  children,
  scrollable = false,
  maxHeightClass,
  headerActions,
  id,
}: {
  title: string;
  icon: any;
  children: ReactNode;
  scrollable?: boolean;
  maxHeightClass?: string;
  headerActions?: ReactNode;
  id?: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  useEffect(() => {
    if (!scrollable) return;

    const element = scrollContainerRef.current;
    if (!element) return;

    const updateFades = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      setShowTopFade(scrollTop > 6);
      setShowBottomFade(scrollTop + clientHeight < scrollHeight - 6);
    };

    updateFades();
    element.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);

    return () => {
      element.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, [children, maxHeightClass, scrollable]);

  if (scrollable) {
    return (
      <section id={id} className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-amber-500/15 bg-white/55 shadow-sm ring-1 ring-white/30 backdrop-blur-xl ${maxHeightClass || "h-[28rem]"}`}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/10 bg-[#fff6de] px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#8B0000]/10 text-[#8B0000]">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <h2 className="text-base font-black tracking-tight text-[#3d200a]">{title}</h2>
          </div>
          {headerActions}
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div ref={scrollContainerRef} className="h-full overflow-y-auto p-5">
            {children}
          </div>
          {showTopFade && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-[#fff2cc] to-transparent" />
          )}
          {showBottomFade && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-[#ffe7a3] to-transparent" />
          )}
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="rounded-3xl border border-amber-500/15 bg-white/55 p-5 shadow-sm ring-1 ring-white/30 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#8B0000]/10 text-[#8B0000]">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-base font-black tracking-tight text-[#3d200a]">{title}</h2>
        </div>
        {headerActions}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  toneClass,
  title,
}: {
  label: ReactNode;
  value: ReactNode;
  icon: any;
  toneClass: string;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/10 bg-white/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/55">
        {label}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${toneClass}`} />
        <div className="min-w-0 truncate text-base font-black text-[#3d200a]" title={title}>
          {value}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/55">{label}</p>
      <div className="text-sm font-bold text-[#3d200a] sm:max-w-[70%] sm:text-right">{value}</div>
    </div>
  );
}

function ChipList({ values, emptyLabel }: { values: string[]; emptyLabel: string }) {
  if (values.length === 0) {
    return <p className="text-sm font-semibold text-[#8a5d33]/60">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-[#3d200a]"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function ScrollValueTable({
  values,
  emptyLabel,
  maxHeightClass = "max-h-52",
  highlightValue,
}: {
  values: string[];
  emptyLabel: string;
  maxHeightClass?: string;
  highlightValue?: (value: string) => boolean;
}) {
  if (values.length === 0) {
    return <p className="text-sm font-semibold text-[#8a5d33]/60">{emptyLabel}</p>;
  }

  return (
    <div className={`overflow-y-auto rounded-2xl border border-amber-200/60 bg-white/70 ${maxHeightClass}`}>
      <table className="w-full border-collapse">
        <tbody>
          {values.map((value, index) => (
            <tr key={value} className="border-b border-amber-500/10 last:border-b-0">
              <td className="w-12 px-4 py-2.5 text-center text-[11px] font-black text-[#8B0000]">{index + 1}</td>
              <td
                className={`px-4 py-2.5 text-sm break-all ${
                  highlightValue?.(value) ? "font-black text-emerald-700" : "font-semibold text-[#3d200a]"
                }`}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DisclosureBlock({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-amber-200/60 bg-white/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">{title}</p>
          {subtitle && <p className="mt-1 text-sm font-semibold text-[#8a5d33]/70">{subtitle}</p>}
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-white text-[#8B0000]">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && <div className="border-t border-amber-500/10 px-4 py-4">{children}</div>}
    </div>
  );
}

function AttributeTable({
  attributes,
  emptyLabel,
}: {
  attributes: Record<string, string> | null | undefined;
  emptyLabel: string;
}) {
  const entries = Object.entries(attributes || {});
  if (entries.length === 0) {
    return <p className="text-sm font-semibold text-[#8a5d33]/60">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-white/75">
      <table className="w-full border-collapse">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-amber-500/10 last:border-b-0">
              <td className="w-[36%] px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/55">{key}</td>
              <td className="px-4 py-2.5 text-sm font-semibold text-[#3d200a] break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IdentifierTable({
  identifiers,
  emptyLabel,
}: {
  identifiers: Array<{ name?: string | null; oid?: string | null; iana_code?: string | null }> | null | undefined;
  emptyLabel: string;
}) {
  if (!identifiers || identifiers.length === 0) {
    return <p className="text-sm font-semibold text-[#8a5d33]/60">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-white/75">
      <table className="w-full border-collapse">
        <thead className="border-b border-amber-500/10 bg-white/65">
          <tr>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/55">Name</th>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/55">OID</th>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/55">IANA</th>
          </tr>
        </thead>
        <tbody>
          {identifiers.map((identifier, index) => (
            <tr key={`${identifier.name || "identifier"}-${identifier.oid || index}`} className="border-b border-amber-500/10 last:border-b-0">
              <td className="px-4 py-2.5 text-sm font-semibold text-[#3d200a] break-all">{identifier.name || "Unknown"}</td>
              <td className="px-4 py-2.5 text-sm font-semibold text-[#3d200a] break-all">{identifier.oid || "Not reported"}</td>
              <td className="px-4 py-2.5 text-sm font-semibold text-[#3d200a] break-all">{identifier.iana_code || "Not reported"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatScanTimestamp(timestamp: string | null | undefined) {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.toLocaleString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
}

function displayNegotiatedGroup(value: string | null | undefined, noTls = false) {
  if (noTls) return "Not applicable";
  return value || "No preference";
}

function hasPqcNegotiatedGroup(value: string | null | undefined) {
  return Boolean(value && value.toUpperCase().includes("MLKEM"));
}

function isMlkemValue(value: string | null | undefined) {
  return Boolean(value && value.toUpperCase().includes("MLKEM"));
}

function isPreferredTlsCipher(value: string | null | undefined) {
  if (!value) return false;
  return value === "TLS_AES_256_GCM_SHA384" || value === "TLS_CHACHA20_POLY1305_SHA256";
}

function normalizeRequestedPortKey(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace("-", "/");
  const [portNumber, protocol] = normalized.split("/");
  if (!portNumber || !protocol) return null;
  const parsedPort = Number(portNumber);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) return null;
  if (protocol !== "tcp") return null;
  return `${parsedPort}/${protocol}`;
}

function PqcSafeChip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-emerald-300/70 bg-transparent px-2 py-0 text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">
            <Check className="h-3 w-3" />
            PQC SAFE
          </span>
        </TooltipTrigger>
        <TooltipContent className="rounded-2xl border-[#4a1e1e]/70 bg-linear-to-br from-[#541616] to-[#7a1f1f] px-3 py-2 text-[11px] font-semibold text-white">
          Module Lattice Kyber is Recommend by NIST for PQC Safety.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getProbeKeyExchangeValues(
  probe: {
    tls_version?: string | null;
    negotiated_group?: string | null;
    cipher_breakdowns?: Array<{ key_exchange?: string | null }> | null;
  } | null,
  summarySupportedGroups: string[]
) {
  if (!probe) return [] as string[];

  const fromBreakdowns = Array.from(
    new Set(
      (probe.cipher_breakdowns || [])
        .map((entry) => entry.key_exchange?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );

  const versionLabel = probe.tls_version || "";
  if (versionLabel.includes("1.3") && summarySupportedGroups.length > 0) {
    return summarySupportedGroups;
  }

  if (fromBreakdowns.length > 0) {
    return fromBreakdowns;
  }

  if (probe.negotiated_group) {
    return [probe.negotiated_group];
  }

  return [];
}

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

export default function AssetIntelligenceClient({
  org,
  asset,
  initialScans,
  initialSelectedPortQuery,
  canManageAssets,
  canScan,
}: any) {
  const router = useRouter();
  const [scans, setScans] = useState(initialScans || []);
  const requestedPortKey = useMemo(
    () => normalizeRequestedPortKey(initialSelectedPortQuery),
    [initialSelectedPortQuery]
  );
  const [selectedPortKey, setSelectedPortKey] = useState<string | null>(requestedPortKey);
  const appliedRequestedPortRef = useRef<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showPqcModal, setShowPqcModal] = useState(false);
  const [activeRecommendation, setActiveRecommendation] = useState<"keyExchange" | "symmetric" | "protocol" | "auth" | null>(null);
  const [showQueriedGroups, setShowQueriedGroups] = useState(false);
  const [activeCertificateSection, setActiveCertificateSection] = useState<
    "subject" | "issuer" | "technical" | "identifiers" | "sans" | "chain" | null
  >(null);
  const [copiedCertificateJson, setCopiedCertificateJson] = useState(false);
  const previousAssetScanActiveRef = useRef(false);
  const { activity, createBatch, pendingBatchType } = useScanActivity(org.id, {
    orgSlug: org.slug,
  });
  const isCreatingBatch = pendingBatchType !== null;

  useEffect(() => {
    setScans(initialScans || []);
  }, [initialScans]);

  const opensslRollup = useMemo(
    () => deriveOpenSSLAssetRollup(scans, asset.openPorts),
    [asset.openPorts, scans]
  );
  const portTabs = opensslRollup.portTabs;

  useEffect(() => {
    setSelectedPortKey((previous) => {
      if (
        requestedPortKey &&
        requestedPortKey !== appliedRequestedPortRef.current &&
        portTabs.some((tab) => tab.key === requestedPortKey)
      ) {
        appliedRequestedPortRef.current = requestedPortKey;
        return requestedPortKey;
      }
      if (!requestedPortKey) {
        appliedRequestedPortRef.current = null;
      }
      if (previous && portTabs.some((tab) => tab.key === previous)) {
        return previous;
      }
      return opensslRollup.primaryPortKey || portTabs[0]?.key || null;
    });
  }, [opensslRollup.primaryPortKey, portTabs, requestedPortKey]);

  const selectedPortTab = useMemo(
    () => portTabs.find((tab) => tab.key === selectedPortKey) || portTabs[0] || null,
    [portTabs, selectedPortKey]
  );
  const latestScan = selectedPortTab?.latestScan || null;
  const displayScan = latestScan?.status === "completed" ? latestScan : null;
  const parsed = useMemo(() => parseOpenSSLScanResult(displayScan?.resultData), [displayScan?.resultData]);
  const payload = parsed.raw;
  const summary = parsed.summary;
  const pqcAssessment = useMemo(() => calculatePqcScore(payload), [payload]);
  const certificate = payload?.certificate || null;
  const certificateChain = useMemo(
    () =>
      Array.isArray((payload as any)?.certificate_chain)
        ? ((payload as any).certificate_chain as Array<Record<string, any>>)
        : [],
    [payload]
  );
  const certificateIdentifiers = useMemo(
    () =>
      Array.isArray((payload as any)?.identifiers?.certificate_algorithms)
        ? ((payload as any).identifiers.certificate_algorithms as Array<{
            name?: string | null;
            oid?: string | null;
            iana_code?: string | null;
          }>)
        : [],
    [payload]
  );
  const certificateExportJson = useMemo(
    () =>
      JSON.stringify(
        {
          certificate: payload?.certificate || null,
          certificate_chain: (payload as any)?.certificate_chain || [],
          identifiers: (payload as any)?.identifiers || null,
        },
        null,
        2
      ),
    [payload]
  );
  const issuerAuthorityLabel = useMemo(() => {
    if (summary?.noTlsDetected) return "Not reported";

    const issuerAttributes = (certificate as any)?.issuer_attributes as Record<string, string> | undefined;
    const issuerOrganization = issuerAttributes?.O || issuerAttributes?.organizationName || null;
    const issuerCommonName = summary?.issuerCommonName || issuerAttributes?.CN || issuerAttributes?.commonName || null;

    if (issuerOrganization && issuerCommonName) {
      return issuerOrganization === issuerCommonName
        ? issuerOrganization
        : `${issuerOrganization} • ${issuerCommonName}`;
    }

    return issuerOrganization || issuerCommonName || "Unknown";
  }, [certificate, summary?.issuerCommonName, summary?.noTlsDetected]);

  const handleCopyCertificateJson = async () => {
    try {
      await navigator.clipboard.writeText(certificateExportJson);
      setCopiedCertificateJson(true);
      window.setTimeout(() => setCopiedCertificateJson(false), 1600);
    } catch (error) {
      console.error("Failed to copy certificate JSON", error);
    }
  };

  const toggleCertificateSection = (
    section: "subject" | "issuer" | "technical" | "identifiers" | "sans" | "chain"
  ) => {
    setActiveCertificateSection((current) => (current === section ? null : section));
  };
  const supportedProbes = useMemo(
    () => payload?.tls_versions.filter((probe) => probe.supported) || [],
    [payload]
  );
  const featuredProbe = useMemo(() => {
    if (supportedProbes.length === 0) return null;
    return (
      supportedProbes.find((probe) => {
        const versionLabel = probe.negotiated_protocol || probe.tls_version || "";
        return versionLabel.includes("1.3");
      }) ||
      supportedProbes[0]
    );
  }, [supportedProbes]);
  const secondaryProbes = useMemo(
    () => supportedProbes.filter((probe) => probe !== featuredProbe),
    [featuredProbe, supportedProbes]
  );
  const assetScanActive = useMemo(
    () =>
      Boolean(
        activity?.activeBatches.some((batch) =>
          batch.items.some((item) => item.assetId === asset.id && (item.status === "pending" || item.status === "running"))
        )
      ),
    [activity?.activeBatches, asset.id]
  );

  useEffect(() => {
    if (previousAssetScanActiveRef.current && !assetScanActive) {
      router.refresh();
    }

    previousAssetScanActiveRef.current = assetScanActive;
  }, [assetScanActive, router]);

  const handleScan = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const result = await createBatch({
        type: "single",
        assetIds: [asset.id],
      });

      if (!result.ok) {
        throw new Error(result.error || "OpenSSL scan request failed.");
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setScanError(error instanceof Error ? error.message : "OpenSSL scan request failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleDiscover = async () => {
    setIsDiscovering(true);

    try {
      const streamUrl = `/api/orgs/discover?assetId=${encodeURIComponent(asset.id)}&orgId=${encodeURIComponent(org.id)}`;
      const eventSource = new EventSource(streamUrl);

      eventSource.addEventListener("done", () => {
        eventSource.close();
        setIsDiscovering(false);
        router.push(`/app/${org.slug}/asset`);
      });

      eventSource.addEventListener("error", () => {
        eventSource.close();
        setIsDiscovering(false);
      });
    } catch (error) {
      console.error(error);
      setIsDiscovering(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${asset.value}?`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/orgs/assets?id=${asset.id}&orgId=${org.id}`, { method: "DELETE" });
      router.push(`/app/${org.slug}/asset`);
    } catch (error) {
      console.error(error);
      setIsDeleting(false);
    }
  };

  const scanStatusTone =
    opensslRollup.scanStatus === "expired"
      ? "bg-red-100 text-red-700"
      : opensslRollup.scanStatus === "noTls"
      ? "bg-red-100 text-red-700"
      : opensslRollup.scanStatus === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : opensslRollup.scanStatus === "failed"
        ? "bg-red-100 text-red-700"
        : latestScan?.status === "pending" || latestScan?.status === "running"
          ? "bg-amber-100 text-amber-700"
          : "bg-white/70 text-[#8a5d33]";
  const latestScanError = useMemo(
    () => (latestScan ? parseOpenSSLScanResult(latestScan.resultData).error : null),
    [latestScan]
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-6 py-8 sm:px-8">
      <div className="mb-6">
        <Link
          href={`/app/${org.slug}/explore`}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#8a5d33]/60 transition-colors hover:text-[#8a5d33]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explorer
        </Link>
      </div>

      <div className="mb-8 rounded-[2rem] border border-white/40 bg-white/35 p-6 shadow-xl ring-1 ring-amber-500/10 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-3xl font-black tracking-tight text-[#3d200a] sm:text-4xl">{asset.value}</h1>
              <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest ${asset.isRoot ? "bg-amber-100 text-amber-700" : "bg-[#8B0000]/10 text-[#8B0000]"}`}>
                {asset.isRoot ? "Root" : "Leaf"}
              </span>
              <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#3d200a]">
                {asset.type}
              </span>
              <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest ${scanStatusTone}`}>
                {opensslRollup.scanStatus === "expired" ? "dns expired" : opensslRollup.scanStatus === "noTls" ? "no tls" : opensslRollup.scanStatus === "completed" ? "completed" : opensslRollup.scanStatus === "failed" ? "failed" : latestScan?.status || "unscanned"}
              </span>
              {selectedPortTab && (
                <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#3d200a]">
                  {selectedPortTab.label}
                </span>
              )}
              {pqcAssessment && (
                <button
                  onClick={() => document.getElementById('pqc-insights')?.scrollIntoView({ behavior: 'smooth' })}
                  className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest border transition-all hover:scale-105 ${
                    pqcAssessment.tier === 'A' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                    pqcAssessment.tier === 'B' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                    pqcAssessment.tier === 'C' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                    'bg-red-100 text-red-700 border-red-300'
                  }`}
                >
                  Tier {pqcAssessment.tier}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-[#8a5d33]/75">
              <span>Added on {new Date(asset.createdAt).toLocaleDateString()}</span>
              <span>Last scan: {formatScanTimestamp(opensslRollup.lastScanDate ? String(opensslRollup.lastScanDate) : null)}</span>
              {payload?.resolved_ip && <span>Resolved IP: {payload.resolved_ip}</span>}
            </div>
          </div>

          {(canManageAssets || canScan) && (
            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {activity?.lock.active && (
                <div className="basis-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 xl:max-w-[520px]">
                  {activity.lock.message} Started by {activity.lock.initiatedBy?.name || activity.lock.initiatedBy?.email || "Unknown"}.
                </div>
              )}
              {scanError && (
                <div className="basis-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 xl:max-w-[520px]">
                  {scanError}
                </div>
              )}
              {canManageAssets && (
              <button
                onClick={handleDiscover}
                disabled={isDiscovering || isScanning}
                className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/60 px-4 py-3 text-sm font-bold text-[#8B0000] transition-all hover:bg-white disabled:opacity-50"
              >
                {isDiscovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
                Deep Discover
              </button>
              )}
              {canScan && (
              <button
                onClick={handleScan}
                disabled={isDiscovering || isScanning || isCreatingBatch || assetScanActive || activity?.lock.active}
                className="flex items-center gap-2 rounded-2xl bg-linear-to-r from-[#8B0000] to-[rgb(110,0,0)] px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
              >
                {isScanning || isCreatingBatch || assetScanActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {activity?.lock.active ? "Scan Locked" : isCreatingBatch ? "Starting Scan..." : assetScanActive ? "Scan Running" : "Re-Scan TLS"}
              </button>
              )}
              {canManageAssets && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-2xl border border-red-200/80 bg-white/55 p-3 text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              )}
            </div>
          )}
        </div>
      </div>

      {portTabs.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {portTabs.map((portTab) => {
            const isActive = selectedPortTab?.key === portTab.key;
            const tone =
              portTab.state === "completed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : portTab.state === "dnsExpired"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : portTab.state === "noTls"
                    ? "border-red-200 bg-red-50 text-red-700"
                  : portTab.state === "failed"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : portTab.state === "running"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : portTab.state === "pending"
                        ? "border-slate-200 bg-slate-50 text-slate-700"
                        : "border-white/60 bg-white/70 text-[#8a5d33]";

            return (
              <button
                key={portTab.key}
                type="button"
                onClick={() => setSelectedPortKey(portTab.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                  isActive
                    ? portTab.state === "dnsExpired" || portTab.state === "noTls" || portTab.state === "failed"
                      ? "border-red-200 bg-red-600 text-white"
                      : "border-[#8B0000]/20 bg-[#8B0000] text-white"
                    : tone
                }`}
              >
                <span>{portTab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-white/80 text-current"
                  }`}
                >
                  {portTab.state === "completed"
                    ? "Passed"
                    : portTab.state === "dnsExpired"
                      ? "DNS"
                      : portTab.state === "noTls"
                        ? "No TLS"
                      : portTab.state === "failed"
                        ? "Failed"
                        : portTab.state === "running"
                          ? "Live"
                          : portTab.state === "pending"
                            ? "Queued"
                            : portTab.state === "cancelled"
                              ? "Stopped"
                              : "New"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!selectedPortTab ? (
        <div className="flex h-56 items-center justify-center rounded-[2rem] border-2 border-dashed border-amber-500/20 bg-amber-50/50">
          <p className="text-sm font-bold text-[#8a5d33]/50">No TCP ports are configured for OpenSSL scanning on this asset.</p>
        </div>
      ) : latestScan?.status === "pending" || latestScan?.status === "running" ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-500" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-amber-700/70">
                {latestScan.status === "running" ? "Port Scan Running" : "Port Scan Queued"}
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-700">
                OpenSSL is currently working on {selectedPortTab.label} for this asset.
              </p>
            </div>
          </div>
        </div>
      ) : selectedPortTab.state === "unscanned" ? (
        <div className="flex h-56 items-center justify-center rounded-[2rem] border-2 border-dashed border-amber-500/20 bg-amber-50/50">
          <p className="text-sm font-bold text-[#8a5d33]/50">
            Port {selectedPortTab.label} has not been scanned with OpenSSL yet.
          </p>
        </div>
      ) : latestScan?.status === "cancelled" ? (
        <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-stone-500" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-stone-700/70">Scan Cancelled</p>
              <p className="mt-1 text-sm font-semibold text-stone-700">
                The most recent OpenSSL attempt for {selectedPortTab.label} was cancelled before completion.
              </p>
            </div>
          </div>
        </div>
      ) : latestScan?.status === "failed" ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-red-700/70">Scan Error</p>
              <p className="mt-1 text-sm font-semibold text-red-700">{latestScanError || "The latest scan failed."}</p>
            </div>
          </div>
        </div>
      ) : parsed.error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-red-700/70">Scan Error</p>
              <p className="mt-1 text-sm font-semibold text-red-700">{parsed.error}</p>
            </div>
          </div>
        </div>
      ) : !payload || !summary ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
          The stored scan payload could not be interpreted as an OpenSSL profile.
        </div>
      ) : (
        <div className="space-y-6 pb-10">
          {summary.noTlsDetected && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-red-700/70">No TLS Detected</p>
                  <p className="mt-1 text-sm font-semibold text-red-700">
                    OpenSSL reached this port, but no TLS session or certificate was reported.
                  </p>
                  {payload.port === 80 && (
                    <p className="mt-2 text-xs font-semibold text-red-700/80">
                      This often indicates a plain HTTP service, but no TLS was detected on this port.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Certificate Validity"
              value={
                summary.dnsMissing
                  ? "Unavailable"
                  : summary.noTlsDetected
                    ? "No certificate detected"
                  : summary.certificateValid === false
                    ? "Invalid"
                    : summary.certificateValid === true
                      ? "Valid"
                      : "Unknown"
              }
              icon={summary.dnsMissing || summary.noTlsDetected || summary.certificateValid === false ? AlertTriangle : CheckCircle2}
              toneClass={summary.dnsMissing || summary.noTlsDetected || summary.certificateValid === false ? "text-red-500" : "text-emerald-500"}
            />
            <MetricCard
              label="Primary TLS"
              value={summary.noTlsDetected ? "No TLS negotiated" : summary.primaryTlsVersion || "Unknown"}
              icon={Lock}
              toneClass={summary.noTlsDetected ? "text-red-500" : "text-[#8B0000]"}
            />
            <MetricCard
              label="Expiry"
              value={summary.dnsMissing ? "DNS Expired" : summary.noTlsDetected ? "Not applicable" : summary.daysRemaining !== null ? `${summary.daysRemaining} days` : "Unknown"}
              icon={summary.dnsMissing || summary.noTlsDetected ? AlertTriangle : Calendar}
              toneClass={summary.dnsMissing || summary.noTlsDetected ? "text-red-500" : summary.daysRemaining !== null && summary.daysRemaining > 30 ? "text-emerald-500" : "text-amber-500"}
            />
            <MetricCard
              label="Negotiated Cipher"
              value={summary.noTlsDetected ? "Not negotiated" : summary.negotiatedCipher || "Unknown"}
              icon={ShieldCheck}
              toneClass={summary.noTlsDetected ? "text-red-500" : "text-[#8B0000]"}
              title={summary.negotiatedCipher || undefined}
            />
            <MetricCard
              label={
                <>
                  <span>Negotiated Group</span>
                  {hasPqcNegotiatedGroup(summary.negotiatedGroup) && <PqcSafeChip />}
                </>
              }
              value={displayNegotiatedGroup(summary.negotiatedGroup, summary.noTlsDetected)}
              icon={KeyRound}
              toneClass={summary.noTlsDetected ? "text-red-500" : "text-indigo-600"}
              title={displayNegotiatedGroup(summary.negotiatedGroup, summary.noTlsDetected)}
            />
            <MetricCard
              label="Public Key"
              value={summary.noTlsDetected ? "Not applicable" : summary.publicKeyAlgorithm && summary.publicKeyBits ? `${summary.publicKeyAlgorithm} (${summary.publicKeyBits} bits)` : "Unknown"}
              icon={summary.noTlsDetected || summary.keySizeAdequate === false ? AlertTriangle : CheckCircle2}
              toneClass={summary.noTlsDetected || summary.keySizeAdequate === false ? "text-red-500" : "text-emerald-500"}
            />
            <MetricCard
              label="Signature Algorithm"
              value={summary.noTlsDetected ? "Not applicable" : summary.signatureAlgorithm || "Unknown"}
              icon={Zap}
              toneClass={summary.noTlsDetected ? "text-red-500" : "text-[#8B0000]"}
            />
            <MetricCard
              label="TLS Downgrade Safety"
              value={summary.noTlsDetected ? "Not applicable" : summary.tlsVersionSecure === true ? "Yes" : summary.tlsVersionSecure === false ? "Weak TLS allowed" : "Unknown"}
              icon={summary.noTlsDetected || summary.tlsVersionSecure === false ? AlertTriangle : CheckCircle2}
              toneClass={summary.noTlsDetected || summary.tlsVersionSecure === false ? "text-red-500" : summary.tlsVersionSecure === true ? "text-emerald-500" : "text-[#8a5d33]/55"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard
              title="Certificate & Identity"
              icon={Globe}
              scrollable
              maxHeightClass="h-[28rem]"
              headerActions={
                !summary.noTlsDetected ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleCopyCertificateJson}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/70 bg-white text-[#8B0000] transition-colors hover:bg-amber-50"
                          aria-label="Copy certificate JSON"
                        >
                          {copiedCertificateJson ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        {copiedCertificateJson ? "Copied" : "Copy JSON"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
            >
              <div className="divide-y divide-amber-500/10">
                <DetailRow label="Subject Common Name" value={summary.noTlsDetected ? "No certificate detected" : summary.subjectCommonName || "Unknown"} />
                <DetailRow label="Issuer Authority" value={issuerAuthorityLabel} />
                <DetailRow label="Trust Level" value={summary.noTlsDetected ? "Not applicable" : summary.selfSignedCert ? "Self-Signed" : "Trusted CA"} />
                <DetailRow label="DNS Status" value={summary.dnsMissing ? "Removed from DNS" : "Resolvable"} />
                <DetailRow label="Valid From" value={summary.noTlsDetected ? "Not applicable" : certificate?.not_before || "Unknown"} />
                <DetailRow label="Valid Until" value={summary.noTlsDetected ? "Not applicable" : certificate?.not_after || "Unknown"} />
                <DetailRow label="SAN Coverage" value={`${summary.sanCount} domains`} />
                <DetailRow label="Serial Number" value={summary.noTlsDetected ? "Not applicable" : certificate?.serial_number || "Unknown"} />
              </div>
              {!summary.noTlsDetected && (
                <div className="mt-5 space-y-4">
                  <DisclosureBlock
                    title="Subject"
                    subtitle={summary.subjectCommonName || "Common name not reported"}
                    open={activeCertificateSection === "subject"}
                    onToggle={() => toggleCertificateSection("subject")}
                  >
                    <div>
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Subject Attributes</p>
                      <AttributeTable
                        attributes={(certificate as any)?.subject_attributes}
                        emptyLabel="No subject attributes reported."
                      />
                    </div>
                  </DisclosureBlock>

                  <DisclosureBlock
                    title="Issuer"
                    subtitle={summary.issuerCommonName || "Common name not reported"}
                    open={activeCertificateSection === "issuer"}
                    onToggle={() => toggleCertificateSection("issuer")}
                  >
                    <div>
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Issuer Attributes</p>
                      <AttributeTable
                        attributes={(certificate as any)?.issuer_attributes}
                        emptyLabel="No issuer attributes reported."
                      />
                    </div>
                  </DisclosureBlock>

                  <DisclosureBlock
                    title="Certificate Technical Details"
                    subtitle="Algorithms, keys, and certificate identifiers"
                    open={activeCertificateSection === "technical"}
                    onToggle={() => toggleCertificateSection("technical")}
                  >
                    <div className="divide-y divide-amber-500/10">
                      <DetailRow label="Serial Number" value={certificate?.serial_number || "Unknown"} />
                      <DetailRow label="Signature Algorithm" value={certificate?.signature_algorithm?.name || "Unknown"} />
                      <DetailRow label="Signature OID" value={certificate?.signature_algorithm?.oid || "Not reported"} />
                      <DetailRow label="Public Key Algorithm" value={certificate?.public_key_algorithm?.name || "Unknown"} />
                      <DetailRow label="Public Key OID" value={certificate?.public_key_algorithm?.oid || "Not reported"} />
                      <DetailRow label="Public Key Size" value={certificate?.public_key_bits ? `${certificate.public_key_bits} bits` : "Unknown"} />
                    </div>
                  </DisclosureBlock>

                  <DisclosureBlock
                    title="Certificate Identifiers"
                    subtitle={certificateIdentifiers.length ? `${certificateIdentifiers.length} algorithm identifiers` : "No certificate identifiers reported"}
                    open={activeCertificateSection === "identifiers"}
                    onToggle={() => toggleCertificateSection("identifiers")}
                  >
                    <IdentifierTable
                      identifiers={certificateIdentifiers}
                      emptyLabel="No certificate algorithm identifiers reported."
                    />
                  </DisclosureBlock>

                  <DisclosureBlock
                    title="Subject Alternative Names"
                    subtitle={certificate?.san_dns?.length ? `${certificate.san_dns.length} entries` : "No SAN entries reported"}
                    open={activeCertificateSection === "sans"}
                    onToggle={() => toggleCertificateSection("sans")}
                  >
                    {certificate?.san_dns?.length ? (
                      <div className="max-h-56 overflow-y-auto rounded-2xl border border-amber-200/60 bg-white/75">
                        <table className="w-full border-collapse">
                          <tbody>
                            {certificate.san_dns.map((san: string, index: number) => (
                              <tr key={san} className="border-b border-amber-500/10 last:border-b-0">
                                <td className="w-12 px-4 py-2.5 text-center text-[11px] font-black text-[#8B0000]">{index + 1}</td>
                                <td className="px-4 py-2.5 text-sm font-semibold text-[#3d200a] break-all">{san}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-[#8a5d33]/60">No SAN entries reported.</p>
                    )}
                  </DisclosureBlock>

                  <DisclosureBlock
                    title="Certificate Chain"
                    subtitle={certificateChain.length ? `${certificateChain.length} certificates in chain` : "No certificate chain reported"}
                    open={activeCertificateSection === "chain"}
                    onToggle={() => toggleCertificateSection("chain")}
                  >
                    {certificateChain.length > 0 ? (
                      <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                        {certificateChain.map((entry, index) => (
                          <div key={`${entry.subject || "chain"}-${index}`} className="rounded-2xl border border-amber-200/60 bg-white/75 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">
                              Chain Certificate {index + 1}
                            </p>
                            <div className="mt-3 divide-y divide-amber-500/10">
                              <DetailRow label="Subject" value={entry.subject || "Unknown"} />
                              <DetailRow label="Issuer" value={entry.issuer || "Unknown"} />
                              <DetailRow label="Serial Number" value={entry.serial_number || "Unknown"} />
                              <DetailRow label="Valid From" value={entry.not_before || "Unknown"} />
                              <DetailRow label="Valid Until" value={entry.not_after || "Unknown"} />
                              <DetailRow label="Signature Algorithm" value={entry.signature_algorithm?.name || "Unknown"} />
                              <DetailRow label="Public Key" value={entry.public_key_algorithm?.name && entry.public_key_bits ? `${entry.public_key_algorithm.name} (${entry.public_key_bits} bits)` : "Unknown"} />
                              <DetailRow label="SAN Coverage" value={Array.isArray(entry.san_dns) ? `${entry.san_dns.length} domains` : "0 domains"} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-[#8a5d33]/60">No certificate chain reported.</p>
                    )}
                  </DisclosureBlock>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Negotiation Highlights" icon={Activity}>
              <div className="divide-y divide-amber-500/10">
                <DetailRow label="Negotiated Cipher" value={summary.noTlsDetected ? "Not negotiated" : summary.negotiatedCipher || "Unknown"} />
                <DetailRow
                  label="Negotiated Group"
                  value={displayNegotiatedGroup(summary.negotiatedGroup, summary.noTlsDetected)}
                />
                <DetailRow label="Supported TLS Versions" value={summary.supportedTlsVersions.join(", ") || "None"} />
                <DetailRow label="Resolved IP" value={payload.resolved_ip || "Unknown"} />
                <DetailRow label="Scanned At" value={formatScanTimestamp(payload.scanned_at)} />
              </div>
            </SectionCard>
          </div>

          {supportedProbes.length > 0 && (
            <SectionCard title="Per-Version OpenSSL Probes" icon={Server}>
              <div className="space-y-4">
                {featuredProbe && (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-xl font-black text-[#3d200a]">
                        {featuredProbe.negotiated_protocol || featuredProbe.tls_version}
                      </p>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                        Supported
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2 text-sm font-semibold text-[#3d200a]">
                        <p><span className="text-[#8a5d33]/65">Negotiated cipher:</span> {featuredProbe.negotiated_cipher || "Unknown"}</p>
                        <p>
                          <span className="text-[#8a5d33]/65">Negotiated group:</span>{" "}
                          <span className={isMlkemValue(featuredProbe.negotiated_group) ? "font-black text-emerald-700" : ""}>
                            {displayNegotiatedGroup(featuredProbe.negotiated_group)}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-2xl border border-amber-200/60 bg-white/70 p-4">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Accepted Ciphers</p>
                        {featuredProbe.accepted_ciphers_in_client_offer_order?.length ? (
                          <div className="space-y-2">
                            {featuredProbe.accepted_ciphers_in_client_offer_order.map((cipher, index) => (
                              <div key={cipher} className="flex items-center gap-3 text-sm font-semibold text-[#3d200a]">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#8B0000] ring-1 ring-amber-200">
                                  {index + 1}
                                </span>
                                <span className={`break-all ${isPreferredTlsCipher(cipher) ? "font-black text-emerald-700" : ""}`}>{cipher}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-[#8a5d33]/60">No accepted cipher order reported for this version.</p>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-amber-200/60 bg-white/70 p-4">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Supported Groups (Key Exchange)</p>
                          <ScrollValueTable
                            values={getProbeKeyExchangeValues(featuredProbe, summary.supportedGroups)}
                            emptyLabel="No supported groups reported."
                            highlightValue={isMlkemValue}
                          />
                        </div>
                        <div className="rounded-2xl border border-amber-200/60 bg-white/70 p-4">
                          <button
                            type="button"
                            onClick={() => setShowQueriedGroups((value) => !value)}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Queried Groups</p>
                              <p className="mt-1 text-xs font-semibold text-[#8a5d33]/60">
                                {summary.queriedGroups.length} entries
                              </p>
                            </div>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-white text-[#8B0000]">
                              {showQueriedGroups ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          </button>
                          {showQueriedGroups && (
                            <div className="mt-4">
                              <ScrollValueTable
                                values={summary.queriedGroups}
                                emptyLabel="No queried groups reported."
                                highlightValue={isMlkemValue}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    </div>
                    {secondaryProbes[0] && (
                      <div className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-xl font-black text-[#3d200a]">
                            {secondaryProbes[0].negotiated_protocol || secondaryProbes[0].tls_version}
                          </p>
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                            Supported
                          </span>
                        </div>
                        <div className="space-y-2 text-sm font-semibold text-[#3d200a]">
                          <p><span className="text-[#8a5d33]/65">Negotiated cipher:</span> {secondaryProbes[0].negotiated_cipher || "Unknown"}</p>
                          <p><span className="text-[#8a5d33]/65">Negotiated group:</span> {displayNegotiatedGroup(secondaryProbes[0].negotiated_group)}</p>
                        </div>
                        <div className="mt-4 rounded-2xl border border-amber-200/60 bg-white/70 p-4">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Accepted Ciphers</p>
                          {secondaryProbes[0].accepted_ciphers_in_client_offer_order?.length ? (
                            <div className="space-y-2">
                              {secondaryProbes[0].accepted_ciphers_in_client_offer_order.map((cipher, index) => (
                                <div key={cipher} className="flex items-center gap-3 text-sm font-semibold text-[#3d200a]">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#8B0000] ring-1 ring-amber-200">
                                    {index + 1}
                                  </span>
                                  <span className={`break-all ${isPreferredTlsCipher(cipher) ? "font-black text-emerald-700" : ""}`}>{cipher}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm font-semibold text-[#8a5d33]/60">No accepted cipher order reported for this version.</p>
                          )}
                        </div>
                        <div className="mt-4 rounded-2xl border border-amber-200/60 bg-white/70 p-4">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Supported Groups (Key Exchange)</p>
                          <ScrollValueTable
                            values={getProbeKeyExchangeValues(secondaryProbes[0], summary.supportedGroups)}
                            emptyLabel="No supported groups reported for this version."
                            maxHeightClass="max-h-40"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {secondaryProbes.length > 1 && (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {secondaryProbes.slice(1).map((probe) => (
                      <div key={probe.tls_version} className="rounded-2xl border border-amber-200/70 bg-[#fdf8f0]/70 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-[#3d200a]">{probe.negotiated_protocol || probe.tls_version}</p>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                            Supported
                          </span>
                        </div>
                        <div className="space-y-2 text-sm font-semibold text-[#3d200a]">
                          <p><span className="text-[#8a5d33]/65">Negotiated cipher:</span> {probe.negotiated_cipher || "Unknown"}</p>
                          <p><span className="text-[#8a5d33]/65">Negotiated group:</span> {displayNegotiatedGroup(probe.negotiated_group)}</p>
                        </div>
                        <div className="mt-4 space-y-2">
                          {probe.accepted_ciphers_in_client_offer_order?.length ? (
                            probe.accepted_ciphers_in_client_offer_order.slice(0, 8).map((cipher, index) => (
                              <div key={cipher} className="flex items-center gap-3 text-sm font-semibold text-[#3d200a]">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#8B0000] ring-1 ring-amber-200">
                                  {index + 1}
                                </span>
                                <span className={`break-all ${isPreferredTlsCipher(cipher) ? "font-black text-emerald-700" : ""}`}>{cipher}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm font-semibold text-[#8a5d33]/60">No accepted cipher order reported for this version.</p>
                          )}
                        </div>
                        <div className="mt-4 rounded-2xl border border-amber-200/60 bg-white/70 p-4">
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">Supported Groups (Key Exchange)</p>
                          <ScrollValueTable
                            values={getProbeKeyExchangeValues(probe, summary.supportedGroups)}
                            emptyLabel="No supported groups reported for this version."
                            maxHeightClass="max-h-40"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {summary.warnings.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-amber-800/60">Analysis Warnings</p>
              <div className="space-y-2">
                {summary.warnings.map((warning) => (
                  <div key={warning} className="flex items-start gap-2 text-sm font-semibold text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.dnsMissing && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-red-700/70">DNS Expired</p>
                  <p className="mt-1 text-sm font-semibold text-red-700">
                    This target no longer resolves in DNS. The OpenSSL API was reached successfully, but no certificate or TLS session could be negotiated because the domain has been removed from DNS.
                  </p>
                </div>
              </div>
            </div>
          )}

          {pqcAssessment && (
            <SectionCard 
              title="Post-Quantum Cryptography (PQC) Insights" 
              icon={ShieldCheck}
              id="pqc-insights"
              headerActions={
                <button
                  onClick={() => setShowPqcModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/70 hover:bg-white rounded-lg text-xs font-bold text-[#8B0000] border border-amber-500/20 transition shadow-sm"
                >
                  <Info className="h-3.5 w-3.5" />
                  Methodology
                </button>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
                <div className="col-span-1 flex flex-col items-center justify-center p-6 bg-linear-to-b from-[#fffcf2] to-[#fff1cc]/40 rounded-2xl border border-amber-500/20 shadow-sm relative overflow-hidden h-full min-h-[300px]">
                  <div className="mb-4 text-center">
                    <h3 className="text-xl font-black text-[#3d200a]">Tier {pqcAssessment.tier}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${pqcAssessment.score >= 90 ? 'text-emerald-700' : pqcAssessment.score >= 75 ? 'text-blue-700' : pqcAssessment.score >= 50 ? 'text-amber-600' : 'text-red-700'}`}>
                      {pqcAssessment.status}
                    </p>
                  </div>
                  <PqcGauge score={pqcAssessment.score} />
                </div>
                
                <div className="col-span-1 lg:col-span-2 flex flex-col gap-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/55 ml-1">Evaluation Breakdown</h3>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/10 bg-white/75">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${pqcAssessment.breakdown.keyExchange.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-700'}`}>1</span>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-black text-[#3d200a]">Key Encapsulation</h4>
                          <button onClick={() => setActiveRecommendation('keyExchange')} className="inline-flex w-5 h-5 items-center justify-center rounded-full text-[#8a5d33]/60 hover:bg-[#8a5d33]/15 hover:text-[#8a5d33] transition-colors"><Info className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-[#8a5d33]/70 mt-1 ml-7">{pqcAssessment.breakdown.keyExchange.label}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#8B0000]">{pqcAssessment.breakdown.keyExchange.score}</span>
                      <span className="text-xs font-bold text-black/20">/{pqcAssessment.breakdown.keyExchange.max}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/10 bg-white/75">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${pqcAssessment.breakdown.symmetric.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-700'}`}>2</span>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-black text-[#3d200a]">Symmetric Encryption</h4>
                          <button onClick={() => setActiveRecommendation('symmetric')} className="inline-flex w-5 h-5 items-center justify-center rounded-full text-[#8a5d33]/60 hover:bg-[#8a5d33]/15 hover:text-[#8a5d33] transition-colors"><Info className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-[#8a5d33]/70 mt-1 ml-7">{pqcAssessment.breakdown.symmetric.label}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#8B0000]">{pqcAssessment.breakdown.symmetric.score}</span>
                      <span className="text-xs font-bold text-black/20">/{pqcAssessment.breakdown.symmetric.max}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/10 bg-white/75">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${pqcAssessment.breakdown.protocol.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-700'}`}>3</span>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-black text-[#3d200a]">Protocol Version</h4>
                          <button onClick={() => setActiveRecommendation('protocol')} className="inline-flex w-5 h-5 items-center justify-center rounded-full text-[#8a5d33]/60 hover:bg-[#8a5d33]/15 hover:text-[#8a5d33] transition-colors"><Info className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-[#8a5d33]/70 mt-1 ml-7">{pqcAssessment.breakdown.protocol.label}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#8B0000]">{pqcAssessment.breakdown.protocol.score}</span>
                      <span className="text-xs font-bold text-black/20">/{pqcAssessment.breakdown.protocol.max}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/10 bg-white/75">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${pqcAssessment.breakdown.auth.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>4</span>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-black text-[#3d200a]">Authentication</h4>
                          <button onClick={() => setActiveRecommendation('auth')} className="inline-flex w-5 h-5 items-center justify-center rounded-full text-[#8a5d33]/60 hover:bg-[#8a5d33]/15 hover:text-[#8a5d33] transition-colors"><Info className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-[#8a5d33]/70 mt-1 ml-7">{pqcAssessment.breakdown.auth.label}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#8B0000]">{pqcAssessment.breakdown.auth.score}</span>
                      <span className="text-xs font-bold text-black/20">/{pqcAssessment.breakdown.auth.max}</span>
                    </div>
                  </div>

                  {pqcAssessment.breakdown.penalties.length > 0 && (
                    <div className="mt-2 p-4 rounded-xl border border-red-200 bg-red-50">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8B0000]/60 mb-2">Hard Penalties Applied</h4>
                       <div className="space-y-2">
                         {pqcAssessment.breakdown.penalties.map((penalty, idx) => (
                           <div key={idx} className="flex items-center justify-between py-1 border-b border-red-200/50 last:border-0">
                             <p className="text-sm font-bold text-red-900">{penalty.reason}</p>
                             <span className="text-sm font-black text-[#8B0000]">{penalty.score} pts</span>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}

                </div>
              </div>
            </SectionCard>
          )}

          <PqcMethodologyModal isOpen={showPqcModal} onClose={() => setShowPqcModal(false)} />

          {activeRecommendation && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActiveRecommendation(null)} />
              <div className="relative w-full max-w-lg bg-[#f2f8ff] shadow-[0_16px_60px_rgba(43,20,0,0.3)] rounded-[1.25rem] overflow-hidden border border-[#9cc5ff]/50 animation-in fade-in zoom-in-95 duration-200">
                <div className="bg-[#8b0000] px-6 py-4 flex items-center justify-between">
                  <h3 className="text-white font-black flex items-center gap-2 text-lg">
                    <Info className="w-5 h-5 text-white/80" />
                    Recommendation
                  </h3>
                  <button onClick={() => setActiveRecommendation(null)} className="text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6 bg-white/60">
                  {activeRecommendation === 'keyExchange' && (
                    <p className="text-[15px] text-gray-700 leading-relaxed font-medium">
                      <strong className="text-gray-900 font-bold block mb-2 text-base">Upgrade Key Encapsulation</strong>
                      To achieve maximum points, prioritize upgrading your web server or TLS terminator to natively support <strong>ML-KEM</strong> (formerly Kyber). For OpenSSL, this means upgrading to OpenSSL 3.0+ and configuring the `oqs-provider`. For Nginx or HAProxy, ensure quantum-safe groups like `X25519Kyber768Draft00` are enabled and prioritized in your configuration directives.
                    </p>
                  )}
                  {activeRecommendation === 'symmetric' && (
                    <p className="text-[15px] text-gray-700 leading-relaxed font-medium">
                      <strong className="text-gray-900 font-bold block mb-2 text-base">Strengthen Symmetric Encryption</strong>
                      Grover's algorithm effectively halves the strength of symmetric cipher keys, making 128-bit vulnerable to future quantum attacks. Ensure your TLS configuration prefers ciphers using <strong>AES-256-GCM</strong> or <strong>ChaCha20-Poly1305</strong>. De-prioritize or completely disable 128-bit keys and legacy modes such as CBC.
                    </p>
                  )}
                  {activeRecommendation === 'protocol' && (
                    <p className="text-[15px] text-gray-700 leading-relaxed font-medium">
                      <strong className="text-gray-900 font-bold block mb-2 text-base">Enforce Modern Protocols</strong>
                      Force <strong>TLS 1.3</strong> as the default and minimum protocol version. Post-Quantum algorithms integrate most effectively into the TLS 1.3 handshake mechanism. Only permit TLS 1.2 if strict backward compatibility for legacy clients is absolutely required, and explicitly disable TLS 1.0 and TLS 1.1 across all environments.
                    </p>
                  )}
                  {activeRecommendation === 'auth' && (
                    <p className="text-[15px] text-gray-700 leading-relaxed font-medium">
                      <strong className="text-gray-900 font-bold block mb-2 text-base">Migrate Authentication Signatures</strong>
                      Standardized PQC signature algorithms (like ML-DSA) are rapidly emerging. As an interim measure before full infrastructure migration, ensure you are utilizing at least <strong>ECDSA (P-384+)</strong>, <strong>EdDSA (Ed448)</strong>, or classic <strong>RSA with key sizes ≥ 3072 bits</strong>. Avoid issuing new certificates with RSA-2048 or SHA-1 variants.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
