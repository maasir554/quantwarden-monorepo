"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  Fingerprint,
  Search,
  Loader2,
  ShieldCheck,
  Server,
  Globe,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  Calendar,
  Square,
  Telescope,
  Zap,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { parseOpenSSLScanResult } from "@/lib/openssl-scan";
import { calculatePqcScore } from "@/lib/pqc-scoring";
import { useScanActivity } from "@/components/scan-activity-provider";

interface AssetScanningProps {
  org: any;
  isAdmin: boolean;
  canScan: boolean;
}

interface ScanData {
  id: string;
  type: string;
  portNumber: number | null;
  portProtocol: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  resultData: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface PortTabData {
  key: string;
  number: number;
  protocol: "tcp";
  label: string;
  latestScan: ScanData | null;
  latestSuccessfulScan: ScanData | null;
  latestTerminalScan: ScanData | null;
  state: "unscanned" | "pending" | "running" | "completed" | "failed" | "cancelled" | "dnsExpired" | "noTls";
}

interface ScandAsset {
  id: string;
  value: string;
  type: string;
  isRoot: boolean;
  parentId: string | null;
  scanStatus?: string | null;
  lastScanDate?: string | null;
  latestScan: ScanData | null;
  latestSuccessfulScan?: ScanData | null;
  primarySummaryScan?: ScanData | null;
  primaryPortKey?: string | null;
  currentTcpPorts: Array<{
    number: number;
    protocol: "tcp";
    key: string;
    label: string;
  }>;
  portTabs: PortTabData[];
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return format(date, "dd/MM/yyyy, HH:mm");

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return remainingMinutes > 0 ? `${diffHours}h ${remainingMinutes}m ago` : `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  }

  return format(date, "dd/MM/yyyy, HH:mm");
}

function portTargetKey(assetId: string, portNumber: number | null | undefined, portProtocol: string | null | undefined) {
  return `${assetId}:${portNumber || 443}/${(portProtocol || "tcp").toLowerCase()}`;
}

function portTabTone(state: PortTabData["state"], active: boolean) {
  if (active) {
    if (state === "dnsExpired" || state === "noTls" || state === "failed") {
      return "border-red-200 bg-red-600 text-white";
    }
    return "border-[#8B0000]/20 bg-[#8B0000] text-white";
  }

  if (state === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "dnsExpired") return "border-rose-200 bg-rose-50 text-rose-700";
  if (state === "noTls") return "border-red-200 bg-red-50 text-red-700";
  if (state === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (state === "running") return "border-amber-200 bg-amber-50 text-amber-700";
  if (state === "pending") return "border-slate-200 bg-slate-50 text-slate-700";
  if (state === "cancelled") return "border-stone-200 bg-stone-50 text-stone-700";
  return "border-amber-200 bg-white text-[#8a5d33]";
}

export default function AssetScanning({ org, isAdmin, canScan }: AssetScanningProps) {
  const [assets, setAssets] = useState<ScandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "successful" | "timeout" | "dnsExpired" | "noTls" | "unscanned">("all");
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [selectedPortTabs, setSelectedPortTabs] = useState<Record<string, string>>({});
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStoppingBatch, setIsStoppingBatch] = useState(false);
  const [stableAssetCategory, setStableAssetCategory] = useState<Record<string, "successful" | "timeout" | "dnsExpired" | "noTls" | "unscanned">>({});
  const [scanOptionsModal, setScanOptionsModal] = useState<{
    type: "single" | "group" | "full";
    assetIds: string[];
    label: string;
  } | null>(null);
  const [showScanSchedulePicker, setShowScanSchedulePicker] = useState(false);
  const [scanScheduleDate, setScanScheduleDate] = useState("");
  const [scanScheduleTime, setScanScheduleTime] = useState("");
  const [isSchedulingScan, setIsSchedulingScan] = useState(false);
  const activitySnapshotRef = useRef<{
    activeCount: number;
    latestCompletedBatchId: string | null;
    progressSignature: string;
  } | null>(null);
  const initialActivityCheckDoneRef = useRef(false);
  const lastReconnectAttemptAtRef = useRef(0);
  const {
    hydrated,
    connected,
    activity,
    createBatch,
    cancelBatch,
    checkForActiveScans,
    refreshActivity,
    pendingBatchType,
    cancellingBatchId,
  } = useScanActivity(org.id, {
    orgSlug: org.slug,
  });

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/scans?orgId=${org.id}`);
      const data = await res.json();
      if (data.assets) {
        setAssets(data.assets);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [org.id]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    if (!hydrated || initialActivityCheckDoneRef.current) return;
    initialActivityCheckDoneRef.current = true;
    void checkForActiveScans({
      showIdleToast: true,
      startStreamOnActive: true,
    });
  }, [checkForActiveScans, hydrated]);

  useEffect(() => {
    if (!hydrated || connected || !activity?.activeBatches.length) return;
    const interval = window.setInterval(() => {
      void fetchAssets();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [activity?.activeBatches.length, connected, fetchAssets, hydrated]);

  useEffect(() => {
    if (!hydrated || connected || !activity?.activeBatches.length) return;

    const now = Date.now();
    if (now - lastReconnectAttemptAtRef.current < 12000) return;
    lastReconnectAttemptAtRef.current = now;

    void checkForActiveScans({
      showIdleToast: false,
      startStreamOnActive: true,
    });
  }, [activity?.activeBatches.length, checkForActiveScans, connected, hydrated]);

  useEffect(() => {
    if (!hydrated || !activity) return;

    const progressSignature = (activity.activeBatches || [])
      .map((batch) => [
        batch.id,
        batch.status,
        batch.completedAssets,
        batch.failedAssets,
        batch.pendingAssets,
        batch.runningAssets,
        batch.percentComplete,
      ].join(":"))
      .join("|");

    const nextSnapshot = {
      activeCount: activity.activeBatches.length,
      latestCompletedBatchId: activity.latestCompletedBatch?.id || null,
      progressSignature,
    };
    const previousSnapshot = activitySnapshotRef.current;
    activitySnapshotRef.current = nextSnapshot;

    if (!previousSnapshot) return;

    if (
      previousSnapshot.activeCount !== nextSnapshot.activeCount ||
      previousSnapshot.latestCompletedBatchId !== nextSnapshot.latestCompletedBatchId ||
      previousSnapshot.progressSignature !== nextSnapshot.progressSignature
    ) {
      void fetchAssets();
    }
  }, [activity, fetchAssets, hydrated]);

  const handleScan = async (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    setScanOptionsModal({
      type: "single",
      assetIds: [assetId],
      label: asset?.value || "1 asset",
    });
  };

  const handleScanAll = async () => {
    const scanableAssetIds = assets
      .filter((asset) => asset.type === "domain")
      .map((asset) => asset.id);
    setScanOptionsModal({
      type: "full",
      assetIds: scanableAssetIds,
      label: `${scanableAssetIds.length} assets`,
    });
  };

  const handleGroupScan = async () => {
    setScanOptionsModal({
      type: "group",
      assetIds: selectedAssetIds,
      label: `${selectedAssetIds.length} selected`,
    });
  };

  const closeScanOptionsModal = () => {
    setScanOptionsModal(null);
    setShowScanSchedulePicker(false);
    setScanScheduleDate("");
    setScanScheduleTime("");
    setIsSchedulingScan(false);
  };

  const confirmScan = async () => {
    if (!scanOptionsModal) return;
    setActionError(null);
    const result = await createBatch({
      type: scanOptionsModal.type,
      assetIds: scanOptionsModal.assetIds,
    });

    if (!result.ok) {
      setActionError(result.error || "Failed to queue scan.");
    } else {
      if (scanOptionsModal.type !== "single") setSelectedAssetIds([]);
      void fetchAssets();
    }
    closeScanOptionsModal();
  };

  const scheduleScan = async () => {
    if (!scanOptionsModal) return;
    if (!scanScheduleDate || !scanScheduleTime) return;
    if (!scanOptionsModal.assetIds.length) {
      setActionError("No assets to schedule.");
      return;
    }

    const runAt = new Date(`${scanScheduleDate}T${scanScheduleTime}`);
    if (Number.isNaN(runAt.getTime()) || runAt.getTime() <= Date.now()) {
      setActionError("Schedule time must be in the future.");
      return;
    }

    setIsSchedulingScan(true);
    try {
      const res = await fetch("/api/orgs/scans/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          engine: "openssl",
          type: scanOptionsModal.type,
          mode: "one_time",
          runAt: runAt.toISOString(),
          assetIds: scanOptionsModal.assetIds,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to schedule scan.");
      }
      toast.success("OpenSSL scan scheduled!", {
        description: `Scheduled for ${runAt.toLocaleString()}`,
        position: "bottom-right",
      });
      closeScanOptionsModal();
    } catch (err) {
      toast.error("Scheduling failed.", {
        description: err instanceof Error ? err.message : "Please try again.",
        position: "bottom-right",
      });
    } finally {
      setIsSchedulingScan(false);
    }
  };

  const handleStopBatch = async (batchId: string) => {
    setActionError(null);
    setIsStoppingBatch(true);

    try {
      const latestActivity = await refreshActivity();
      const latestActiveIds = latestActivity?.activeBatches.map((batch) => batch.id) || [];
      const targetBatchId = latestActiveIds.includes(batchId)
        ? batchId
        : (latestActiveIds[0] || null);

      if (!targetBatchId) {
        setActionError("No active scan batch found to stop.");
        return;
      }

      const result = await cancelBatch(targetBatchId);
      if (!result.ok) {
        setActionError(result.error || "Failed to stop the active scan batch.");
      } else {
        setSelectedAssetIds([]);
        void fetchAssets();
      }
    } finally {
      setIsStoppingBatch(false);
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds((previous) =>
      previous.includes(assetId)
        ? previous.filter((id) => id !== assetId)
        : [...previous, assetId]
    );
  };

  const activeTaskByAsset = new Map(
    (activity?.activeBatches || [])
      .flatMap((batch) =>
        batch.items
          .filter((item) => item.status === "pending" || item.status === "running")
          .map((item) => [
            item.assetId,
            { status: item.status, batchType: batch.type, createdAt: item.createdAt },
          ] as const)
      )
  );
  const activeTaskByPort = new Map(
    (activity?.activeBatches || [])
      .flatMap((batch) =>
        batch.items
          .filter((item) => item.status === "pending" || item.status === "running")
          .map((item) => [
            portTargetKey(item.assetId, item.portNumber, item.portProtocol),
            { status: item.status, batchType: batch.type, createdAt: item.createdAt },
          ] as const)
      )
  );

  const fullScan = activity?.activeBatches.find((batch) => batch.type === "full") || null;
  const groupScan = activity?.activeBatches.find((batch) => batch.type === "group") || null;
  const activeBatch = activity?.activeBatches[0] || null;
  const isFullScanActive = Boolean(fullScan);
  const isCreatingFullScan = pendingBatchType === "full";
  const isCreatingGroupScan = pendingBatchType === "group";
  const isCreatingAnyBatch = pendingBatchType !== null;
  const isStoppingActiveBatch = Boolean(activeBatch && cancellingBatchId === activeBatch.id) || isStoppingBatch;
  const orgScanLocked = Boolean(activity?.lock.active);
  const lockMessage = activity?.lock.active
    ? `${activity.lock.message} Started by ${activity.lock.initiatedBy?.name || activity.lock.initiatedBy?.email || "Unknown"} ${formatDistanceToNow(new Date(activity.lock.initiatedAt || new Date().toISOString()), { addSuffix: true })}.`
    : null;

  const domainAssets = assets.filter((a) => a.type === "domain");
  const totalDiscovered = domainAssets.length;

  useEffect(() => {
    setStableAssetCategory((previous) => {
      const next: Record<string, "successful" | "timeout" | "dnsExpired" | "noTls" | "unscanned"> = {};
      let changed = false;

      for (const asset of domainAssets) {
        const hasActiveTask = activeTaskByAsset.has(asset.id);
        const previousCategory = previous[asset.id];

        let terminalCategory: "successful" | "timeout" | "dnsExpired" | "noTls" | "unscanned" | null = null;
        if (asset.scanStatus === "expired") {
          terminalCategory = "dnsExpired";
        } else if (asset.scanStatus === "noTls") {
          terminalCategory = "noTls";
        } else if (asset.scanStatus === "failed") {
          terminalCategory = "timeout";
        } else if (asset.scanStatus === "completed") {
          terminalCategory = "successful";
        } else if (asset.primarySummaryScan?.status === "completed" && parseOpenSSLScanResult(asset.primarySummaryScan.resultData).summary?.noTlsDetected) {
          terminalCategory = "noTls";
        } else if (asset.primarySummaryScan?.status === "completed") {
          terminalCategory = "successful";
        } else if (asset.latestScan?.status === "completed" && parseOpenSSLScanResult(asset.latestScan.resultData).summary?.noTlsDetected) {
          terminalCategory = "noTls";
        } else if (asset.latestScan?.status === "completed") {
          terminalCategory = "successful";
        } else if (asset.latestScan?.status === "failed") {
          terminalCategory = "timeout";
        } else if (!asset.latestScan && !hasActiveTask) {
          terminalCategory = "unscanned";
        }

        // Keep prior terminal category while item is currently pending/running.
        const resolvedCategory = terminalCategory ?? previousCategory ?? "unscanned";
        next[asset.id] = resolvedCategory;

        if (previousCategory !== resolvedCategory) {
          changed = true;
        }
      }

      if (!changed) {
        const previousKeys = Object.keys(previous);
        if (previousKeys.length === Object.keys(next).length) {
          return previous;
        }
      }

      return next;
    });
  }, [activeTaskByAsset, domainAssets]);

  const unscanned = domainAssets.filter((asset) => stableAssetCategory[asset.id] === "unscanned").length;
  const dnsExpired = domainAssets.filter((asset) => stableAssetCategory[asset.id] === "dnsExpired").length;
  const noTls = domainAssets.filter((asset) => stableAssetCategory[asset.id] === "noTls").length;
  const scanTimeout = domainAssets.filter((asset) => stableAssetCategory[asset.id] === "timeout").length;
  const scanSuccessful = domainAssets.filter((asset) => stableAssetCategory[asset.id] === "successful").length;

  let filteredAssets = domainAssets.filter(
    (a) => a.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filterType === "successful") {
    filteredAssets = filteredAssets.filter((asset) => stableAssetCategory[asset.id] === "successful");
  } else if (filterType === "timeout") {
    filteredAssets = filteredAssets.filter((asset) => stableAssetCategory[asset.id] === "timeout");
  } else if (filterType === "dnsExpired") {
    filteredAssets = filteredAssets.filter((asset) => stableAssetCategory[asset.id] === "dnsExpired");
  } else if (filterType === "noTls") {
    filteredAssets = filteredAssets.filter((asset) => stableAssetCategory[asset.id] === "noTls");
  } else if (filterType === "unscanned") {
    filteredAssets = filteredAssets.filter((asset) => stableAssetCategory[asset.id] === "unscanned");
  }

  const filteredAssetIdKey = filteredAssets.map((asset) => asset.id).join("|");

  useEffect(() => {
    const validIds = new Set(filteredAssets.map((asset) => asset.id));
    setSelectedAssetIds((previous) => {
      const next = previous.filter((assetId) => validIds.has(assetId));
      return next.length === previous.length && next.every((assetId, index) => assetId === previous[index])
        ? previous
        : next;
    });
  }, [filteredAssetIdKey, filteredAssets]);

  const renderScanDetails = (scan: ScanData, asset?: ScandAsset) => {
    if (scan.status === "pending" || scan.status === "running") {
      return (
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
          <p className="text-sm font-semibold text-amber-700">OpenSSL TLS scan currently running...</p>
        </div>
      );
    }

    if (scan.status === "failed") {
      let errMsg = "Timeout Possibly Port Not Open";
      if (scan.resultData) {
        try {
          const parsed = JSON.parse(scan.resultData);
          if (parsed.detail) errMsg = parsed.detail;
          else if (parsed.error) errMsg = parsed.error;
          else if (typeof parsed === "string") errMsg = parsed;
        } catch {}
      }

      return (
        <div className="p-4 bg-red-50/80 rounded-xl border border-red-200/50 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-700 font-mono tracking-tight">{errMsg}</p>
        </div>
      );
    }

    if (!scan.resultData) return null;

    const parsed = parseOpenSSLScanResult(scan.resultData);

    if (parsed.error) {
      return (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-sm font-semibold text-red-700">{parsed.error}</p>
        </div>
      );
    }

    if (!parsed.raw || !parsed.summary) {
      return <p className="text-sm text-red-500">Stored scan payload is missing OpenSSL profile data.</p>;
    }

    const payload = parsed.raw;
    const summary = parsed.summary;
    const noTlsDetected = summary.noTlsDetected;
    const noTlsHint =
      noTlsDetected && payload.port === 80
        ? "Port 80 often indicates a plain HTTP service, and no TLS was detected here."
        : null;
    const pqcAssessment = calculatePqcScore(payload);
    const signatureName = summary.publicKeyAlgorithm && summary.publicKeyBits
      ? `${summary.publicKeyAlgorithm}-${summary.publicKeyBits}`
      : summary.signatureAlgorithm || "Not reported";
    const signatureIsPqc = /ml-?dsa|dilithium|slh-?dsa|sphincs/i.test(signatureName);
    const formatCryptoName = (value: string) => value
      .replace(/X25519[_-]?MLKEM[_-]?768/gi, "X25519 + ML-KEM-768")
      .replace(/MLKEM[_-]?768/gi, "ML-KEM-768")
      .replace(/_/g, "-");
    const cipherNames = Array.from(new Set(
      (summary.encryptionAlgorithms.length > 0
        ? summary.encryptionAlgorithms
        : [summary.preferredCipher]
      ).filter((value): value is string => Boolean(value))
    )).map(formatCryptoName);
    const keyExchangeNames = Array.from(new Set(
      [summary.negotiatedGroup, ...summary.keyExchangeAlgorithms]
        .filter((value): value is string => Boolean(value))
        .map(formatCryptoName)
    ));
    const hasMlKem = keyExchangeNames.some((value) => /ML-KEM/i.test(value));
    const negotiatedMlKem = Boolean(summary.negotiatedGroup && /MLKEM|ML-KEM/i.test(summary.negotiatedGroup));
    const openPorts = asset?.currentTcpPorts?.length
      ? asset.currentTcpPorts
      : [{ number: payload.port, protocol: "tcp" as const, key: `${payload.port}/tcp`, label: `${payload.port}/TCP` }];
    const portService = (port: number) => ({
      22: "SSH",
      25: "SMTP",
      53: "DNS",
      80: "HTTP",
      110: "POP3",
      143: "IMAP",
      443: "HTTPS",
      465: "SMTPS",
      587: "SMTP",
      993: "IMAPS",
      995: "POP3S",
      3306: "MySQL",
      5432: "PostgreSQL",
      8080: "HTTP",
    } as Record<number, string>)[port] || "TCP";

    const SummarySection = ({ title, icon: Icon, children }: { title: string; icon: typeof ShieldCheck; children: ReactNode }) => (
      <section className="min-w-0 border-b border-[#8B0000]/16 bg-white/62 last:border-b-0 md:border-r md:[&:nth-child(3n)]:border-r-0 md:[&:nth-last-child(-n+3)]:border-b-0">
        <header className="flex h-10 items-center gap-2 bg-[#8B0000] px-3 text-white">
          <Icon className="h-4 w-4 shrink-0" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em]">{title}</h3>
        </header>
        <div className="min-h-28 space-y-2.5 px-3 py-3">{children}</div>
      </section>
    );

    const Finding = ({
      children,
      tone = "safe",
      badge,
    }: {
      children: ReactNode;
      tone?: "safe" | "warning" | "neutral";
      badge?: string;
    }) => {
      const Icon = tone === "warning" ? AlertTriangle : CheckCircle2;
      const color = tone === "warning" ? "text-amber-600" : tone === "neutral" ? "text-slate-500" : "text-emerald-600";
      return (
        <div className={`flex min-w-0 items-start gap-2 text-sm font-semibold ${color}`}>
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words text-[#3d200a]">{children}</span>
          {badge ? (
            <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
              {badge}
            </span>
          ) : null}
        </div>
      );
    };

    const Guidance = ({ children, tone = "neutral" }: { children: ReactNode; tone?: "safe" | "warning" | "neutral" }) => (
      <p className={`pl-6 text-[11px] font-medium leading-4 ${tone === "safe" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-blue-700"}`}>
        {children}
      </p>
    );

    return (
      <div className="overflow-hidden rounded-xl border border-[#8a5d33]/25 bg-white/60 shadow-sm">
        {noTlsDetected && (
          <div className="border-b border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-700/70">No TLS Detected</p>
                <p className="mt-1 text-sm font-semibold text-red-700">
                  OpenSSL reached this port, but no TLS session or certificate was reported.
                </p>
                {noTlsHint && (
                  <p className="mt-2 text-xs font-semibold text-red-700/80">{noTlsHint}</p>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3">
          <SummarySection title="Signature" icon={Fingerprint}>
            <Finding tone={signatureIsPqc ? "safe" : "warning"}>{noTlsDetected ? "Not available" : signatureName}</Finding>
            {!noTlsDetected ? (
              signatureIsPqc
                ? <Guidance tone="safe">Post-quantum signature detected.</Guidance>
                : <Guidance tone="warning">Classical signatures remain vulnerable to quantum attacks.</Guidance>
            ) : null}
            {!signatureIsPqc && !noTlsDetected ? <Guidance>Plan migration to ML-DSA.</Guidance> : null}
          </SummarySection>

          <SummarySection title="Cipher" icon={ShieldCheck}>
            {cipherNames.length > 0 ? cipherNames.slice(0, 3).map((cipher) => {
              const transitional = /AES-?128/i.test(cipher);
              const weak = /DES|RC4|NULL|EXPORT|MD5/i.test(cipher);
              return <Finding key={cipher} tone={weak || transitional ? "warning" : "safe"}>{cipher}</Finding>;
            }) : <Finding tone="neutral">Not reported</Finding>}
            {cipherNames.length > 3 ? <Guidance>{cipherNames.length - 3} additional ciphers are available in Details.</Guidance> : null}
            {cipherNames.some((cipher) => /AES-?128/i.test(cipher)) ? <Guidance tone="warning">AES-128 provides reduced post-quantum strength.</Guidance> : null}
          </SummarySection>

          <SummarySection title="Key Exchange" icon={Lock}>
            {keyExchangeNames.length > 0 ? keyExchangeNames.slice(0, 3).map((exchange) => (
              <Finding key={exchange} tone={/ML-KEM/i.test(exchange) ? "safe" : "neutral"} badge={negotiatedMlKem && /ML-KEM/i.test(exchange) ? "Negotiated" : undefined}>
                {exchange}
              </Finding>
            )) : <Finding tone="neutral">Not reported</Finding>}
            {hasMlKem
              ? <Guidance tone="safe">Post-quantum key exchange is available.</Guidance>
              : <Guidance tone="warning">Classical exchange only; migrate to ML-KEM.</Guidance>}
          </SummarySection>

          <SummarySection title="Protocol" icon={Lock}>
            {summary.supportedTlsVersions.length > 0 ? summary.supportedTlsVersions.slice(0, 3).map((version) => (
              <Finding key={version} tone={version === "TLSv1.3" ? "safe" : version === "TLSv1.2" ? "neutral" : "warning"}>
                {version.replace("TLSv", "TLS ")}
              </Finding>
            )) : <Finding tone="warning">No TLS negotiated</Finding>}
            {summary.tlsVersionSecure === true ? <Guidance tone="safe">Legacy TLS versions are disabled.</Guidance> : null}
            {summary.tlsVersionSecure === false ? <Guidance tone="warning">TLS 1.0 or 1.1 remains enabled.</Guidance> : null}
          </SummarySection>

          <SummarySection title="Open Ports" icon={Server}>
            {openPorts.slice(0, 4).map((port) => (
              <Finding key={port.key} tone="safe">
                {port.number}/TCP <span className="font-medium text-slate-500">({portService(port.number)})</span>
              </Finding>
            ))}
            {openPorts.length > 4 ? <Guidance>{openPorts.length - 4} additional open ports are available in Details.</Guidance> : null}
          </SummarySection>

          <SummarySection title="PQC Score" icon={ShieldCheck}>
            {pqcAssessment ? (
              <>
                <p className="pl-1 text-3xl font-bold leading-none text-[#3d200a]">
                  {pqcAssessment.score}<span className="text-base font-semibold text-slate-500">/100</span>
                </p>
                <Guidance tone={pqcAssessment.tier === "A" ? "safe" : pqcAssessment.tier === "D" ? "warning" : "neutral"}>
                  Tier {pqcAssessment.tier} · {pqcAssessment.status}
                </Guidance>
              </>
            ) : (
              <Finding tone="neutral">Not available</Finding>
            )}
          </SummarySection>
        </div>
      </div>
    );
  };

  const renderPortTabContent = (asset: ScandAsset, portTab: PortTabData | null) => {
    if (!portTab) {
      return (
        <div className="p-4 bg-white rounded-xl border border-amber-200/60">
          <p className="text-sm font-semibold text-[#8a5d33]/70">
            No TCP ports are currently configured for this asset.
          </p>
        </div>
      );
    }

    const liveTask = activeTaskByPort.get(portTargetKey(asset.id, portTab.number, portTab.protocol));
    const effectiveState =
      liveTask?.status === "running"
        ? "running"
        : liveTask?.status === "pending"
          ? "pending"
          : portTab.state;

    if (effectiveState === "pending") {
      return (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
          <Clock className="w-5 h-5 text-slate-500 shrink-0" />
          <p className="text-sm font-semibold text-slate-700">
            OpenSSL scan for port {portTab.number}/TCP is queued and will start when a worker slot becomes free.
          </p>
        </div>
      );
    }

    if (effectiveState === "running") {
      return (
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
          <p className="text-sm font-semibold text-amber-700">
            OpenSSL TLS scan for port {portTab.number}/TCP is currently running...
          </p>
        </div>
      );
    }

    if (effectiveState === "unscanned") {
      return (
        <div className="p-4 bg-white rounded-xl border border-amber-200/60">
          <p className="text-sm font-semibold text-[#8a5d33]/70">
            Port {portTab.number}/TCP has not been scanned with OpenSSL yet.
          </p>
        </div>
      );
    }

    if (effectiveState === "cancelled") {
      return (
        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-stone-500 shrink-0" />
          <p className="text-sm font-semibold text-stone-700">
            The most recent OpenSSL scan for port {portTab.number}/TCP was cancelled.
          </p>
        </div>
      );
    }

    if (effectiveState === "dnsExpired") {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-700/70">DNS Expired</p>
              <p className="mt-1 text-sm font-semibold text-red-700">
                This domain no longer resolves in DNS, so OpenSSL could not negotiate TLS on port {portTab.number}/TCP.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (effectiveState === "noTls") {
      return portTab.latestScan
        ? renderScanDetails(portTab.latestScan, asset)
        : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm font-semibold text-red-700">
                OpenSSL reached port {portTab.number}/TCP, but no TLS session or certificate was reported.
              </p>
            </div>
          </div>
        );
    }

    if (!portTab.latestScan) {
      return (
        <div className="p-4 bg-white rounded-xl border border-amber-200/60">
          <p className="text-sm font-semibold text-[#8a5d33]/70">
            No OpenSSL result is available yet for port {portTab.number}/TCP.
          </p>
        </div>
      );
    }

    return renderScanDetails(portTab.latestScan, asset);
  };

  return (
    <>
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#8a5d33]/30 bg-white/45 shadow-sm backdrop-blur-xl">
      <header className="shrink-0 border-b border-[#8a5d33]/20 bg-white/55 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-[#3d200a]">
              <ShieldCheck className="h-5 w-5 text-[#8B0000]" />
              OpenSSL TLS Scanning
            </h2>
            <p className="mt-1 text-xs text-[#8a5d33]">Inspect certificates, negotiated groups, and cipher preference.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/app/${org.slug}/explore`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#8a5d33]/30 bg-white/70 px-3 text-xs font-semibold text-[#3d200a] transition hover:bg-white">
              <Telescope className="h-3.5 w-3.5 text-[#8B0000]" />Explorer
            </Link>
            {canScan && activeBatch ? (
              <button onClick={() => void handleStopBatch(activeBatch.id)} disabled={isStoppingActiveBatch} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50">
                {isStoppingActiveBatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}Stop scan
              </button>
            ) : null}
            {canScan ? (
              <>
                <button onClick={() => void handleGroupScan()} disabled={isCreatingAnyBatch || selectedAssetIds.length < 2} title={selectedAssetIds.length < 2 ? "Select at least two assets" : undefined} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#8B0000]/25 bg-white/70 px-3 text-xs font-semibold text-[#8B0000] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45">
                  {isCreatingGroupScan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />}
                  {orgScanLocked ? "Queue selected" : "Scan selected"}{selectedAssetIds.length > 0 ? ` (${selectedAssetIds.length})` : ""}
                </button>
                <button onClick={() => void handleScanAll()} disabled={isCreatingAnyBatch} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#8B0000] px-3 text-xs font-semibold text-white transition hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-50">
                  {isFullScanActive || isCreatingFullScan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  {isFullScanActive ? `Scanning ${(fullScan?.completedAssets ?? 0) + (fullScan?.failedAssets ?? 0)}/${fullScan?.totalAssets ?? 0}` : orgScanLocked ? "Queue all" : "Scan all"}
                </button>
              </>
            ) : null}
          </div>
        </div>
        {actionError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {actionError}
          </div>
        )}
        {activity?.lock.active && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            {lockMessage}
          </div>
        )}
        {!canScan && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            Your role does not currently have permission to launch OpenSSL scans.
          </div>
        )}
      </header>

      <div className="flex shrink-0 flex-col gap-3 border-b border-[#8a5d33]/20 bg-white/30 px-5 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B0000]/60" />
          <input
            type="text"
            placeholder="Search domains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-full rounded-lg border border-[#8a5d33]/35 bg-white/75 pl-9 pr-3 text-sm font-medium text-[#3d200a] outline-none placeholder:text-[#8a5d33]/55 focus:border-[#8B0000]/45 focus:ring-2 focus:ring-[#8B0000]/10"
          />
        </div>

        <div className="flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setFilterType("all")}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${filterType === "all" ? "bg-[#8B0000] text-white" : "text-[#3d200a] hover:bg-white/60"}`}
          >
            All <span className={filterType === "all" ? "text-white/75" : "text-[#8a5d33]"}>{loading ? "–" : totalDiscovered}</span>
          </button>

          <button
            onClick={() => setFilterType("successful")}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${filterType === "successful" ? "bg-emerald-700 text-white" : "text-[#3d200a] hover:bg-white/60"}`}
          >
            Successful <span className={filterType === "successful" ? "text-white/75" : "text-emerald-700"}>{loading ? "–" : scanSuccessful}</span>
          </button>

          <button
            onClick={() => setFilterType("timeout")}
            title="The target did not respond before the scan deadline"
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${filterType === "timeout" ? "bg-red-700 text-white" : "text-[#3d200a] hover:bg-white/60"}`}
          >
            Timeout <span className={filterType === "timeout" ? "text-white/75" : "text-red-700"}>{loading ? "–" : scanTimeout}</span>
          </button>

          <button
            onClick={() => setFilterType("dnsExpired")}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${filterType === "dnsExpired" ? "bg-red-700 text-white" : "text-[#3d200a] hover:bg-white/60"}`}
          >
            DNS expired <span className={filterType === "dnsExpired" ? "text-white/75" : "text-red-700"}>{loading ? "–" : dnsExpired}</span>
          </button>

          <button
            onClick={() => setFilterType("noTls")}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${filterType === "noTls" ? "bg-red-700 text-white" : "text-[#3d200a] hover:bg-white/60"}`}
          >
            No TLS <span className={filterType === "noTls" ? "text-white/75" : "text-red-700"}>{loading ? "–" : noTls}</span>
          </button>

          <button
            onClick={() => setFilterType("unscanned")}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${filterType === "unscanned" ? "bg-amber-700 text-white" : "text-[#3d200a] hover:bg-white/60"}`}
          >
            Unscanned <span className={filterType === "unscanned" ? "text-white/75" : "text-amber-700"}>{loading ? "–" : unscanned}</span>
          </button>
        </div>

        {canScan && (
          <div className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-[#8a5d33]/25 bg-white/60 px-2.5 text-xs font-semibold text-[#8a5d33]">
            Selected <span className="text-[#8B0000]">{selectedAssetIds.length}</span>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-[#8B0000] animate-spin" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 text-[#8a5d33]/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#3d200a]">No domains found</h3>
            <p className="text-sm text-[#8a5d33]/60 mt-1">
              Add domain assets in the Asset Management tab to scan them here.
            </p>
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const task = activeTaskByAsset.get(asset.id);
            const isQueued = task?.status === "pending";
            const isRunning = task?.status === "running";
            const isDnsExpired = asset.scanStatus === "expired";
            const isNoTls = asset.scanStatus === "noTls";
            const assetCategory = stableAssetCategory[asset.id] || "unscanned";
            const statusLabel = isQueued
              ? "queued"
              : isRunning
                ? "running"
                : isDnsExpired || assetCategory === "dnsExpired"
                  ? "dns expired"
                  : isNoTls || assetCategory === "noTls"
                    ? "no tls"
                  : assetCategory === "successful"
                    ? "success"
                    : assetCategory === "timeout"
                      ? "timeout"
                      : "not scanned yet";
            const statusTime = isQueued || isRunning
              ? task?.createdAt || null
              : (asset.lastScanDate || asset.latestScan?.completedAt || asset.latestScan?.createdAt || null);
            const isExpanded = expandedAssetId === asset.id;
            const isSelected = selectedAssetIds.includes(asset.id);
            const selectedPortKey =
              selectedPortTabs[asset.id] ||
              asset.primaryPortKey ||
              asset.portTabs[0]?.key ||
              null;
            const selectedPortTab =
              asset.portTabs.find((portTab) => portTab.key === selectedPortKey) ||
              asset.portTabs[0] ||
              null;

            return (
              <div key={asset.id} className="bg-white/60 rounded-xl border border-amber-500/10 transition-all hover:bg-white/80 overflow-hidden shadow-sm">
                <div
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedAssetId(isExpanded ? null : asset.id)}
                >
                  <div className="flex items-center gap-4">
                    {canScan && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleAssetSelection(asset.id);
                        }}
                        className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
                          isSelected
                            ? "border-[#8B0000] bg-[#8B0000] text-white"
                            : "border-amber-500/20 bg-white text-transparent hover:border-[#8B0000]/40"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-[#3d200a] leading-tight flex items-center gap-2">
                        {asset.value}
                        {asset.isRoot ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] uppercase tracking-widest leading-none">Root</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] uppercase tracking-widest leading-none">Leaf</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {(asset.latestScan || statusTime) ? (
                          <>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              isQueued ? "text-slate-500" :
                              isRunning ? "text-amber-500 animate-pulse" :
                              statusLabel === "dns expired" ? "text-red-600" :
                              statusLabel === "no tls" ? "text-red-600" :
                              statusLabel === "success" ? "text-emerald-500" :
                              statusLabel === "timeout" ? "text-red-500" : "text-[#8a5d33]/60"
                            }`}>
                              <span title={statusLabel === "timeout" ? "Timeout Possibly Port Not Open" : statusLabel === "no tls" ? "No TLS or certificate was detected on the latest scanned port." : undefined}>
                                {statusLabel}
                              </span>
                            </span>
                            <span className="w-1 h-1 rounded-full bg-[#8a5d33]/20"></span>
                            <span className="text-[10px] font-bold text-[#8a5d33]/50">
                              {formatRelativeTime(statusTime)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-[#8a5d33]/50 uppercase tracking-wider">
                            {isQueued ? "Queued" : isRunning ? "Running" : "Not Scanned Yet"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-4 sm:mt-0">
                    <Link
                      href={`/app/${org.slug}/asset/${asset.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#8B0000] bg-white border border-[#8B0000]/20 rounded-lg hover:bg-[#8B0000]/5 transition-colors"
                    >
                      Details
                    </Link>
                    {canScan && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleScan(asset.id);
                        }}
                        disabled={isQueued || isRunning || isCreatingAnyBatch}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#8B0000] bg-[#8B0000]/5 border border-[#8B0000]/15 rounded-lg hover:bg-[#8B0000]/10 transition-colors disabled:opacity-50"
                      >
                        {isQueued || isRunning || isCreatingAnyBatch ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        {orgScanLocked && !isQueued && !isRunning ? "Queue" : isRunning ? "Scanning" : isQueued ? "Queued" : "Scan TLS"}
                      </button>
                    )}
                    <button className="p-1.5 text-[#8a5d33]/40 hover:text-[#8a5d33] transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-amber-500/10 mt-2 bg-linear-to-b from-transparent to-[#fdf8f0]/40">
                    <div className="pt-4">
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {asset.portTabs.map((portTab) => {
                            const isActivePort = selectedPortKey === portTab.key;
                            return (
                              <button
                                key={portTab.key}
                                type="button"
                                onClick={() =>
                                  setSelectedPortTabs((current) => ({
                                    ...current,
                                    [asset.id]: portTab.key,
                                  }))
                                }
                                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${portTabTone(portTab.state, isActivePort)}`}
                              >
                                <span>{portTab.label}</span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    isActivePort ? "bg-white/20 text-white" : "bg-white/70 text-current"
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

                        {renderPortTabContent(asset, selectedPortTab)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        .scan-stat-skeleton {
          position: relative;
          overflow: hidden;
          background: rgba(138, 93, 51, 0.18);
        }

        .scan-stat-skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-120%);
          background: linear-gradient(100deg, transparent 10%, rgba(255, 255, 255, 0.75) 50%, transparent 90%);
          animation: scan-stat-shimmer 1.5s ease-in-out infinite;
        }

        @keyframes scan-stat-shimmer {
          100% {
            transform: translateX(120%);
          }
        }

        .action-tip {
          position: relative;
        }

        .action-tip::after {
          content: attr(data-tip);
          position: absolute;
          left: 50%;
          top: calc(100% + 8px);
          transform: translateX(-50%);
          white-space: nowrap;
          border-radius: 0.6rem;
          border: 1px solid rgba(139, 0, 0, 0.22);
          background: rgba(255, 255, 255, 0.98);
          color: #6b0000;
          padding: 0.35rem 0.5rem;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.01em;
          box-shadow: 0 10px 22px rgba(61, 32, 10, 0.18);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.16s ease;
          z-index: 30;
        }

        .action-tip:hover::after,
        .action-tip:focus-visible::after {
          opacity: 1;
        }
      `}</style>
    </div>

    {scanOptionsModal && typeof document !== "undefined" && ReactDOM.createPortal(
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
        onClick={closeScanOptionsModal}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-[1.25rem] border border-amber-200/60 bg-[#fffdf9] shadow-[0_26px_70px_rgba(15,23,42,0.18)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-amber-200/60 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#3d200a]">
                  {scanOptionsModal.type === "full"
                    ? "Full OpenSSL Scan"
                    : scanOptionsModal.type === "group"
                      ? "Group OpenSSL Scan"
                      : "OpenSSL Scan"}
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#8a5d33]/75">
                  {scanOptionsModal.label}
                </p>
              </div>
              <button
                type="button"
                onClick={closeScanOptionsModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/50 bg-[#fffdf9] text-[#8a5d33] transition-colors hover:bg-amber-50 hover:text-[#3d200a]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-3 px-6 py-5">
            <button
              type="button"
              onClick={confirmScan}
              className={`inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-sm font-bold text-white transition-colors ${
                orgScanLocked
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-[#8B0000] hover:bg-[#6d0000]"
              }`}
            >
              <Zap className="h-4 w-4" />
              {orgScanLocked ? "Queue Now" : "Scan Now"}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowScanSchedulePicker((v) => !v)}
                className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-amber-300/50 bg-[#fffdf9] text-sm font-bold text-[#3d200a] transition-colors hover:bg-amber-50"
              >
                <Calendar className="h-4 w-4" />
                Schedule for Later
              </button>

              {showScanSchedulePicker && (
                <div className="mt-3 rounded-2xl border border-amber-200/80 bg-white p-4 shadow-md">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#8a5d33]/70">Pick date &amp; time</p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                    <input
                      type="date"
                      value={scanScheduleDate}
                      onChange={(e) => setScanScheduleDate(e.target.value)}
                      min={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`}
                      className="h-10 w-full rounded-xl border border-amber-200 bg-[#fffdf9] px-3 text-sm font-semibold text-[#3d200a] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/60"
                    />
                    <input
                      type="time"
                      value={scanScheduleTime}
                      onChange={(e) => setScanScheduleTime(e.target.value)}
                      className="h-10 w-full rounded-xl border border-amber-200 bg-[#fffdf9] px-3 text-sm font-semibold text-[#3d200a] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/60"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={scheduleScan}
                    disabled={isSchedulingScan || !scanScheduleDate || !scanScheduleTime}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#3d200a] text-sm font-bold text-white transition-colors hover:bg-[#5b3a1f] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isSchedulingScan ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <Calendar className="h-3.5 w-3.5" />
                        Schedule
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
