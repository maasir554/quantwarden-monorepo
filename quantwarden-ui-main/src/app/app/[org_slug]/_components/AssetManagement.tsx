"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { toast } from "sonner";
import {
  Globe,
  Server,
  Trash2,
  Loader2,
  Search,
  ArrowRight,
  Info,
  Plus,
  X,
  PlusCircle,
  MinusCircle,
  Pencil,
  ChevronDown,
  ChevronUp,
  Network,
  Leaf,
  Clock,
  Telescope,
  CheckCircle2,
  TriangleAlert,
  Tags,
} from "lucide-react";
import { useScanActivity } from "@/components/scan-activity-provider";
import {
  buildAssetBucketOptions,
  DEFAULT_ASSET_BUCKET,
  inferAssetBucket,
  normalizeAssetBucket,
  PREDEFINED_ASSET_BUCKETS,
} from "@/lib/asset-buckets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createDefaultAssetPorts,
  createDefaultPortDiscoveryConfig,
  DEFAULT_PORT_DISCOVERY_PROBE_BATCH_SIZE,
  DEFAULT_PORT_DISCOVERY_PROBE_TIMEOUT_MS,
  MAX_PORT_DISCOVERY_PROBE_BATCH_SIZE,
  MAX_PORT_DISCOVERY_PROBE_TIMEOUT_MS,
  normalizeAssetOpenPorts,
  normalizePortDiscoveryConfig,
  type AssetPort,
  type PortDiscoveryPresetEntry,
} from "@/lib/port-discovery";

interface AssetManagementProps {
  org: any;
  currentUserRole: string;
  currentUserId: string;
  canManageAssets: boolean;
  canScan: boolean;
}

function getAssetType(value: string): "domain" | "ip" | "unknown" {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$/;
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

  if (ipv4Regex.test(value) || ipv6Regex.test(value)) return "ip";
  if (domainRegex.test(value)) return "domain";
  return "unknown";
}

function getAssetIcon(type: "domain" | "ip" | "unknown") {
  switch (type) {
    case "domain": return Globe;
    case "ip": return Server;
    default: return Globe;
  }
}

function parseOpenPorts(raw: unknown): AssetPort[] {
  return normalizeAssetOpenPorts(raw);
}

interface PortDiscoveryEntryDraft {
  id: string;
  port: number;
  portDraft: string;
  title: string;
  enabled: boolean;
}

interface PortDiscoveryModalScope {
  mode: "full" | "single";
  assetIds: string[];
  assetLabel?: string | null;
}

interface ManagedRootAsset {
  id: string;
  value: string;
  type: "domain" | "ip" | "unknown";
  bucket: string;
  addedAt: string;
  scanning: boolean;
  statusMessage?: string;
  scanStatus?: string;
  portDiscoveryStatus?: string;
  resolvedIp?: string | null;
  openPorts: AssetPort[];
  subdomains: string[];
}

interface ManagedLeafAsset {
  id: string;
  value: string;
  type: "domain" | "ip" | "unknown";
  bucket: string;
  parentId: string | null;
  addedAt: string;
  scanStatus?: string;
  portDiscoveryStatus?: string;
  resolvedIp?: string | null;
  openPorts: AssetPort[];
}

// ═══════════════════════════════════════
// Empty State
// ═══════════════════════════════════════
function EmptyState({ icon: EmptyIcon, text, sub }: { icon: any; text: string; sub: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
        <EmptyIcon className="w-7 h-7 text-amber-400/60" />
      </div>
      <p className="text-sm font-bold text-[#3d200a]/70">{text}</p>
      <p className="text-xs text-[#8a5d33]/50 mt-1 max-w-[240px]">{sub}</p>
    </div>
  );
}

// ═══════════════════════════════════════
// Input Bar
// ═══════════════════════════════════════
function InputBar({
  value, onChange, onSubmit, placeholder, infoText, disabled, trailingControl, showSubmitButton = true,
}: {
  value: string; onChange: (v: string) => void; onSubmit: (e: React.FormEvent) => void;
  placeholder: string; infoText: string; disabled?: boolean; trailingControl?: React.ReactNode; showSubmitButton?: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="px-4 pt-3 pb-2 shrink-0">
      <div className="flex items-center gap-1.5 mb-2">
        <label className="text-[10px] font-bold text-[#8a5d33]/60 uppercase tracking-wider">Add Asset</label>
        <div className="relative group/info">
          <button type="button" className="w-4 h-4 rounded-full bg-amber-500/10 flex items-center justify-center text-[#8a5d33]/50 hover:bg-amber-500/20 hover:text-[#8a5d33] transition-colors cursor-help">
            <Info className="w-2.5 h-2.5" />
          </button>
          <div className="absolute left-0 top-full mt-1.5 w-52 bg-white text-[#8a5d33] text-[10px] leading-relaxed px-3 py-2 rounded-lg shadow-lg border border-amber-500/20 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-150 pointer-events-none z-50">
            {infoText}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-11 flex-1 min-w-0 rounded-full border border-amber-500/30 bg-white px-5 py-2.5 text-sm text-[#3d200a] placeholder:text-[#8a5d33]/40 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/50 transition-all resize-none"
        />
        {trailingControl}
        {showSubmitButton && (
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full bg-[#8B0000] text-white transition-colors hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </form>
  );
}

// ═══════════════════════════════════════
// Counters
// ═══════════════════════════════════════
function CountBadge({ count }: { count: number }) {
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#8B0000]/10 text-[#8B0000] tabular-nums">
      {count} total
    </span>
  );
}

function normalizeVisiblePorts(ports: unknown) {
  const normalizedInput = Array.isArray(ports) ? ports : parseOpenPorts(ports);

  return Array.from(
    new Map(
      normalizedInput
        .filter((port) => Number.isFinite(port.number))
        .sort((left, right) => left.number - right.number)
        .map((port) => [`${port.number}-${port.protocol}`, port])
    ).values()
  );
}

function renderPortChips(ports: unknown, options?: { onOverflowClick?: () => void }) {
  const normalizedPorts = normalizeVisiblePorts(ports);
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
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
            port.protocol === "udp"
              ? "bg-violet-500/10 text-violet-700"
              : "bg-emerald-500/10 text-emerald-700"
          }`}
        >
          {port.number}/{port.protocol.toUpperCase()}
        </span>
      ))}
      {remainingCount > 0 && (
        options?.onOverflowClick ? (
          <button
            type="button"
            onClick={options.onOverflowClick}
            className="inline-flex items-center rounded-full bg-[#8a5d33]/10 px-2 py-0.5 text-[10px] font-bold text-[#8a5d33] transition-colors hover:bg-[#8a5d33]/18"
          >
            +{remainingCount}
          </button>
        ) : (
          <span className="inline-flex items-center rounded-full bg-[#8a5d33]/10 px-2 py-0.5 text-[10px] font-bold text-[#8a5d33]">
            +{remainingCount}
          </span>
        )
      )}
    </div>
  );
}

function ActionTooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}

function RenderResolvedIpChip({
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
    <ActionTooltip content="run ports & IP scan to see IP">
      <span className="inline-flex shrink-0 cursor-help items-center rounded-full bg-[#1d4ed8]/10 px-2 py-0.5 text-[10px] font-bold text-[#1d4ed8]">
        <span className="mr-1 inline-flex items-center">
          <TriangleAlert className="h-3 w-3" />
        </span>
        IP
      </span>
    </ActionTooltip>
  );
}

function AssetBucketChip({ bucket }: { bucket: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#8B0000]/8 px-2 py-0.5 text-[10px] font-bold text-[#8B0000]">
      <Tags className="h-3 w-3" />
      {bucket}
    </span>
  );
}

function toPortDiscoveryDrafts(entries: PortDiscoveryPresetEntry[]): PortDiscoveryEntryDraft[] {
  return entries.map((entry) => ({
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${entry.port}-${entry.title}`,
    port: entry.port,
    portDraft: String(entry.port),
    title: entry.title,
    enabled: entry.enabled,
  }));
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function AssetManagement({ org, currentUserRole, currentUserId, canManageAssets, canScan }: AssetManagementProps) {
  const orgAssets: any[] = org.assets || [];
  const portInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const portDiscoveryCompletionToastRef = useRef<string | null>(null);
  const portDiscoveryListInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const portDiscoveryActivitySignatureRef = useRef<string | null>(null);
  const {
    activity,
    createBatch,
    pendingBatchType,
    pendingBatchEngine,
    openMonitor,
  } = useScanActivity(org.id, {
    orgSlug: org.slug,
  });

  // === Root assets ===
  const [rootAssets, setRootAssets] = useState<ManagedRootAsset[]>(() => {
    return orgAssets.filter(a => a.isRoot).map(a => ({
      id: a.id,
      value: a.value,
      type: getAssetType(a.value),
      bucket: normalizeAssetBucket(a.bucket || inferAssetBucket(a.value)),
      addedAt: new Date(a.createdAt).toISOString(),
      scanning: a.scanStatus === 'scanning',
      scanStatus: a.scanStatus,
      portDiscoveryStatus: a.portDiscoveryStatus,
      resolvedIp: a.resolvedIp ?? null,
      openPorts: parseOpenPorts(a.openPorts),
      statusMessage: a.scanStatus === 'scanning' ? "Scanning in background..." : "",
      subdomains: orgAssets.filter(leaf => leaf.parentId === a.id).map(l => l.value),
    }));
  });

  // === Leaf assets ===
  const [leafAssets, setLeafAssets] = useState<ManagedLeafAsset[]>(() => {
    return orgAssets.filter(a => !a.isRoot).map(a => ({
      id: a.id,
      value: a.value,
      type: getAssetType(a.value),
      bucket: normalizeAssetBucket(a.bucket || inferAssetBucket(a.value)),
      parentId: a.parentId,
      addedAt: new Date(a.createdAt).toISOString(),
      scanStatus: a.scanStatus,
      portDiscoveryStatus: a.portDiscoveryStatus,
      resolvedIp: a.resolvedIp ?? null,
      openPorts: parseOpenPorts(a.openPorts),
    }));
  });

  // === Inputs ===
  const [rootInput, setRootInput] = useState("");
  const [leafInput, setLeafInput] = useState("");
  const [assetInputMode, setAssetInputMode] = useState<"root" | "leaf">("root");
  const [showAddModal, setShowAddModal] = useState(false);
  const [assetPorts, setAssetPorts] = useState<AssetPort[]>(createDefaultAssetPorts());
  const [assetPortDrafts, setAssetPortDrafts] = useState<string[]>(() => createDefaultAssetPorts().map((port) => String(port.number)));
  const [editingPortsAsset, setEditingPortsAsset] = useState<{ id: string; value: string; type: "root" | "leaf" } | null>(null);
  const [editingPorts, setEditingPorts] = useState<AssetPort[]>(createDefaultAssetPorts());
  const [editingPortDrafts, setEditingPortDrafts] = useState<string[]>(() => createDefaultAssetPorts().map((port) => String(port.number)));
  const [isSavingEditedPorts, setIsSavingEditedPorts] = useState(false);
  const [discoveredAssetsModal, setDiscoveredAssetsModal] = useState<{
    sourceValue: string;
    assets: Array<{ id: string; value: string; type: "domain" | "ip" | "unknown"; bucket: string; openPorts: AssetPort[] }>;
  } | null>(null);
  const [portsPreviewAsset, setPortsPreviewAsset] = useState<{
    value: string;
    type: "domain" | "ip" | "unknown";
    resolvedIp?: string | null;
    openPorts: AssetPort[];
  } | null>(null);
  const [portDiscoveryModal, setPortDiscoveryModal] = useState<PortDiscoveryModalScope | null>(null);
  const [portDiscoveryEntries, setPortDiscoveryEntries] = useState<PortDiscoveryEntryDraft[]>(
    toPortDiscoveryDrafts(createDefaultPortDiscoveryConfig().entries)
  );
  const [portDiscoveryProbeBatchSize, setPortDiscoveryProbeBatchSize] = useState(String(DEFAULT_PORT_DISCOVERY_PROBE_BATCH_SIZE));
  const [portDiscoveryProbeTimeoutMs, setPortDiscoveryProbeTimeoutMs] = useState(String(DEFAULT_PORT_DISCOVERY_PROBE_TIMEOUT_MS));
  const [isLoadingPortDiscoveryConfig, setIsLoadingPortDiscoveryConfig] = useState(false);
  const [isStartingPortDiscovery, setIsStartingPortDiscovery] = useState(false);

  // === Discovery Queue ===
  const [discoverQueue, setDiscoverQueue] = useState<string[]>([]);

  // === Search / View ===
  const [rootSearch, setRootSearch] = useState("");
  const [leafSearch, setLeafSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [bucketView, setBucketView] = useState<"flat" | "grouped">("flat");
  const [newBucketName, setNewBucketName] = useState("");
  const [editingBucketAsset, setEditingBucketAsset] = useState<{
    id: string;
    value: string;
    assetKind: "root" | "leaf";
    bucket: string;
  } | null>(null);
  const [bucketDraft, setBucketDraft] = useState("");
  const [isSavingBucket, setIsSavingBucket] = useState(false);
  const [rootOpen, setRootOpen] = useState(true);
  const [leafOpen, setLeafOpen] = useState(true);
  const hasDuplicatePortEntries = (() => {
    const seen = new Set<string>();
    for (const port of assetPorts) {
      const key = `${port.number}-${port.protocol}`;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  })();
  const hasInvalidPortDrafts = assetPortDrafts.some((draft) => {
    if (!/^\d+$/.test(draft.trim())) return true;
    const numericValue = Number(draft);
    return !Number.isInteger(numericValue) || numericValue < 1 || numericValue > 65535;
  });
  const hasDuplicateEditingPortEntries = (() => {
    const seen = new Set<string>();
    for (const port of editingPorts) {
      const key = `${port.number}-${port.protocol}`;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  })();
  const hasInvalidEditingPortDrafts = editingPortDrafts.some((draft) => {
    if (!/^\d+$/.test(draft.trim())) return true;
    const numericValue = Number(draft);
    return !Number.isInteger(numericValue) || numericValue < 1 || numericValue > 65535;
  });
  const portDiscoveryEntryIssues = (() => {
    const seenPorts = new Set<number>();
    let hasDuplicatePorts = false;
    let hasInvalidPorts = false;
    let hasEmptyTitles = false;

    for (const entry of portDiscoveryEntries) {
      const parsedPort = Number(entry.portDraft);
      if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        hasInvalidPorts = true;
      } else {
        if (seenPorts.has(parsedPort)) hasDuplicatePorts = true;
        seenPorts.add(parsedPort);
      }

      if (!entry.title.trim()) {
        hasEmptyTitles = true;
      }
    }

    return {
      hasDuplicatePorts,
      hasInvalidPorts,
      hasEmptyTitles,
      enabledCount: portDiscoveryEntries.filter((entry) => entry.enabled).length,
    };
  })();
  const hasInvalidPortDiscoveryBatchSize =
    !/^\d+$/.test(portDiscoveryProbeBatchSize.trim()) ||
    Number(portDiscoveryProbeBatchSize) < 1 ||
    Number(portDiscoveryProbeBatchSize) > MAX_PORT_DISCOVERY_PROBE_BATCH_SIZE;
  const hasInvalidPortDiscoveryTimeout =
    !/^\d+$/.test(portDiscoveryProbeTimeoutMs.trim()) ||
    Number(portDiscoveryProbeTimeoutMs) < 1 ||
    Number(portDiscoveryProbeTimeoutMs) > MAX_PORT_DISCOVERY_PROBE_TIMEOUT_MS;
  const activePortDiscoveryBatches = (activity?.activeBatches || []).filter((batch) => batch.engine === "portDiscovery");
  const activePortDiscoveryAssetIds = new Set(
    activePortDiscoveryBatches.flatMap((batch) =>
      batch.items
        .filter((item) => item.status === "pending" || item.status === "running")
        .map((item) => item.assetId)
    )
  );
  const isCreatingPortDiscoveryBatch = pendingBatchEngine === "portDiscovery" && pendingBatchType !== null;
  const portDiscoveryLocked = Boolean(activity?.lock.active);
  const scannableAssets = [...rootAssets, ...leafAssets].filter(
    (asset) => asset.type === "domain" || asset.type === "ip"
  );
  const scannableAssetIds = scannableAssets.map((asset) => asset.id);
  const hasActivePortDiscovery = activePortDiscoveryBatches.length > 0;
  const portDiscoveryActionLabel = isCreatingPortDiscoveryBatch
    ? "Starting..."
    : hasActivePortDiscovery
      ? "Discovering..."
      : "Ports";
  const portDiscoveryScopeLabel = portDiscoveryModal?.mode === "single"
    ? portDiscoveryModal.assetLabel || "Selected asset"
    : `${portDiscoveryModal?.assetIds.length || 0} assets`;
  const allManagedAssets = [...rootAssets, ...leafAssets];
  const bucketOptions = buildAssetBucketOptions(allManagedAssets);
  const visibleBucketOptions = bucketOptions.filter((bucket) =>
    allManagedAssets.some((asset) => asset.bucket === bucket)
  );
  const selectedAddBucketLabel = bucketDraft === "__auto" ? "Auto bucket" : normalizeAssetBucket(bucketDraft);
  const resolveAddBucket = (value: string) => {
    if (newBucketName.trim()) return normalizeAssetBucket(newBucketName);
    return bucketDraft === "__auto" ? inferAssetBucket(value) : normalizeAssetBucket(bucketDraft);
  };

  const resetAssetModalState = () => {
    setRootInput("");
    setLeafInput("");
    setBucketDraft("__auto");
    setNewBucketName("");
    const defaultPorts = createDefaultAssetPorts();
    setAssetPorts(defaultPorts);
    setAssetPortDrafts(defaultPorts.map((port) => String(port.number)));
  };
  const resetEditPortsState = () => {
    setEditingPortsAsset(null);
    const defaultPorts = createDefaultAssetPorts();
    setEditingPorts(defaultPorts);
    setEditingPortDrafts(defaultPorts.map((port) => String(port.number)));
    setIsSavingEditedPorts(false);
  };
  const resetPortDiscoveryModalState = useCallback(() => {
    const defaults = createDefaultPortDiscoveryConfig();
    setPortDiscoveryEntries(toPortDiscoveryDrafts(defaults.entries));
    setPortDiscoveryProbeBatchSize(String(defaults.probeBatchSize));
    setPortDiscoveryProbeTimeoutMs(String(defaults.probeTimeoutMs));
    setIsLoadingPortDiscoveryConfig(false);
    setIsStartingPortDiscovery(false);
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const response = await fetch(`/api/orgs/assets?orgId=${org.id}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.assets)) return;

      const fetchedRoots = data.assets.filter((a: any) => a.isRoot);

      setRootAssets((currentRoots) =>
        currentRoots.map((asset) => {
          const fresh = fetchedRoots.find((candidate: any) => candidate.id === asset.id);
          if (!fresh) return asset;

          return {
            ...asset,
            scanning: asset.scanning && fresh.scanStatus === "scanning",
            scanStatus: fresh.scanStatus,
            portDiscoveryStatus: fresh.portDiscoveryStatus,
            resolvedIp: fresh.resolvedIp ?? null,
            openPorts: parseOpenPorts(fresh.openPorts),
            bucket: normalizeAssetBucket(fresh.bucket || inferAssetBucket(fresh.value)),
            statusMessage: asset.scanning && fresh.scanStatus !== "scanning" ? "" : asset.statusMessage,
            subdomains: Array.from(
              new Set([
                ...asset.subdomains,
                ...data.assets.filter((leaf: any) => leaf.parentId === asset.id).map((leaf: any) => leaf.value),
              ])
            ),
          };
        })
      );

      setLeafAssets((currentLeafs) => {
        const currentIds = new Set(currentLeafs.map((asset) => asset.id));
        const updatedLeafs = currentLeafs.map((asset) => {
          const fresh = data.assets.find((candidate: any) => candidate.id === asset.id);
          return fresh
            ? {
                ...asset,
                scanStatus: fresh.scanStatus,
                portDiscoveryStatus: fresh.portDiscoveryStatus,
                resolvedIp: fresh.resolvedIp ?? null,
                openPorts: parseOpenPorts(fresh.openPorts),
                bucket: normalizeAssetBucket(fresh.bucket || inferAssetBucket(fresh.value)),
              }
            : asset;
        });

        const newLeafs = data.assets
          .filter((asset: any) => !asset.isRoot && !currentIds.has(asset.id))
          .map((asset: any) => ({
            id: asset.id,
            value: asset.value,
            type: getAssetType(asset.value),
            parentId: asset.parentId,
            addedAt: new Date(asset.createdAt).toISOString(),
            scanStatus: asset.scanStatus,
            portDiscoveryStatus: asset.portDiscoveryStatus,
            resolvedIp: asset.resolvedIp ?? null,
            openPorts: parseOpenPorts(asset.openPorts),
            bucket: normalizeAssetBucket(asset.bucket || inferAssetBucket(asset.value)),
          }));

        return newLeafs.length > 0 ? [...updatedLeafs, ...newLeafs] : updatedLeafs;
      });
    } catch {}
  }, [org.id]);

  const openPortDiscoveryModal = useCallback(async (scope: PortDiscoveryModalScope) => {
    if (!canScan) {
      toast.error("You do not have permission to run port discovery.", { position: "bottom-right" });
      return;
    }

    if (scope.assetIds.length === 0) {
      toast.error("There are no eligible assets available for port discovery.", {
        position: "bottom-right",
      });
      return;
    }

    if (activity?.activeBatches.length) {
      toast.error(activity.lock.message || "Another scan is already running. Click to view.", {
        position: "bottom-right",
        action: {
          label: "View",
          onClick: () => openMonitor(),
        },
      });
      return;
    }

    setPortDiscoveryModal(scope);
    setIsLoadingPortDiscoveryConfig(true);

    try {
      const response = await fetch(`/api/orgs/port-discovery/config?orgId=${encodeURIComponent(org.id)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load port discovery settings.");
      }

      const normalized = normalizePortDiscoveryConfig(payload?.config);
      setPortDiscoveryEntries(toPortDiscoveryDrafts(normalized.entries));
      setPortDiscoveryProbeBatchSize(String(normalized.probeBatchSize));
      setPortDiscoveryProbeTimeoutMs(String(normalized.probeTimeoutMs));
    } catch (error) {
      resetPortDiscoveryModalState();
      toast.error("Could not load port discovery settings.", {
        description: error instanceof Error ? error.message : "Please try again.",
        position: "bottom-right",
      });
    } finally {
      setIsLoadingPortDiscoveryConfig(false);
    }
  }, [activity?.activeBatches.length, activity?.lock.message, canScan, openMonitor, org.id, resetPortDiscoveryModalState]);

  const closePortDiscoveryModal = useCallback(() => {
    setPortDiscoveryModal(null);
    resetPortDiscoveryModalState();
  }, [resetPortDiscoveryModalState]);

  const openPortsPreview = (asset: {
    value: string;
    type: "domain" | "ip" | "unknown";
    resolvedIp?: string | null;
    openPorts: AssetPort[];
  }) => {
    setPortsPreviewAsset({
      value: asset.value,
      type: asset.type,
      resolvedIp: asset.resolvedIp ?? null,
      openPorts: normalizeVisiblePorts(asset.openPorts),
    });
  };

  const updatePortDiscoveryEntry = (id: string, next: Partial<PortDiscoveryEntryDraft>) => {
    setPortDiscoveryEntries((current) =>
      current.map((entry) => {
        if (entry.id !== id) return entry;
        const nextPortDraft = next.portDraft ?? entry.portDraft;
        const parsedPort = Number(nextPortDraft);
        return {
          ...entry,
          ...next,
          portDraft: nextPortDraft,
          port:
            Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535
              ? parsedPort
              : entry.port,
        };
      })
    );
  };

  const addPortDiscoveryEntry = () => {
    setPortDiscoveryEntries((current) => {
      const next = [
        ...current,
        {
          id: crypto.randomUUID(),
          port: 9000,
          portDraft: "9000",
          title: "Custom Service",
          enabled: true,
        },
      ];

      queueMicrotask(() => {
        const input = portDiscoveryListInputRefs.current[next.length - 1];
        input?.focus();
        input?.select();
      });

      return next;
    });
  };

  const removePortDiscoveryEntry = (id: string) => {
    setPortDiscoveryEntries((current) => current.filter((entry) => entry.id !== id));
  };

  const startPortDiscovery = async () => {
    if (!portDiscoveryModal || isStartingPortDiscovery) return;

    if (
      portDiscoveryEntryIssues.hasDuplicatePorts ||
      portDiscoveryEntryIssues.hasInvalidPorts ||
      portDiscoveryEntryIssues.hasEmptyTitles ||
      portDiscoveryEntryIssues.enabledCount === 0 ||
      hasInvalidPortDiscoveryBatchSize ||
      hasInvalidPortDiscoveryTimeout
    ) {
      toast.error("Fix the port discovery settings before starting.", {
        position: "bottom-right",
      });
      return;
    }

    const config = normalizePortDiscoveryConfig({
      entries: portDiscoveryEntries.map((entry) => ({
        port: Number(entry.portDraft),
        title: entry.title,
        enabled: entry.enabled,
      })),
      probeBatchSize: Number(portDiscoveryProbeBatchSize),
      probeTimeoutMs: Number(portDiscoveryProbeTimeoutMs),
    });

    setIsStartingPortDiscovery(true);

    try {
      const saveResponse = await fetch("/api/orgs/port-discovery/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          entries: config.entries,
          probeBatchSize: config.probeBatchSize,
          probeTimeoutMs: config.probeTimeoutMs,
        }),
      });

      const savePayload = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) {
        throw new Error(savePayload?.error || "Failed to save port discovery settings.");
      }

      const result = await createBatch({
        engine: "portDiscovery",
        type: portDiscoveryModal.mode === "single" ? "single" : "full",
        assetIds: portDiscoveryModal.assetIds,
        configSnapshot: config,
      });

      if (!result.ok) {
        throw new Error(result.error || "Failed to start port discovery.");
      }

      closePortDiscoveryModal();
      await fetchAssets();
    } catch (error) {
      toast.error("Port discovery could not be started.", {
        description: error instanceof Error ? error.message : "Please try again.",
        position: "bottom-right",
      });
    } finally {
      setIsStartingPortDiscovery(false);
    }
  };

  // === Handlers ===
  const addRootAssets = () => {
    const rawVal = rootInput;
    if (!rawVal.trim() || hasDuplicatePortEntries || hasInvalidPortDrafts) return;
    
    // Split by commas, spaces, or newlines
    const values = rawVal.split(/[\s,]+/).map(v => v.trim().toLowerCase()).filter(v => v);
    const newAssets: any[] = [];
    
    values.forEach((val) => {
      const type = getAssetType(val);
      if (type === "unknown") return; // invalid input
      if (rootAssets.some((a) => a.value === val)) return; // duplicate
      if (newAssets.some((a) => a.value === val)) return; // duplicate in this batch
      const bucket = resolveAddBucket(val);
      
      const assetId = `root-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      newAssets.push({
        id: assetId,
        value: val,
        type,
        bucket,
        addedAt: new Date().toISOString(),
        scanning: false,
        scanStatus: "idle",
        portDiscoveryStatus: "idle",
        resolvedIp: null,
        openPorts: assetPorts.map((port) => ({ ...port })),
        subdomains: [],
      });
      
      // Call API async (non-blocking for UI)
      fetch(`/api/orgs/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, value: val, type, isRoot: true, openPorts: assetPorts, bucket })
      }).then(res => res.json()).then(data => {
         if(data.asset) {
            setRootAssets(prev => prev.map(a => a.id === assetId ? { ...a, id: data.asset.id, bucket: data.asset.bucket || bucket } : a));
         }
      }).catch(console.error);
    });

    if (newAssets.length > 0) {
      setRootAssets(prev => [...prev, ...newAssets]);
    }
    resetAssetModalState();
    return newAssets.length > 0;
  };

  const addLeafAssets = () => {
    const rawVal = leafInput;
    if (!rawVal.trim() || hasDuplicatePortEntries || hasInvalidPortDrafts) return;

    const values = rawVal.split(/[\s,]+/).map(v => v.trim().toLowerCase()).filter(v => v);
    const newAssets: any[] = [];

    values.forEach((val) => {
      const type = getAssetType(val);
      if (type === "unknown") return;
      if (leafAssets.some((a) => a.value === val)) return;
      if (newAssets.some((a) => a.value === val)) return;
      const bucket = resolveAddBucket(val);
      
      const assetId = `leaf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      newAssets.push({
        id: assetId,
        value: val,
        type,
        bucket,
        parentId: null,
        addedAt: new Date().toISOString(),
        scanStatus: "idle",
        portDiscoveryStatus: "idle",
        resolvedIp: null,
        openPorts: assetPorts.map((port) => ({ ...port })),
      });

      // Call API approx
      fetch(`/api/orgs/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, value: val, type, isRoot: false, parentId: null, openPorts: assetPorts, bucket })
      }).then(res => res.json()).then(data => {
         if(data.asset) {
            setLeafAssets(prev => prev.map(a => a.id === assetId ? { ...a, id: data.asset.id, bucket: data.asset.bucket || bucket } : a));
         }
      }).catch(console.error);
    });

    if (newAssets.length > 0) {
      setLeafAssets(prev => [...prev, ...newAssets]);
    }
    resetAssetModalState();
    return newAssets.length > 0;
  };

  const handleAddRootAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const added = addRootAssets();
    if (added) setShowAddModal(false);
  };

  const handleAddLeafAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const added = addLeafAssets();
    if (added) setShowAddModal(false);
  };

  const updateModalPort = (index: number, next: Partial<AssetPort>) => {
    setAssetPorts((current) =>
      current.map((port, portIndex) =>
        portIndex === index
          ? {
              ...port,
              ...next,
              number:
                next.number !== undefined
                  ? Math.min(65535, Math.max(1, Number(next.number) || 1))
                  : port.number,
            }
          : port
      )
    );
  };

  const updateModalPortDraft = (index: number, nextDraft: string) => {
    if (!/^\d*$/.test(nextDraft)) return;

    setAssetPortDrafts((current) => current.map((draft, draftIndex) => (draftIndex === index ? nextDraft : draft)));

    if (nextDraft.trim().length === 0) return;

    const numericValue = Number(nextDraft);
    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 65535) return;
    updateModalPort(index, { number: numericValue });
  };

  const commitModalPortDraft = (index: number) => {
    const draft = assetPortDrafts[index]?.trim() || "";
    const fallback = assetPorts[index]?.number ?? 443;
    const numericValue = /^\d+$/.test(draft) ? Number(draft) : fallback;
    const normalized = Number.isInteger(numericValue) ? Math.min(65535, Math.max(1, numericValue)) : fallback;

    setAssetPortDrafts((current) => current.map((value, valueIndex) => (valueIndex === index ? String(normalized) : value)));
    updateModalPort(index, { number: normalized });
  };

  const addModalPortRow = () => {
    setAssetPorts((current) => {
      const nextPorts = [...current, { number: 80, protocol: "tcp" as const }];
      const nextIndex = nextPorts.length - 1;
      queueMicrotask(() => {
        const input = portInputRefs.current[nextIndex];
        input?.focus();
        input?.select();
      });
      return nextPorts;
    });
    setAssetPortDrafts((current) => [...current, "80"]);
  };

  const removeModalPortRow = (index: number) => {
    setAssetPorts((current) => {
      if (current.length === 1) return createDefaultAssetPorts();
      return current.filter((_, portIndex) => portIndex !== index);
    });
    setAssetPortDrafts((current) => {
      if (current.length === 1) return createDefaultAssetPorts().map((port) => String(port.number));
      return current.filter((_, portIndex) => portIndex !== index);
    });
  };

  const openEditPortsModal = (asset: { id: string; value: string; openPorts: AssetPort[] }, type: "root" | "leaf") => {
    const clonedPorts = asset.openPorts.map((port) => ({ ...port }));
    setEditingPortsAsset({ id: asset.id, value: asset.value, type });
    setEditingPorts(clonedPorts);
    setEditingPortDrafts(clonedPorts.map((port) => String(port.number)));
    queueMicrotask(() => {
      const input = portInputRefs.current[0];
      input?.focus();
      input?.select();
    });
  };

  const updateEditingPort = (index: number, next: Partial<AssetPort>) => {
    setEditingPorts((current) =>
      current.map((port, portIndex) =>
        portIndex === index
          ? {
              ...port,
              ...next,
              number:
                next.number !== undefined
                  ? Math.min(65535, Math.max(1, Number(next.number) || 1))
                  : port.number,
            }
          : port
      )
    );
  };

  const updateEditingPortDraft = (index: number, nextDraft: string) => {
    if (!/^\d*$/.test(nextDraft)) return;

    setEditingPortDrafts((current) => current.map((draft, draftIndex) => (draftIndex === index ? nextDraft : draft)));

    if (nextDraft.trim().length === 0) return;

    const numericValue = Number(nextDraft);
    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 65535) return;
    updateEditingPort(index, { number: numericValue });
  };

  const commitEditingPortDraft = (index: number) => {
    const draft = editingPortDrafts[index]?.trim() || "";
    const fallback = editingPorts[index]?.number ?? 443;
    const numericValue = /^\d+$/.test(draft) ? Number(draft) : fallback;
    const normalized = Number.isInteger(numericValue) ? Math.min(65535, Math.max(1, numericValue)) : fallback;

    setEditingPortDrafts((current) => current.map((value, valueIndex) => (valueIndex === index ? String(normalized) : value)));
    updateEditingPort(index, { number: normalized });
  };

  const addEditingPortRow = () => {
    setEditingPorts((current) => {
      const nextPorts = [...current, { number: 80, protocol: "tcp" as const }];
      const nextIndex = nextPorts.length - 1;
      queueMicrotask(() => {
        const input = portInputRefs.current[nextIndex];
        input?.focus();
        input?.select();
      });
      return nextPorts;
    });
    setEditingPortDrafts((current) => [...current, "80"]);
  };

  const removeEditingPortRow = (index: number) => {
    setEditingPorts((current) => {
      if (current.length === 1) return createDefaultAssetPorts();
      return current.filter((_, portIndex) => portIndex !== index);
    });
    setEditingPortDrafts((current) => {
      if (current.length === 1) return createDefaultAssetPorts().map((port) => String(port.number));
      return current.filter((_, portIndex) => portIndex !== index);
    });
  };

  const saveEditedPorts = async () => {
    if (!editingPortsAsset || hasDuplicateEditingPortEntries || hasInvalidEditingPortDrafts || isSavingEditedPorts) return;

    const targetAsset = editingPortsAsset;
    const nextPorts = editingPorts.map((port) => ({ ...port }));
    const previousRootAssets = rootAssets;
    const previousLeafAssets = leafAssets;
    const previousDiscoveredAssetsModal = discoveredAssetsModal;

    if (targetAsset.type === "root") {
      setRootAssets((current) => current.map((asset) => (asset.id === targetAsset.id ? { ...asset, openPorts: nextPorts } : asset)));
    } else {
      setLeafAssets((current) => current.map((asset) => (asset.id === targetAsset.id ? { ...asset, openPorts: nextPorts } : asset)));
    }
    setDiscoveredAssetsModal((current) => {
      if (!current) return current;
      if (!current.assets.some((asset) => asset.id === targetAsset.id)) return current;

      return {
        ...current,
        assets: current.assets.map((asset) =>
          asset.id === targetAsset.id ? { ...asset, openPorts: nextPorts } : asset
        ),
      };
    });

    setIsSavingEditedPorts(true);

    try {
      const response = await fetch(`/api/orgs/assets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, id: targetAsset.id, openPorts: nextPorts }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save ports.");
      }

      toast.success("Ports saved.", {
        description: `${targetAsset.value} updated successfully.`,
        position: "bottom-right",
      });
      resetEditPortsState();
    } catch (error) {
      console.error(error);
      setRootAssets(previousRootAssets);
      setLeafAssets(previousLeafAssets);
      setDiscoveredAssetsModal(previousDiscoveredAssetsModal);
      toast.error("Could not save ports.", {
        description: error instanceof Error ? error.message : "Something went wrong while saving ports.",
      });
      setIsSavingEditedPorts(false);
      return;
    }
  };

  const openEditBucketModal = (asset: { id: string; value: string; bucket: string }, assetKind: "root" | "leaf") => {
    setEditingBucketAsset({
      id: asset.id,
      value: asset.value,
      bucket: normalizeAssetBucket(asset.bucket),
      assetKind,
    });
    setBucketDraft(normalizeAssetBucket(asset.bucket));
    setNewBucketName("");
  };

  const closeEditBucketModal = () => {
    setEditingBucketAsset(null);
    setBucketDraft("__auto");
    setNewBucketName("");
    setIsSavingBucket(false);
  };

  const resolveBucketDraft = () => {
    if (newBucketName.trim()) return normalizeAssetBucket(newBucketName);
    if (bucketDraft === "__auto" && editingBucketAsset) return inferAssetBucket(editingBucketAsset.value);
    if (bucketDraft === "__auto") return DEFAULT_ASSET_BUCKET;
    return normalizeAssetBucket(bucketDraft);
  };

  const saveEditedBucket = async () => {
    if (!editingBucketAsset || isSavingBucket) return;

    const nextBucket = resolveBucketDraft();
    const targetAsset = editingBucketAsset;
    const previousRootAssets = rootAssets;
    const previousLeafAssets = leafAssets;
    const previousDiscoveredAssetsModal = discoveredAssetsModal;

    if (targetAsset.assetKind === "root") {
      setRootAssets((current) => current.map((asset) => (asset.id === targetAsset.id ? { ...asset, bucket: nextBucket } : asset)));
    } else {
      setLeafAssets((current) => current.map((asset) => (asset.id === targetAsset.id ? { ...asset, bucket: nextBucket } : asset)));
    }
    setDiscoveredAssetsModal((current) => {
      if (!current) return current;
      return {
        ...current,
        assets: current.assets.map((asset) =>
          asset.id === targetAsset.id ? { ...asset, bucket: nextBucket } : asset
        ),
      };
    });

    setIsSavingBucket(true);

    try {
      const response = await fetch(`/api/orgs/assets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, id: targetAsset.id, bucket: nextBucket }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save bucket.");
      }

      toast.success("Bucket saved.", {
        description: `${targetAsset.value} moved to ${nextBucket}.`,
        position: "bottom-right",
      });
      closeEditBucketModal();
    } catch (error) {
      setRootAssets(previousRootAssets);
      setLeafAssets(previousLeafAssets);
      setDiscoveredAssetsModal(previousDiscoveredAssetsModal);
      toast.error("Could not save bucket.", {
        description: error instanceof Error ? error.message : "Something went wrong while saving the bucket.",
      });
      setIsSavingBucket(false);
    }
  };

  const handleRemoveRoot = (id: string) => {
    setRootAssets(rootAssets.filter((a) => a.id !== id));
    setLeafAssets(leafAssets.filter((a) => a.parentId !== id));
    
    fetch(`/api/orgs/assets?id=${id}&orgId=${org.id}`, { method: 'DELETE' }).catch(console.error);
  };

  const handleRemoveLeaf = (id: string) => {
    setLeafAssets(leafAssets.filter((a) => a.id !== id));
    fetch(`/api/orgs/assets?id=${id}&orgId=${org.id}`, { method: 'DELETE' }).catch(console.error);
  };

  // === Queue Processor ===
  useEffect(() => {
    const activeCount = rootAssets.filter(a => a.scanning).length;
    if (activeCount < 2 && discoverQueue.length > 0) {
      const nextId = discoverQueue[0];
      setDiscoverQueue(q => q.slice(1));
      startDiscovery(nextId);
    }
  }, [discoverQueue, rootAssets]);

  const handleScanSubdomains = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (rootAssets.find(a => a.id === id)?.scanning) return;
    const asset = rootAssets.find((a) => a.id === id);
    setDiscoverQueue(q => q.includes(id) ? q : [...q, id]);
    if (asset) {
      toast.info("Subdomain discovery started.", {
        description: `Scanning ${asset.value} for subdomains.`,
        position: "bottom-right",
      });
    }
  };

  const openDiscoveredAssetsModal = (
    sourceValue: string,
    assets: Array<{ id: string; value: string; type: "domain" | "ip" | "unknown"; bucket: string; openPorts: AssetPort[] }>
  ) => {
    setDiscoveredAssetsModal({ sourceValue, assets });
  };

  const showDiscoveryCompletionToast = (
    sourceValue: string,
    discoveredAssets: Array<{ id: string; value: string; type: "domain" | "ip" | "unknown"; bucket: string; openPorts: AssetPort[] }>
  ) => {
    const discoveredCount = discoveredAssets.length;
    toast.custom(
      (toastId) => (
        <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white px-4 py-3 text-emerald-700 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold tracking-tight text-emerald-700">Subdomain discovery completed</p>
                <p className="mt-1 text-sm leading-relaxed text-emerald-700/90">
                  <span className="font-semibold">{sourceValue}</span>
                <span>: {discoveredCount} </span>
                <button
                  type="button"
                  className="rounded-full px-2 py-0.5 font-bold text-[#7a0010] underline decoration-[#7a0010]/70 underline-offset-2 transition-colors hover:bg-[#7a0010]/8"
                  onClick={() => {
                    openDiscoveredAssetsModal(sourceValue, discoveredAssets);
                    toast.dismiss(toastId);
                  }}
                >
                  new
                </button>
                <span> discovered.</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              onClick={() => toast.dismiss(toastId)}
              aria-label="Dismiss discovery toast"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ),
      {
        position: "bottom-right",
        duration: 5000,
        style: {
          background: "transparent",
          border: "none",
          boxShadow: "none",
          padding: "0",
        },
      }
    );
  };

  const startDiscovery = (id: string) => {
    setRootAssets(prev => prev.map(a => a.id === id ? { ...a, scanning: true, statusMessage: "Initializing stream..." } : a));
    
    const es = new EventSource(`/api/orgs/discover?assetId=${id}&orgId=${org.id}`);
    
    es.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data);
        setRootAssets(prev => prev.map(a => a.id === id ? { ...a, statusMessage: data.message } : a));
      } catch(err){}
    });

    es.addEventListener("ping", (e) => {
      try {
        const data = JSON.parse(e.data);
        setRootAssets(prev => prev.map(a => a.id === id ? { ...a, statusMessage: data.message } : a));
      } catch(err){}
    });

    es.addEventListener("done", (e) => {
      try {
        const data = JSON.parse(e.data);
        const asset = rootAssets.find((a) => a.id === id);
        if (data.subdomains && data.subdomains.length > 0) {
          const discoveredAssets = data.subdomains.map((subAsset: any) => ({
            id: subAsset.id,
            value: subAsset.value,
            type: getAssetType(subAsset.value),
            bucket: normalizeAssetBucket(subAsset.bucket || inferAssetBucket(subAsset.value)),
            openPorts: parseOpenPorts(subAsset.openPorts),
          }));
          setLeafAssets(prev => {
             const existing = new Set(prev.map(p => p.value));
             const newLeafs = data.subdomains
               .filter((s:any) => !existing.has(s.value))
               .map((s: any) => ({
                 ...s,
                 type: getAssetType(s.value),
                 bucket: normalizeAssetBucket(s.bucket || inferAssetBucket(s.value)),
                 openPorts: parseOpenPorts(s.openPorts),
               }));
             return [...prev, ...newLeafs];
          });
          setRootAssets(prev => prev.map(a => a.id === id ? { 
            ...a, 
            scanning: false, 
            statusMessage: "", 
            subdomains: Array.from(new Set([...a.subdomains, ...data.subdomains.map((s:any)=>s.value)]))
          } : a));
          showDiscoveryCompletionToast(asset?.value || "Asset", discoveredAssets);
        } else {
          setRootAssets(prev => prev.map(a => a.id === id ? { ...a, scanning: false, statusMessage: "No subdomains found" } : a));
          showDiscoveryCompletionToast(asset?.value || "Asset", []);
          setTimeout(() => {
            setRootAssets(prev => prev.map(a => a.id === id ? { ...a, statusMessage: "" } : a));
          }, 5000);
        }
      } catch(err) {
        setRootAssets(prev => prev.map(a => a.id === id ? { ...a, scanning: false, statusMessage: "" } : a));
      }
      es.close();
    });

    es.addEventListener("error", (e) => {
      let msg = "Connection error";
      let code = "";
      try { 
        const d = JSON.parse((e as unknown as MessageEvent).data); 
        if(d.message) msg = d.message; 
        if (d.code) code = d.code;
      } catch (err) {}
      
      setRootAssets(prev => prev.map(a => a.id === id ? { ...a, scanning: false, statusMessage: msg } : a));

      const serviceDown =
        code === "SUBFINDER_UNAVAILABLE" ||
        /subfinder failed|fetch failed|connection refused|service unavailable|econnrefused|enotfound/i.test(msg);

      if (serviceDown) {
        toast.error("Subdomain discovery is unavailable.", {
          description: "The Subfinder server appears to be down. Please contact support to turn on the Subfinder server.",
          position: "bottom-right",
        });
      } else {
        toast.error("Subdomain discovery failed.", {
          description: msg,
          position: "bottom-right",
        });
      }

      setTimeout(() => {
        setRootAssets(prev => prev.map(a => a.id === id ? { ...a, statusMessage: "" } : a));
      }, 5000);
      
      es.close();
    });
  };

  // === Background Sync ===
  useEffect(() => {
    const interval = setInterval(() => {
      let shouldPoll = false;
      setRootAssets(prev => {
        shouldPoll = prev.some(a => a.scanning) || activePortDiscoveryBatches.length > 0;
        return prev;
      });

      if (!shouldPoll) return;

      void fetchAssets();
    }, 5000);

    return () => clearInterval(interval);
  }, [activePortDiscoveryBatches.length, fetchAssets, org.id]);

  // === Filtered lists ===
  const filteredRoot = rootAssets.filter((a) =>
    (bucketFilter === "all" || a.bucket === bucketFilter) &&
    (a.value.toLowerCase().includes(rootSearch.toLowerCase()) ||
      a.bucket.toLowerCase().includes(rootSearch.toLowerCase()))
  );
  const filteredLeaf = leafAssets.filter((a) =>
    (bucketFilter === "all" || a.bucket === bucketFilter) &&
    (a.value.toLowerCase().includes(leafSearch.toLowerCase()) ||
      a.bucket.toLowerCase().includes(leafSearch.toLowerCase()))
  );
  const discoverableRootDomains = rootAssets.filter(
    (asset) => asset.type === "domain" && !asset.scanning && !discoverQueue.includes(asset.id)
  );
  const bulkDiscoveryInProgress = rootAssets.some(
    (asset) => asset.type === "domain" && (asset.scanning || discoverQueue.includes(asset.id))
  );

  useEffect(() => {
    const signature = activePortDiscoveryBatches
      .map((batch) => `${batch.id}:${batch.status}:${batch.percentComplete}:${batch.runningAssets}:${batch.pendingAssets}:${batch.completedAssets}:${batch.failedAssets}`)
      .join("|");

    if (!signature) {
      portDiscoveryActivitySignatureRef.current = null;
      return;
    }

    if (portDiscoveryActivitySignatureRef.current !== signature) {
      portDiscoveryActivitySignatureRef.current = signature;
      void fetchAssets();
    }
  }, [activePortDiscoveryBatches, fetchAssets]);

  useEffect(() => {
    const latestCompletedPortBatch =
      activity?.latestCompletedBatch?.engine === "portDiscovery" ? activity.latestCompletedBatch : null;

    if (!latestCompletedPortBatch) return;
    if (portDiscoveryCompletionToastRef.current === latestCompletedPortBatch.id) return;

    portDiscoveryCompletionToastRef.current = latestCompletedPortBatch.id;

    if (latestCompletedPortBatch.status === "completed") {
      toast.success("Port discovery completed.", {
        description: `${latestCompletedPortBatch.completedAssets} assets updated successfully.`,
        position: "bottom-right",
      });
    } else if (latestCompletedPortBatch.status === "failed") {
      toast.error("Port discovery finished with issues.", {
        description: "Check the activity monitor for timeout, DNS, or service errors.",
        position: "bottom-right",
      });
    }

    void fetchAssets();
  }, [activity?.latestCompletedBatch, fetchAssets]);

  // === Render Asset Row (Root) ===
  const renderRootAssetRow = (asset: typeof rootAssets[0]) => {
    const Icon = getAssetIcon(asset.type);
    const isDnsExpired = asset.scanStatus === "expired" || asset.portDiscoveryStatus === "expired";
    const isPortDiscoveryRunning = activePortDiscoveryAssetIds.has(asset.id);
    return (
      <div
        key={asset.id}
        className="group flex items-center justify-between border-b border-dotted border-[#8B0000]/20 px-4 py-3 transition-colors hover:bg-[#8B0000]/[0.035] last:border-b-0"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            asset.type === "domain" 
              ? "bg-emerald-50 text-emerald-600" 
              : "bg-blue-50 text-blue-600"
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className={`truncate text-sm font-semibold ${isDnsExpired ? "text-red-600" : "text-[#3d200a]"}`}>{asset.value}</p>
              <AssetBucketChip bucket={asset.bucket} />
              <RenderResolvedIpChip value={asset.value} type={asset.type} resolvedIp={asset.resolvedIp} />
              {isDnsExpired && (
                <ActionTooltip content="The domain was not found in DNS.">
                  <span className="inline-flex shrink-0 cursor-help items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    <TriangleAlert className="h-3 w-3" />
                  </span>
                </ActionTooltip>
              )}
            </div>
            <div className="flex items-center gap-2">
              {renderPortChips(asset.openPorts, {
                onOverflowClick:
                  normalizeVisiblePorts(asset.openPorts).length > 4 ? () => openPortsPreview(asset) : undefined,
              })}
              {asset.subdomains.length > 0 && (
                <span className="text-[9px] font-bold text-[#8a5d33]/50">
                  {asset.subdomains.length} sub{asset.subdomains.length > 1 ? "s" : ""}
                </span>
              )}
              {asset.statusMessage && (
                <span className="text-[9px] font-bold text-[#8B0000] animate-pulse max-w-[120px] truncate">
                  {asset.statusMessage}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <ActionTooltip content="Open asset explorer">
            <Link
              href={`/app/${org.slug}/asset/${asset.id}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-linear-to-r from-[#f5cf58] to-[#eab308] text-[#5a3500] opacity-0 shadow-sm transition-all hover:brightness-105 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Telescope className="h-3.5 w-3.5" />
            </Link>
          </ActionTooltip>
          {canManageAssets && (
            <ActionTooltip content="Edit bucket">
              <button
                type="button"
                onClick={() => openEditBucketModal(asset, "root")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#8B0000]/15 bg-white text-[#8B0000] opacity-0 transition-all hover:bg-[#8B0000]/8 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Tags className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
          )}
          {canManageAssets && (
            <ActionTooltip content="Edit ports">
              <button
                type="button"
                onClick={() => openEditPortsModal(asset, "root")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/30 bg-white text-[#8a5d33] opacity-0 transition-all hover:bg-amber-50 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
          )}
              <ActionTooltip content="Discover open Ports & IP address">
            <button
              type="button"
              onClick={() => openPortDiscoveryModal({ mode: "single", assetIds: [asset.id], assetLabel: asset.value })}
              disabled={!canScan || isCreatingPortDiscoveryBatch || isLoadingPortDiscoveryConfig}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1e3a8a] text-white opacity-0 transition-all hover:bg-[#1d4ed8] group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPortDiscoveryRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}
            </button>
          </ActionTooltip>
          {asset.type === "domain" && canManageAssets && (
            <ActionTooltip content="Discover subdomains">
              <button
                onClick={(e) => handleScanSubdomains(asset.id, e)}
                disabled={asset.scanning || discoverQueue.includes(asset.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#8B0000]/20 bg-white text-[#8B0000] opacity-0 transition-all hover:bg-[#8B0000]/8 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50 cursor-pointer"
              >
                {asset.scanning || discoverQueue.includes(asset.id) ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Network className="w-3.5 h-3.5" />
                )}
              </button>
            </ActionTooltip>
          )}

          {/* Remove */}
          {canManageAssets && (
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveRoot(asset.id); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
              title="Remove asset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // === Render Asset Row (Leaf) ===
  const renderLeafAssetRow = (asset: typeof leafAssets[0]) => {
    const Icon = getAssetIcon(asset.type);
    const isDnsExpired = asset.scanStatus === "expired" || asset.portDiscoveryStatus === "expired";
    const isPortDiscoveryRunning = activePortDiscoveryAssetIds.has(asset.id);
    return (
      <div
        key={asset.id}
        className="group flex items-center justify-between border-b border-dotted border-[#8B0000]/20 px-4 py-3 transition-colors hover:bg-[#8B0000]/[0.035] last:border-b-0"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            asset.type === "domain"
              ? "bg-teal-50 text-teal-600"
              : "bg-indigo-50 text-indigo-600"
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className={`truncate text-sm font-semibold ${isDnsExpired ? "text-red-600" : "text-[#3d200a]"}`}>{asset.value}</p>
              <AssetBucketChip bucket={asset.bucket} />
              <RenderResolvedIpChip value={asset.value} type={asset.type} resolvedIp={asset.resolvedIp} />
              {isDnsExpired && (
                <ActionTooltip content="The domain was not found in DNS.">
                  <span className="inline-flex shrink-0 cursor-help items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    <TriangleAlert className="h-3 w-3" />
                  </span>
                </ActionTooltip>
              )}
            </div>
            <div className="flex items-center gap-2">
              {renderPortChips(asset.openPorts, {
                onOverflowClick:
                  normalizeVisiblePorts(asset.openPorts).length > 4 ? () => openPortsPreview(asset) : undefined,
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <ActionTooltip content="Open asset explorer">
            <Link
              href={`/app/${org.slug}/asset/${asset.id}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-linear-to-r from-[#f5cf58] to-[#eab308] text-[#5a3500] opacity-0 shadow-sm transition-all hover:brightness-105 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Telescope className="h-3.5 w-3.5" />
            </Link>
          </ActionTooltip>
          {canManageAssets && (
            <ActionTooltip content="Edit bucket">
              <button
                type="button"
                onClick={() => openEditBucketModal(asset, "leaf")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#8B0000]/15 bg-white text-[#8B0000] opacity-0 transition-all hover:bg-[#8B0000]/8 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Tags className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
          )}
          {canManageAssets && (
            <ActionTooltip content="Edit ports">
              <button
                type="button"
                onClick={() => openEditPortsModal(asset, "leaf")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/30 bg-white text-[#8a5d33] opacity-0 transition-all hover:bg-amber-50 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
          )}
          <ActionTooltip content="Discover open Ports & IP address">
            <button
              type="button"
              onClick={() => openPortDiscoveryModal({ mode: "single", assetIds: [asset.id], assetLabel: asset.value })}
              disabled={!canScan || isCreatingPortDiscoveryBatch || isLoadingPortDiscoveryConfig}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1e3a8a] text-white opacity-0 transition-all hover:bg-[#1d4ed8] group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPortDiscoveryRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}
            </button>
          </ActionTooltip>
          {asset.type === "domain" && canManageAssets && (
            <ActionTooltip content="Discover subdomains">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#8B0000]/20 bg-white text-[#8B0000] opacity-0 transition-all hover:bg-[#8B0000]/8 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Network className="w-3.5 h-3.5" />
              </button>
            </ActionTooltip>
          )}
          {canManageAssets && (
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveLeaf(asset.id); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
              title="Remove asset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderGroupedAssets = <Asset extends { id: string; bucket: string }>(
    assets: Asset[],
    renderAssetRow: (asset: Asset) => React.ReactNode
  ) => {
    const grouped = assets.reduce<Record<string, Asset[]>>((groups, asset) => {
      const bucket = normalizeAssetBucket(asset.bucket);
      groups[bucket] = groups[bucket] || [];
      groups[bucket].push(asset);
      return groups;
    }, {});

    return Object.entries(grouped)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bucket, bucketAssets]) => (
        <div key={bucket} className="mb-4 overflow-hidden rounded-xl border border-amber-500/15 bg-white/70">
          <div className="flex items-center justify-between border-b border-amber-500/10 bg-[#fff7ea] px-4 py-2">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold text-[#3d200a]">
              <Tags className="h-3.5 w-3.5 text-[#8B0000]" />
              {bucket}
            </span>
            <span className="text-[10px] font-bold text-[#8a5d33]/70">{bucketAssets.length} assets</span>
          </div>
          <div>{bucketAssets.map(renderAssetRow)}</div>
        </div>
      ));
  };

  return (
    <TooltipProvider>
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-amber-300/40 bg-white/80 shadow-sm backdrop-blur-sm">
      <div className="border-b border-amber-500/10 bg-[#fdf8f0] px-5 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#3d200a]">Assets</h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/40 bg-white text-[#8a5d33] transition-colors hover:bg-amber-50 hover:text-[#3d200a]"
                    aria-label="Asset inventory help"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={10}
                  className="max-w-[280px] rounded-2xl border border-[#f2c7b0]/30 bg-linear-to-br from-[#5f0b16] via-[#7b1020] to-[#3f0811] px-4 py-3 text-left text-sm font-semibold leading-6 tracking-normal text-white shadow-[0_18px_40px_rgba(63,8,17,0.35)]"
                >
                  <div className="whitespace-pre-line text-white/95">
                    {"Add and discover domains,\nsubdomains, IP addresses,\nand open ports."}
                  </div>
                </TooltipContent>
              </Tooltip>
              <CountBadge count={rootAssets.length + leafAssets.length} />
            </div>
            <div className="flex items-center gap-2">
              <Select value={bucketFilter} onValueChange={setBucketFilter}>
                <SelectTrigger className="h-10 min-w-[168px] rounded-full border border-amber-500/20 bg-white px-4 text-xs font-bold shadow-sm">
                  <SelectValue placeholder="All buckets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buckets</SelectItem>
                  {PREDEFINED_ASSET_BUCKETS.map((bucket) => (
                    <SelectItem key={bucket} value={bucket}>{bucket}</SelectItem>
                  ))}
                  {visibleBucketOptions
                    .filter((bucket) => !PREDEFINED_ASSET_BUCKETS.includes(bucket as any))
                    .map((bucket) => (
                      <SelectItem key={bucket} value={bucket}>{bucket}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => setBucketView((current) => (current === "flat" ? "grouped" : "flat"))}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-amber-300/50 bg-white px-4 text-xs font-bold text-[#8B0000] shadow-sm transition-colors hover:bg-amber-50"
              >
                <Tags className="h-3.5 w-3.5" />
                {bucketView === "flat" ? "Group Buckets" : "Flat List"}
              </button>
              {canManageAssets && (
                <ActionTooltip content="Add asset">
                  <button
                    type="button"
                    onClick={() => {
                      resetAssetModalState();
                      setShowAddModal(true);
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#15803d] text-white shadow-sm transition-all hover:bg-[#166534]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </ActionTooltip>
              )}
              <ActionTooltip content="Discover all open ports of all assets">
                <button
                  type="button"
                  onClick={() => openPortDiscoveryModal({ mode: "full", assetIds: scannableAssetIds, assetLabel: null })}
                  disabled={!canScan || scannableAssetIds.length === 0 || isLoadingPortDiscoveryConfig}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1e3a8a] px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {hasActivePortDiscovery || isCreatingPortDiscoveryBatch ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Server className="h-3.5 w-3.5" />
                  )}
                  {portDiscoveryActionLabel}
                </button>
              </ActionTooltip>
              <Link
                href={`/app/${org.slug}/explore`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-amber-300 bg-linear-to-r from-[#f5cf58] to-[#eab308] px-4 text-xs font-bold text-[#5a3500] shadow-sm transition-all hover:brightness-105"
              >
                <Telescope className="h-3.5 w-3.5" />
                Open Explorer
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-amber-500/10">
          <div className="px-0 py-0">
            <div
              className="flex cursor-pointer flex-col gap-3 bg-amber-50/80 px-5 py-3 transition-colors hover:bg-amber-100/70 sm:flex-row sm:items-center sm:justify-between"
              onClick={() => setRootOpen((current) => !current)}
            >
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between text-left text-sm font-extrabold uppercase tracking-wider text-[#3d200a]"
              >
                <span className="flex items-center gap-2">
                  {rootOpen ? <ChevronUp className="h-4 w-4 text-[#8a5d33]" /> : <ChevronDown className="h-4 w-4 text-[#8a5d33]" />}
                  <span>Root Domains</span>
                  <CountBadge count={rootAssets.length} />
                </span>
                <span />
              </button>

              {rootOpen && (
                <div
                  className="flex w-full cursor-default flex-col justify-end gap-2 sm:w-auto sm:flex-row sm:items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {canManageAssets && rootAssets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        discoverableRootDomains.forEach(a => handleScanSubdomains(a.id));
                      }}
                      disabled={discoverableRootDomains.length === 0 || bulkDiscoveryInProgress}
                      className="inline-flex whitespace-nowrap items-center justify-center gap-2 rounded-full bg-[#8B0000] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bulkDiscoveryInProgress ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Network className="h-3.5 w-3.5" />
                      )}
                      {bulkDiscoveryInProgress ? "Discovering..." : "Discover All"}
                    </button>
                  )}
                  <div className="relative w-full sm:w-[260px]">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a5d33]/30" />
                    <input
                      type="text"
                      value={rootSearch}
                      onChange={(e) => setRootSearch(e.target.value)}
                      placeholder="Search root domains..."
                      className="w-full rounded-xl border border-amber-500/15 bg-amber-50/50 py-2 pl-9 pr-3 text-xs text-[#3d200a] placeholder:text-[#8a5d33]/30 transition-all focus:outline-none focus:ring-1 focus:ring-[#8B0000]/30"
                    />
                  </div>
                </div>
              )}
            </div>

            <div
              className="grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out"
              style={{ gridTemplateRows: rootOpen ? "1fr" : "0fr", opacity: rootOpen ? 1 : 0, marginTop: rootOpen ? "0.75rem" : "0rem" }}
            >
              <div className="min-h-0 overflow-hidden px-5">
                {rootAssets.length > 0 && (
                  <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-[#8a5d33]/70">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {rootAssets.filter(a => a.scanning).length} Active
                      {discoverQueue.length > 0 && <span className="text-[#8B0000]">{discoverQueue.length} Queued</span>}
                    </span>
                  </div>
                )}

                <div className="mt-4">
                  {filteredRoot.length === 0 ? (
                    <EmptyState
                      icon={Globe}
                      text="No root assets"
                      sub="Add domains or IP addresses to start mapping your attack surface."
                    />
                  ) : (
                    bucketView === "grouped"
                      ? renderGroupedAssets(filteredRoot, renderRootAssetRow)
                      : filteredRoot.map(renderRootAssetRow)
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-0 py-0">
            <div
              className="flex cursor-pointer flex-col gap-3 bg-amber-50/80 px-5 py-3 transition-colors hover:bg-amber-100/70 sm:flex-row sm:items-center sm:justify-between"
              onClick={() => setLeafOpen((current) => !current)}
            >
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between text-left text-sm font-extrabold uppercase tracking-wider text-[#3d200a]"
              >
                <span className="flex items-center gap-2">
                  {leafOpen ? <ChevronUp className="h-4 w-4 text-[#8a5d33]" /> : <ChevronDown className="h-4 w-4 text-[#8a5d33]" />}
                  <span>Leaf Assets</span>
                  <CountBadge count={leafAssets.length} />
                </span>
                <span />
              </button>

              {leafOpen && (
                <div
                  className="relative w-full cursor-default sm:w-[260px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a5d33]/30" />
                  <input
                    type="text"
                    value={leafSearch}
                    onChange={(e) => setLeafSearch(e.target.value)}
                    placeholder="Search leaf assets..."
                    className="w-full rounded-xl border border-amber-500/15 bg-amber-50/50 py-2 pl-9 pr-3 text-xs text-[#3d200a] placeholder:text-[#8a5d33]/30 transition-all focus:outline-none focus:ring-1 focus:ring-[#8B0000]/30"
                  />
                </div>
              )}
            </div>

            <div
              className="grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out"
              style={{ gridTemplateRows: leafOpen ? "1fr" : "0fr", opacity: leafOpen ? 1 : 0, marginTop: leafOpen ? "0.75rem" : "0rem" }}
            >
              <div className="min-h-0 overflow-hidden px-5">
                <div>
                  {filteredLeaf.length === 0 ? (
                    <EmptyState
                      icon={Leaf}
                      text="No leaf assets"
                      sub="Scan root domains for subdomains or add them manually."
                    />
                  ) : (
                    bucketView === "grouped"
                      ? renderGroupedAssets(filteredLeaf, renderLeafAssetRow)
                      : filteredLeaf.map(renderLeafAssetRow)
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
    {canManageAssets && showAddModal && typeof document !== "undefined" && ReactDOM.createPortal((
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
        onClick={() => setShowAddModal(false)}
      >
        <div
          className="w-full max-w-3xl rounded-[2rem] border border-amber-300/40 bg-[#fffaf3] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-amber-500/10 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#3d200a]">Add Asset</h3>
                <p className="mt-1 text-sm text-[#8a5d33]">Add a root domain, subdomain, or IP address to the inventory.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  resetAssetModalState();
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/40 bg-white text-[#8a5d33] transition-colors hover:bg-amber-50 hover:text-[#3d200a]"
                aria-label="Close add asset modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-4 pb-4 pt-3">
            <InputBar
              value={assetInputMode === "root" ? rootInput : leafInput}
              onChange={assetInputMode === "root" ? setRootInput : setLeafInput}
              onSubmit={assetInputMode === "root" ? handleAddRootAsset : handleAddLeafAsset}
              disabled={hasDuplicatePortEntries || hasInvalidPortDrafts}
              placeholder={assetInputMode === "root" ? "example.com or 192.168.1.1" : "sub.example.com or 10.0.0.1"}
              infoText={
                assetInputMode === "root"
                  ? "Add root-level domains or IP addresses to monitor. These are your primary attack surface entry points."
                  : "Add specific subdomains or IPs discovered through recon or manual enumeration."
              }
              trailingControl={
                <Select value={assetInputMode} onValueChange={(value: "root" | "leaf") => setAssetInputMode(value)}>
                  <SelectTrigger className="h-11 min-w-[144px] rounded-full border border-amber-500/20 bg-white px-4 text-sm font-bold shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Root Asset</SelectItem>
                    <SelectItem value="leaf">Leaf Asset</SelectItem>
                  </SelectContent>
                </Select>
              }
              showSubmitButton={false}
            />
            <div className="px-4 pb-2">
              <div className="rounded-[1.25rem] border border-amber-500/15 bg-white/75 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a5d33]/70">
                      Bucket
                    </span>
                    <Select value={bucketDraft} onValueChange={(value) => {
                      setBucketDraft(value);
                      setNewBucketName("");
                    }}>
                      <SelectTrigger className="mt-2 h-10 rounded-full border border-amber-500/20 bg-white px-4 text-sm font-bold shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto">Auto bucket from URL</SelectItem>
                        {PREDEFINED_ASSET_BUCKETS.map((bucket) => (
                          <SelectItem key={bucket} value={bucket}>{bucket}</SelectItem>
                        ))}
                        {bucketOptions
                          .filter((bucket) => !PREDEFINED_ASSET_BUCKETS.includes(bucket as any))
                          .map((bucket) => (
                            <SelectItem key={bucket} value={bucket}>{bucket}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a5d33]/70">
                      Custom Bucket
                    </span>
                    <input
                      type="text"
                      value={newBucketName}
                      onChange={(e) => setNewBucketName(e.target.value)}
                      placeholder="e.g. YONO, UAT, CBS"
                      className="mt-2 h-10 w-full rounded-full border border-amber-500/20 bg-white px-4 text-sm font-semibold text-[#3d200a] outline-none transition-all placeholder:text-[#8a5d33]/35 focus:ring-2 focus:ring-[#8B0000]/25"
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs font-semibold text-[#8a5d33]/70">
                  Selected: {newBucketName.trim() ? normalizeAssetBucket(newBucketName) : selectedAddBucketLabel}
                </p>
              </div>
            </div>
            <div className="px-4 pb-2">
              <div className="rounded-[1.5rem] border border-amber-500/15 bg-white/75 px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-[#3d200a]">Ports</h4>
                    <p className="mt-1 text-xs text-[#8a5d33]/75">Add or remove ports and choose whether each one is TCP or UDP.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addModalPortRow}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-[#fff7ea] px-3 py-1.5 text-xs font-bold text-[#8B0000] transition-colors hover:bg-amber-50"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Add Port
                  </button>
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {assetPorts.map((port, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <input
                          type="number"
                          min={1}
                          max={65535}
                          value={assetPortDrafts[index] ?? String(port.number)}
                          onChange={(e) => updateModalPortDraft(index, e.target.value)}
                          onBlur={() => commitModalPortDraft(index)}
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => e.currentTarget.select()}
                          ref={(node) => {
                            portInputRefs.current[index] = node;
                          }}
                          className="h-10 w-full rounded-full border border-amber-500/20 bg-white px-4 text-sm font-semibold text-[#3d200a] outline-none transition-all focus:ring-2 focus:ring-[#8B0000]/30"
                          placeholder="443"
                        />
                      </div>
                      <Select
                        value={port.protocol}
                        onValueChange={(value: "tcp" | "udp") => updateModalPort(index, { protocol: value })}
                      >
                        <SelectTrigger
                          className={`h-10 min-w-[112px] rounded-full border px-4 text-sm font-bold shadow-none ${
                            port.protocol === "udp"
                              ? "border-violet-200 bg-violet-50 text-violet-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tcp">TCP</SelectItem>
                          <SelectItem value="udp">UDP</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeModalPortRow(index)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                        aria-label="Remove port"
                      >
                        <MinusCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {hasDuplicatePortEntries && (
                  <p className="mt-3 text-xs font-semibold text-red-600">
                    Duplicate ports are not allowed for the same protocol. `80/TCP` and `80/UDP` are fine, but not two `80/TCP` entries.
                  </p>
                )}
                {hasInvalidPortDrafts && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    Each port must be a whole number between 1 and 65535.
                  </p>
                )}
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (assetInputMode === "root") {
                    const added = addRootAssets();
                    if (added) setShowAddModal(false);
                    return;
                  }
                  const added = addLeafAssets();
                  if (added) setShowAddModal(false);
                }}
                disabled={
                  !((assetInputMode === "root" ? rootInput : leafInput).trim()) ||
                  hasDuplicatePortEntries ||
                  hasInvalidPortDrafts
                }
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#8B0000] text-sm font-bold text-white transition-colors hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add Asset
              </button>
            </div>
          </div>
        </div>
      </div>
    ), document.body)}
    {portDiscoveryModal && typeof document !== "undefined" && ReactDOM.createPortal((
      <div
        className="fixed inset-0 z-[128] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
        onClick={closePortDiscoveryModal}
      >
        <div
          className="w-full max-w-[min(1120px,94vw)] overflow-hidden rounded-[1.1rem] border border-slate-200 bg-white shadow-[0_26px_70px_rgba(15,23,42,0.18)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#3d200a]">Port &amp; IP Discovery</h3>
                <p className="mt-1 text-sm text-[#8a5d33]">
                  {portDiscoveryModal.mode === "single"
                    ? `Configure the shared discovery preset before scanning ${portDiscoveryScopeLabel}.`
                    : `Configure the shared discovery preset before scanning ${portDiscoveryScopeLabel}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={closePortDiscoveryModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                aria-label="Close port discovery modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isLoadingPortDiscoveryConfig ? (
            <div className="flex min-h-[360px] items-center justify-center px-6 py-10">
              <div className="flex items-center gap-3 text-[#8a5d33]/80">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-semibold">Loading port discovery settings…</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.95fr)] sm:px-6">
              <div className="min-h-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-[#3d200a]">Port list</h4>
                    <p className="mt-1 text-xs text-[#8a5d33]/75">
                      Enable, edit, add, or remove ports from the shared discovery preset.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addPortDiscoveryEntry}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-[#fff7ea] px-3 py-1.5 text-xs font-bold text-[#8B0000] transition-colors hover:bg-amber-50"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Add Port
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-[#fcfbf8] p-3">
                  <div className="max-h-[28rem] overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {portDiscoveryEntries.map((entry, index) => (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={entry.enabled}
                              onChange={(e) => updatePortDiscoveryEntry(entry.id, { enabled: e.target.checked })}
                              className="mt-2 h-4 w-4 rounded border-slate-300 text-[#8B0000] focus:ring-[#8B0000]/30"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <input
                                  type="text"
                                  value={entry.title}
                                  onChange={(e) => updatePortDiscoveryEntry(entry.id, { title: e.target.value })}
                                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#3d200a] outline-none transition-all focus:border-[#8B0000]/35 focus:ring-2 focus:ring-[#8B0000]/15"
                                  placeholder="Service title"
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={entry.portDraft}
                                  onChange={(e) => {
                                    if (/^\\d*$/.test(e.target.value)) {
                                      updatePortDiscoveryEntry(entry.id, { portDraft: e.target.value });
                                    }
                                  }}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onClick={(e) => e.currentTarget.select()}
                                  ref={(node) => {
                                    portDiscoveryListInputRefs.current[index] = node;
                                  }}
                                  className="h-10 w-[92px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#3d200a] outline-none transition-all focus:border-[#8B0000]/35 focus:ring-2 focus:ring-[#8B0000]/15"
                                  placeholder="443"
                                />
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-[11px] font-semibold text-[#8a5d33]/70">
                                  {entry.enabled ? "Included in discovery" : "Excluded from discovery"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removePortDiscoveryEntry(entry.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                                  aria-label="Remove discovery port entry"
                                >
                                  <MinusCircle className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs font-semibold">
                  {portDiscoveryEntryIssues.hasDuplicatePorts && (
                    <p className="text-red-600">Each port number can appear only once in the discovery checklist.</p>
                  )}
                  {portDiscoveryEntryIssues.hasInvalidPorts && (
                    <p className="text-red-600">Ports must be whole numbers between 1 and 65535.</p>
                  )}
                  {portDiscoveryEntryIssues.hasEmptyTitles && (
                    <p className="text-red-600">Every checklist entry must have a service title.</p>
                  )}
                  {portDiscoveryEntryIssues.enabledCount === 0 && (
                    <p className="text-red-600">Enable at least one port before starting discovery.</p>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col gap-4">
                <div className="rounded-xl border border-slate-200 bg-[#fcfbf8] p-4">
                  <h4 className="text-sm font-extrabold text-[#3d200a]">Probe settings</h4>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8a5d33]/65">
                        Probe batch size
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={portDiscoveryProbeBatchSize}
                        onChange={(e) => {
                          if (/^\\d*$/.test(e.target.value)) {
                            setPortDiscoveryProbeBatchSize(e.target.value);
                          }
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#3d200a] outline-none transition-all focus:border-[#8B0000]/35 focus:ring-2 focus:ring-[#8B0000]/15"
                        placeholder={String(DEFAULT_PORT_DISCOVERY_PROBE_BATCH_SIZE)}
                      />
                      <span className="mt-1 block text-[11px] font-medium text-[#8a5d33]/70">
                        Default 5. Maximum 10.
                      </span>
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8a5d33]/65">
                        Probe timeout (ms)
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={portDiscoveryProbeTimeoutMs}
                        onChange={(e) => {
                          if (/^\\d*$/.test(e.target.value)) {
                            setPortDiscoveryProbeTimeoutMs(e.target.value);
                          }
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#3d200a] outline-none transition-all focus:border-[#8B0000]/35 focus:ring-2 focus:ring-[#8B0000]/15"
                        placeholder={String(DEFAULT_PORT_DISCOVERY_PROBE_TIMEOUT_MS)}
                      />
                      <span className="mt-1 block text-[11px] font-medium text-[#8a5d33]/70">
                        Default 600. Maximum 2000.
                      </span>
                    </label>
                  </div>

                  {(hasInvalidPortDiscoveryBatchSize || hasInvalidPortDiscoveryTimeout) && (
                    <div className="mt-4 space-y-1 text-xs font-semibold text-red-600">
                      {hasInvalidPortDiscoveryBatchSize && (
                        <p>Probe batch size must be a number between 1 and 10.</p>
                      )}
                      {hasInvalidPortDiscoveryTimeout && (
                        <p>Probe timeout must be a number between 1 and 2000 milliseconds.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-[#fcfbf8] p-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-[#3d200a]">Port ranges</h4>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500"
                          aria-label="About port ranges"
                        >
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>port ranges only available for verified domains.</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={false}
                        disabled
                        readOnly
                        className="h-4 w-4 rounded border-slate-300 text-slate-400"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Port ranges are disabled for now</p>
                        <p className="mt-1 text-xs text-slate-400">Use the editable checklist above to control discovery.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-[#fcfbf8] p-4">
                  <h4 className="text-sm font-extrabold text-[#3d200a]">Run summary</h4>
                  <dl className="mt-3 space-y-2 text-sm text-[#5b3a1f]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-medium text-[#8a5d33]">Scope</dt>
                      <dd className="font-bold text-[#3d200a]">
                        {portDiscoveryModal.mode === "single" ? portDiscoveryScopeLabel : `${portDiscoveryScopeLabel} selected`}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-medium text-[#8a5d33]">Enabled ports</dt>
                      <dd className="font-bold text-[#3d200a]">{portDiscoveryEntryIssues.enabledCount}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-medium text-[#8a5d33]">Scan lock</dt>
                      <dd className={`font-bold ${portDiscoveryLocked ? "text-red-600" : "text-emerald-600"}`}>
                        {portDiscoveryLocked ? "Another scan is active" : "Ready to start"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <button
                  type="button"
                  onClick={startPortDiscovery}
                  disabled={
                    isStartingPortDiscovery ||
                    isLoadingPortDiscoveryConfig ||
                    portDiscoveryLocked ||
                    portDiscoveryEntryIssues.hasDuplicatePorts ||
                    portDiscoveryEntryIssues.hasInvalidPorts ||
                    portDiscoveryEntryIssues.hasEmptyTitles ||
                    portDiscoveryEntryIssues.enabledCount === 0 ||
                    hasInvalidPortDiscoveryBatchSize ||
                    hasInvalidPortDiscoveryTimeout
                  }
                  className="mt-auto inline-flex h-11 w-full items-center justify-center rounded-full bg-[#1e3a8a] text-sm font-bold text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isStartingPortDiscovery ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting port discovery...
                    </>
                  ) : (
                    "Start Port Discovery"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    ), document.body)}
    {canManageAssets && editingBucketAsset && typeof document !== "undefined" && ReactDOM.createPortal((
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
        onClick={closeEditBucketModal}
      >
        <div
          className="w-full max-w-lg rounded-2xl border border-amber-300/40 bg-[#fffaf3] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-amber-500/10 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#3d200a]">Edit Bucket</h3>
                <p className="mt-1 break-all text-sm text-[#8a5d33]">{editingBucketAsset.value}</p>
              </div>
              <button
                type="button"
                onClick={closeEditBucketModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/40 bg-white text-[#8a5d33] transition-colors hover:bg-amber-50 hover:text-[#3d200a]"
                aria-label="Close edit bucket modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a5d33]/70">
                Bucket
              </span>
              <Select value={bucketDraft} onValueChange={(value) => {
                setBucketDraft(value);
                setNewBucketName("");
              }}>
                <SelectTrigger className="mt-2 h-11 rounded-full border border-amber-500/20 bg-white px-4 text-sm font-bold shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto">Auto bucket from URL</SelectItem>
                  {bucketOptions.map((bucket) => (
                    <SelectItem key={bucket} value={bucket}>{bucket}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a5d33]/70">
                New Bucket
              </span>
              <input
                type="text"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="Create a bucket like Mobile Banking"
                className="mt-2 h-11 w-full rounded-full border border-amber-500/20 bg-white px-4 text-sm font-semibold text-[#3d200a] outline-none transition-all placeholder:text-[#8a5d33]/35 focus:ring-2 focus:ring-[#8B0000]/25"
              />
            </label>

            <div className="rounded-xl border border-[#8B0000]/10 bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a5d33]/65">Will be moved to</p>
              <p className="mt-1 text-sm font-extrabold text-[#3d200a]">{resolveBucketDraft()}</p>
            </div>

            <button
              type="button"
              onClick={saveEditedBucket}
              disabled={isSavingBucket}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#8B0000] text-sm font-bold text-white transition-colors hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSavingBucket ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Bucket...
                </>
              ) : (
                "Save Bucket"
              )}
            </button>
          </div>
        </div>
      </div>
    ), document.body)}
    {canManageAssets && editingPortsAsset && typeof document !== "undefined" && ReactDOM.createPortal((
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
        onClick={resetEditPortsState}
      >
        <div
          className="w-full max-w-2xl rounded-2xl border border-amber-300/40 bg-[#fffaf3] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-amber-500/10 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#3d200a]">Edit Ports</h3>
                <p className="mt-1 text-sm text-[#8a5d33]">{editingPortsAsset.value}</p>
              </div>
              <button
                type="button"
                onClick={resetEditPortsState}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/40 bg-white text-[#8a5d33] transition-colors hover:bg-amber-50 hover:text-[#3d200a]"
                aria-label="Close edit ports modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-4 pb-4 pt-3">
            <div className="px-4 pb-2">
              <div className="rounded-[1.5rem] border border-amber-500/15 bg-white/75 px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-[#3d200a]">Ports</h4>
                    <p className="mt-1 text-xs text-[#8a5d33]/75">Update the saved open ports for this asset.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addEditingPortRow}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-[#fff7ea] px-3 py-1.5 text-xs font-bold text-[#8B0000] transition-colors hover:bg-amber-50"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Add Port
                  </button>
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {editingPorts.map((port, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <input
                          type="number"
                          min={1}
                          max={65535}
                          value={editingPortDrafts[index] ?? String(port.number)}
                          onChange={(e) => updateEditingPortDraft(index, e.target.value)}
                          onBlur={() => commitEditingPortDraft(index)}
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => e.currentTarget.select()}
                          ref={(node) => {
                            portInputRefs.current[index] = node;
                          }}
                          className="h-10 w-full rounded-full border border-amber-500/20 bg-white px-4 text-sm font-semibold text-[#3d200a] outline-none transition-all focus:ring-2 focus:ring-[#8B0000]/30"
                          placeholder="443"
                        />
                      </div>
                      <Select
                        value={port.protocol}
                        onValueChange={(value: "tcp" | "udp") => updateEditingPort(index, { protocol: value })}
                      >
                        <SelectTrigger
                          className={`h-10 min-w-[112px] rounded-full border px-4 text-sm font-bold shadow-none ${
                            port.protocol === "udp"
                              ? "border-violet-200 bg-violet-50 text-violet-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tcp">TCP</SelectItem>
                          <SelectItem value="udp">UDP</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeEditingPortRow(index)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                        aria-label="Remove port"
                      >
                        <MinusCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {hasDuplicateEditingPortEntries && (
                  <p className="mt-3 text-xs font-semibold text-red-600">
                    Duplicate ports are not allowed for the same protocol. `80/TCP` and `80/UDP` are fine, but not two `80/TCP` entries.
                  </p>
                )}
                {hasInvalidEditingPortDrafts && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    Each port must be a whole number between 1 and 65535.
                  </p>
                )}
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={saveEditedPorts}
                disabled={hasDuplicateEditingPortEntries || hasInvalidEditingPortDrafts || isSavingEditedPorts}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#8B0000] text-sm font-bold text-white transition-colors hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSavingEditedPorts ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Ports...
                  </>
                ) : (
                  "Save Ports"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    ), document.body)}
    {portsPreviewAsset && typeof document !== "undefined" && ReactDOM.createPortal((
      <div
        className="fixed inset-0 z-[125] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
        onClick={() => setPortsPreviewAsset(null)}
      >
        <div
          className="w-[min(88vw,30rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.12)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-neutral-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#3d200a]">Open Ports for Asset</h3>
                <p className="mt-1 text-sm font-semibold text-[#3d200a]">{portsPreviewAsset.value}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8a5d33]">
                  {portsPreviewAsset.type !== "ip" && portsPreviewAsset.resolvedIp ? (
                    <span>IP: {portsPreviewAsset.resolvedIp}</span>
                  ) : null}
                  {portsPreviewAsset.type === "ip" ? <span>IP: {portsPreviewAsset.value}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPortsPreviewAsset(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-800"
                aria-label="Close ports preview modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="max-h-64 overflow-y-auto rounded-md border border-neutral-200 bg-white">
              {portsPreviewAsset.openPorts.map((port, index) => (
                <div
                  key={`${port.number}-${port.protocol}-${index}`}
                  className="flex items-center justify-between border-b border-dotted border-neutral-200 px-4 py-3 last:border-b-0"
                >
                  <span className="text-sm font-semibold text-[#3d200a]">
                    Port {port.number}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      port.protocol === "udp"
                        ? "bg-violet-500/10 text-violet-700"
                        : "bg-emerald-500/10 text-emerald-700"
                    }`}
                  >
                    {port.protocol.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ), document.body)}
    {canManageAssets && discoveredAssetsModal && typeof document !== "undefined" && ReactDOM.createPortal((
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
        onClick={() => setDiscoveredAssetsModal(null)}
      >
        <div
          className="w-[min(88vw,46rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.10)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-neutral-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-700">Newly Discovered Assets</h3>
                  <p className="mt-1 text-sm text-emerald-700/85">
                  {discoveredAssetsModal.sourceValue}: {discoveredAssetsModal.assets.length} new discovered.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiscoveredAssetsModal(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-800"
                aria-label="Close discovered assets modal"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-emerald-200/80 bg-white">
              {discoveredAssetsModal.assets.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-bold text-emerald-900/80">No new assets were found.</p>
                </div>
              ) : (
                discoveredAssetsModal.assets.map((asset) => {
                  const Icon = getAssetIcon(asset.type);

                  return (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between border-b border-dotted border-emerald-200 px-5 py-4 last:border-b-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          asset.type === "domain" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                        }`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold leading-6 text-[#3d200a]">{asset.value}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <AssetBucketChip bucket={asset.bucket} />
                            {renderPortChips(asset.openPorts)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ActionTooltip content="Edit bucket">
                          <button
                            type="button"
                            onClick={() => openEditBucketModal(asset, "leaf")}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-[#8B0000] transition-all hover:bg-neutral-50"
                          >
                            <Tags className="h-4 w-4" />
                          </button>
                        </ActionTooltip>
                        <ActionTooltip content="Edit ports">
                          <button
                            type="button"
                            onClick={() => {
                              openEditPortsModal(asset, "leaf");
                            }}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition-all hover:bg-neutral-50 hover:text-neutral-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </ActionTooltip>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    ), document.body)}
    </TooltipProvider>
  );
}
