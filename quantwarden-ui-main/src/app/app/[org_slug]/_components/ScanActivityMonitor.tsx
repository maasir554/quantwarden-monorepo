"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  Maximize2,
  Play,
  RefreshCw,
  ShieldAlert,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useScanActivity } from "@/components/scan-activity-provider";
import type {
  ScanActivityBatch,
  ScanActivityItem,
  ScanBatchSource,
  ScanEngine,
  ScanHistoryCategory,
  ScanHistoryEntry,
  ScanUpcomingEntry,
} from "@/lib/scan-activity-types";

function batchLabel(type: ScanActivityBatch["type"], engine: ScanEngine) {
  if (engine === "subdomainDiscovery") {
    if (type === "full") return "Full Subdomain Discovery";
    if (type === "group") return "Group Subdomain Discovery";
    return "Subdomain Discovery";
  }

  if (engine === "portDiscovery") {
    if (type === "full") return "Full Port Discovery";
    if (type === "group") return "Group Port Discovery";
    return "Single Port Discovery";
  }

  if (type === "full") return "Full OpenSSL Scan";
  if (type === "group") return "Group OpenSSL Scan";
  return "OpenSSL Scan";
}

function engineServiceLabel(engine: ScanEngine | null | undefined) {
  if (engine === "portDiscovery") return "Nmap API";
  if (engine === "subdomainDiscovery") return "Subfinder API";
  return "OpenSSL scanning endpoint";
}

function sourceBadgeMeta(source: ScanBatchSource) {
  if (source === "scheduled") {
    return {
      label: "Scheduled",
      tone: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  if (source === "automated") {
    return {
      label: "Automated",
      tone: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  return {
    label: "Manual",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  };
}

function formatWhen(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.toLocaleString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
}

function formatDuration(durationSeconds: number | null) {
  if (!durationSeconds || durationSeconds <= 0) return "N/A";
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function formatWhenStacked(value: string | null) {
  if (!value) return { absolute: "Unknown", relative: "Unknown" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { absolute: "Unknown", relative: "Unknown" };
  return {
    absolute: date.toLocaleString(),
    relative: formatDistanceToNow(date, { addSuffix: true }),
  };
}

function historyStatusMeta(status: ScanActivityBatch["status"]) {
  if (status === "failed") {
    return {
      label: "Issues Found",
      tone: "bg-red-100 text-red-700",
      iconTone: "text-red-600",
      pulse: "scan-history-status-pulse",
    };
  }

  if (status === "completed") {
    return {
      label: "Completed",
      tone: "bg-emerald-100 text-emerald-700",
      iconTone: "text-emerald-600",
      pulse: "",
    };
  }

  if (status === "cancelled") {
    return {
      label: "Cancelled",
      tone: "bg-stone-100 text-stone-700",
      iconTone: "text-stone-600",
      pulse: "",
    };
  }

  return {
    label: "In Progress",
    tone: "bg-amber-100 text-amber-700",
    iconTone: "text-amber-600",
    pulse: "scan-history-status-pulse",
  };
}

function itemTone(item: ScanActivityItem) {
  if (item.status === "completed") return "bg-emerald-100 text-emerald-700";
  if (item.status === "failed") return "bg-red-100 text-red-700";
  if (item.status === "running") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function activityItemLabel(item: Pick<ScanActivityItem, "assetValue" | "portNumber" | "portProtocol">) {
  if (!item.portNumber) return item.assetValue;
  return `${item.assetValue}:${item.portNumber}/${(item.portProtocol || "tcp").toUpperCase()}`;
}

function activityItemAssetLabel(item: Pick<ScanActivityItem, "assetValue">) {
  return item.assetValue;
}

function activityItemPortLabel(item: Pick<ScanActivityItem, "portNumber" | "portProtocol">) {
  if (!item.portNumber) return null;
  return `${item.portNumber}/${(item.portProtocol || "tcp").toUpperCase()}`;
}

function streamChipTone(streamStatus: "idle" | "connecting" | "connected" | "error") {
  if (streamStatus === "connected") {
    return {
      chip: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
      label: "Live",
    };
  }

  if (streamStatus === "connecting") {
    return {
      chip: "border-amber-200/80 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      label: "Connecting",
    };
  }

  if (streamStatus === "error") {
    return {
      chip: "border-red-200/80 bg-red-50 text-red-700",
      dot: "bg-red-500",
      label: "Disconnected",
    };
  }

  return {
    chip: "border-stone-200 bg-stone-50 text-stone-600",
    dot: "bg-stone-400",
    label: "Idle",
  };
}

function historyCategoryMeta(category: ScanHistoryCategory) {
  if (category === "passed") {
    return {
      label: "Passed",
      tone: "bg-emerald-100 text-emerald-700",
      countTone: "text-emerald-700",
      empty: "No passed assets in this batch.",
    };
  }

  if (category === "timeout") {
    return {
      label: "Timeout",
      tone: "bg-amber-100 text-amber-700",
      countTone: "text-amber-700",
      empty: "No timeout results in this batch.",
    };
  }

  if (category === "dnsExpired") {
    return {
      label: "DNS Expired",
      tone: "bg-rose-100 text-rose-700",
      countTone: "text-rose-700",
      empty: "No DNS-expired assets in this batch.",
    };
  }

  return {
    label: "Failed",
    tone: "bg-red-100 text-red-700",
    countTone: "text-red-700",
    empty: "No failed assets in this batch.",
  };
}

type LiveBatchCardItem = ScanActivityItem & {
  lingerCompleted?: boolean;
  exiting?: boolean;
};

function BatchSection({ batch }: { batch: ScanActivityBatch }) {
  const sourceMeta = sourceBadgeMeta(batch.source);
  const [activeTab, setActiveTab] = useState<"running" | "queued" | "completed">(
    batch.items.some((item) => item.status === "running")
      ? "running"
      : batch.items.some((item) => item.status === "pending")
        ? "queued"
        : "completed"
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [renderRunningCards, setRenderRunningCards] = useState(activeTab === "running");
  const [runningCardsVisible, setRunningCardsVisible] = useState(activeTab === "running");
  const [liveCardItems, setLiveCardItems] = useState<LiveBatchCardItem[]>(
    batch.items.filter((item) => item.status === "running")
  );
  const completedDismissalsRef = useRef<Set<string>>(new Set());
  const liveCardRemovalTimeoutsRef = useRef<Record<string, number>>({});
  const liveCardExitTimeoutsRef = useRef<Record<string, number>>({});

  const runningItems = batch.items.filter((item) => item.status === "running");
  const queuedItems = batch.items.filter((item) => item.status === "pending");
  const completedItems = batch.items.filter((item) => item.status === "completed" || item.status === "failed" || item.status === "cancelled");
  const shouldAnimateProgress =
    batch.status === "running" ||
    batch.status === "queued" ||
    batch.items.some((item) => item.status === "running" || item.status === "pending");

  const tabItems =
    activeTab === "running"
      ? runningItems
      : activeTab === "queued"
        ? queuedItems
        : completedItems;

  const tabs: Array<{
    id: "running" | "queued" | "completed";
    label: string;
    count: number;
  }> = [
    { id: "running", label: "Currently Scanning", count: liveCardItems.length },
    { id: "queued", label: "Queued", count: queuedItems.length },
    { id: "completed", label: "Completed", count: completedItems.length },
  ];
  const activeItemsForView = activeTab === "running" ? liveCardItems : tabItems;

  useEffect(() => {
    const mountedAt = Date.now();
    setElapsedSeconds(0);
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - mountedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    completedDismissalsRef.current.clear();
    Object.values(liveCardRemovalTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    Object.values(liveCardExitTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    liveCardRemovalTimeoutsRef.current = {};
    liveCardExitTimeoutsRef.current = {};
    setLiveCardItems(batch.items.filter((item) => item.status === "running"));
  }, [batch.id]);

  useEffect(() => {
    const scheduleLiveCardRemoval = (itemId: string) => {
      if (liveCardRemovalTimeoutsRef.current[itemId]) return;

      liveCardExitTimeoutsRef.current[itemId] = window.setTimeout(() => {
        setLiveCardItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, exiting: true } : item))
        );
        delete liveCardExitTimeoutsRef.current[itemId];
      }, 800);

      liveCardRemovalTimeoutsRef.current[itemId] = window.setTimeout(() => {
        completedDismissalsRef.current.add(itemId);
        setLiveCardItems((prev) => prev.filter((item) => item.id !== itemId));
        delete liveCardRemovalTimeoutsRef.current[itemId];
      }, 1000);
    };

    const clearLiveCardRemoval = (itemId: string) => {
      const exitTimeoutId = liveCardExitTimeoutsRef.current[itemId];
      if (exitTimeoutId) {
        window.clearTimeout(exitTimeoutId);
        delete liveCardExitTimeoutsRef.current[itemId];
      }
      const timeoutId = liveCardRemovalTimeoutsRef.current[itemId];
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        delete liveCardRemovalTimeoutsRef.current[itemId];
      }
    };

    setLiveCardItems((prev) => {
      const next: LiveBatchCardItem[] = [];
      const nextIds = new Set<string>();
      const currentItemsById = new Map(batch.items.map((item) => [item.id, item]));

      for (const prevItem of prev) {
        const currentItem = currentItemsById.get(prevItem.id);

        if (currentItem?.status === "running") {
          clearLiveCardRemoval(prevItem.id);
          next.push({ ...currentItem, lingerCompleted: false, exiting: false });
          nextIds.add(prevItem.id);
          continue;
        }

        if (currentItem?.status === "completed") {
          scheduleLiveCardRemoval(prevItem.id);
          next.push({ ...currentItem, lingerCompleted: true, exiting: prevItem.exiting ?? false });
          nextIds.add(prevItem.id);
          continue;
        }

        if (prevItem.lingerCompleted) {
          next.push(prevItem);
          nextIds.add(prevItem.id);
        }
      }

      for (const item of batch.items) {
        if (nextIds.has(item.id) || completedDismissalsRef.current.has(item.id)) continue;

        if (item.status === "running") {
          clearLiveCardRemoval(item.id);
          next.push({ ...item, lingerCompleted: false, exiting: false });
          continue;
        }

        if (item.status === "completed") {
          scheduleLiveCardRemoval(item.id);
          next.push({ ...item, lingerCompleted: true, exiting: false });
        }
      }

      return next;
    });
  }, [batch.items]);

  useEffect(() => {
    if (activeTab === "running") {
      setRenderRunningCards(true);
      const frame = window.requestAnimationFrame(() => setRunningCardsVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setRunningCardsVisible(false);
    const timeoutId = window.setTimeout(() => setRenderRunningCards(false), 240);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab]);

  useEffect(() => {
    return () => {
      Object.values(liveCardRemovalTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      Object.values(liveCardExitTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      liveCardRemovalTimeoutsRef.current = {};
      liveCardExitTimeoutsRef.current = {};
    };
  }, []);

  return (
    <section className="scan-batch-section rounded-[1.6rem] border border-amber-500/15 bg-[#fffdf9] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#8a5d33]/60">
            {batch.status === "running" || batch.status === "queued" ? "Current Batch" : "Latest Batch"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-black tracking-tight text-[#3d200a]">{batchLabel(batch.type, batch.engine)}</h3>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${sourceMeta.tone}`}>
              {sourceMeta.label}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#8a5d33]/70">
            <span>Initiated by {batch.initiatedBy?.name || batch.initiatedBy?.email || "Unknown"}</span>
            <span className="text-[#8a5d33]/35">•</span>
            <span>{formatWhen(batch.createdAt)}</span>
          </div>
        </div>
        <div className="min-w-[220px] rounded-[1.4rem] border border-amber-500/15 bg-[#fdf8f0] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[#8a5d33]/65">Progress</p>
            <span className="text-lg font-black text-[#8B0000]">{batch.percentComplete}%</span>
          </div>
          <div className="scan-progress-track mt-3 h-2.5 overflow-hidden rounded-full bg-amber-100">
            <div
              className={`scan-progress-fill h-full rounded-full bg-linear-to-r from-[#8B0000] via-red-700 to-amber-500 transition-all ${
                shouldAnimateProgress ? "" : "scan-progress-fill-static"
              }`}
              style={{ width: `${batch.percentComplete}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] font-semibold text-[#8a5d33]/55">Done</p>
              <p className="text-sm font-black text-emerald-600">{batch.completedAssets}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#8a5d33]/55">Failed</p>
              <p className="text-sm font-black text-red-600">{batch.failedAssets}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#8a5d33]/55">Pending</p>
              <p className="text-sm font-black text-amber-600">{batch.pendingAssets + batch.runningAssets}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "border-[#8B0000]/20 bg-[#8B0000] text-white"
                  : "border-amber-500/15 bg-white text-[#8a5d33] hover:bg-[#fff7ec]"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-amber-100 text-[#8B0000]"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {activeItemsForView.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-500/20 bg-[#fffdf9] px-4 py-8 text-center">
            <p className="text-sm font-bold text-[#8a5d33]/75">
              {activeTab === "running"
                ? "Nothing is actively scanning right now."
                : activeTab === "queued"
                  ? "There are no queued items in this batch."
                  : "No completed items yet."}
            </p>
          </div>
        ) : activeTab === "running" ? (
          <div
            className={`mt-4 grid grid-cols-1 gap-3 transition-all duration-500 lg:grid-cols-2 ${
              runningCardsVisible
                ? "opacity-100 scale-100 blur-0"
                : "pointer-events-none opacity-0 scale-[0.985] blur-[2px]"
            }`}
          >
            {renderRunningCards && activeItemsForView.map((item, index) => {
              const when = formatWhenStacked(item.completedAt || item.createdAt);
              const itemSeed = item.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 14;
              const liveProgress = item.status === "completed" ? 100 : Math.min(96, 18 + itemSeed + elapsedSeconds * 1.6);
              const itemPortLabel = activityItemPortLabel(item);
              return (
                <div
                  key={item.id}
                  className={`scan-running-card scan-running-card-enter rounded-2xl border border-amber-500/15 p-4 ${
                    item.status === "completed" ? "scan-running-card-completed" : ""
                  } ${
                    "exiting" in item && item.exiting ? "scan-running-card-exit" : ""
                  }`}
                  style={{ animationDelay: `${Math.min(index * 70, 280)}ms` }}
                >
                  <div className="scan-running-card-content">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black leading-snug text-[#3d200a]">
                          {activityItemAssetLabel(item)}
                        </p>
                        {itemPortLabel && (
                          <span className="mt-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                            {itemPortLabel}
                          </span>
                        )}
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${itemTone(item)}`}>
                        {item.status === "completed" ? "Completed" : "Running"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[#8a5d33]/80">Updated {when.relative}</p>
                    <div className="scan-progress-track mt-3 h-1.5 rounded-full bg-amber-100/80">
                      <div
                        className="scan-progress-fill h-full rounded-full bg-linear-to-r from-[#8B0000] via-red-700 to-amber-500 transition-all duration-[1800ms]"
                        style={{ width: `${liveProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-amber-500/15 bg-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#fff3df] text-left">
                  <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[#8a5d33]">Target</th>
                  <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[#8a5d33]">Status</th>
                  <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[#8a5d33]">Updated</th>
                </tr>
              </thead>
            </table>
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {tabItems.map((item, index) => {
                    const when = formatWhenStacked(item.completedAt || item.createdAt);
                    return (
                      <tr
                        key={item.id}
                        className={`border-t border-amber-500/10 transition-colors hover:bg-[#fff0df] ${
                          index % 2 === 0 ? "bg-[#fffdf9]" : "bg-[#fff8ee]"
                        }`}
                      >
                        <td className="px-4 py-3 align-top">
                          <p className="text-xl font-black leading-snug text-[#3d200a]">{activityItemLabel(item)}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-5 w-5" />
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="text-sm font-semibold text-[#8a5d33]/90">{when.absolute}</p>
                          <p className="mt-0.5 text-sm font-semibold text-[#8a5d33]/70">{when.relative}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryBatchSection({ entry }: { entry: ScanHistoryEntry }) {
  const sourceMeta = sourceBadgeMeta(entry.source);
  const [activeFilter, setActiveFilter] = useState<ScanHistoryCategory>(() => {
    if (entry.passedAssets > 0) return "passed";
    if (entry.timeoutAssets > 0) return "timeout";
    if (entry.dnsExpiredAssets > 0) return "dnsExpired";
    return "failed";
  });

  useEffect(() => {
    if (activeFilter === "passed" && entry.passedAssets > 0) return;
    if (activeFilter === "timeout" && entry.timeoutAssets > 0) return;
    if (activeFilter === "dnsExpired" && entry.dnsExpiredAssets > 0) return;
    if (activeFilter === "failed" && entry.failedAssets > 0) return;

    if (entry.passedAssets > 0) {
      setActiveFilter("passed");
    } else if (entry.timeoutAssets > 0) {
      setActiveFilter("timeout");
    } else if (entry.dnsExpiredAssets > 0) {
      setActiveFilter("dnsExpired");
    } else {
      setActiveFilter("failed");
    }
  }, [activeFilter, entry.dnsExpiredAssets, entry.failedAssets, entry.passedAssets, entry.timeoutAssets]);

  const filterCounts: Record<ScanHistoryCategory, number> = {
    passed: entry.passedAssets,
    timeout: entry.timeoutAssets,
    dnsExpired: entry.dnsExpiredAssets,
    failed: entry.failedAssets,
  };

  const visibleItems = entry.items.filter((item) => item.category === activeFilter);
  const activeMeta = historyCategoryMeta(activeFilter);

  const filters: ScanHistoryCategory[] = ["passed", "timeout", "dnsExpired", "failed"];

  return (
    <section className="rounded-[1.35rem] border border-slate-200/70 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-black text-[#3d200a]">Result breakdown</p>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${sourceMeta.tone}`}>
            {sourceMeta.label}
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((filter) => {
          const meta = historyCategoryMeta(filter);
          const isActive = filter === activeFilter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                isActive
                  ? "border-blue-700/20 bg-blue-700 text-white"
                  : "border-slate-200 bg-white text-[#8a5d33] hover:bg-slate-50"
              }`}
            >
              <span>{meta.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isActive ? "bg-white/20 text-white" : meta.tone
              }`}>
                {filterCounts[filter]}
              </span>
            </button>
          );
        })}
      </div>

      {visibleItems.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
          <p className="text-sm font-bold text-[#8a5d33]/75">{activeMeta.empty}</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[#6b0000]">Target</th>
                <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[#6b0000]">Updated</th>
              </tr>
            </thead>
          </table>
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full border-collapse">
              <tbody>
                {visibleItems.map((item, index) => {
                  const when = formatWhenStacked(item.completedAt || item.createdAt);
                  return (
                    <tr
                      key={item.scanId}
                      className={`border-t border-slate-200/80 align-top transition-colors hover:bg-slate-50 ${
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/45"
                      }`}
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="text-xl font-black leading-snug text-[#3d200a]">{activityItemLabel(item)}</p>
                        {item.category === "dnsExpired" && (
                          <p className="mt-1 text-xs font-semibold text-rose-700">
                            This domain no longer resolves in DNS.
                          </p>
                        )}
                        {(item.category === "timeout" || item.category === "failed") && item.error && (
                          <p className="mt-1 text-xs font-semibold text-red-700">{item.error}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-semibold text-[#8a5d33]/90">{when.absolute}</p>
                        <p className={`mt-0.5 text-sm font-semibold ${activeMeta.countTone}`}>{when.relative}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function UpcomingQueueSection({
  entries,
  canScan,
  cancellingRunId,
  onCancel,
}: {
  entries: ScanUpcomingEntry[];
  canScan: boolean;
  cancellingRunId: string | null;
  onCancel: (runId: string) => Promise<void>;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/75 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#8a5d33]/60">Upcoming Queue</p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-[#3d200a]">
            {entries.length} scheduled {entries.length === 1 ? "scan" : "scans"} waiting
          </h3>
          <p className="mt-1 text-sm font-semibold text-[#8a5d33]/75">
            Scheduled work stays here until the organization lock clears and the worker materializes the next batch.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {entries.map((entry) => {
          const sourceMeta = sourceBadgeMeta(entry.source);
          return (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-[#fffdf9] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-[#3d200a]">{batchLabel(entry.type, entry.engine)}</p>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${sourceMeta.tone}`}>
                    {sourceMeta.label}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-[#8a5d33]/80">
                  Due {formatWhen(entry.dueAt)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#8a5d33]/70">
                  Scheduled by {entry.initiatedBy?.name || entry.initiatedBy?.email || "Unknown"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Waiting
                </span>
                {canScan && (
                  <button
                    type="button"
                    onClick={() => void onCancel(entry.id)}
                    disabled={cancellingRunId === entry.id}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancellingRunId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


export default function ScanActivityMonitor({
  orgId,
  orgSlug,
  canScan,
  compact = false,
}: {
  orgId: string;
  orgSlug: string;
  canScan: boolean;
  compact?: boolean;
}) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const [showLiveActivityInfoTooltip, setShowLiveActivityInfoTooltip] = useState(false);
  const [showHistoryInfoTooltip, setShowHistoryInfoTooltip] = useState(false);
  const [monitorPanel, setMonitorPanel] = useState<"live" | "queue" | "scheduled" | "history">("live");
  const showHistoryPanel = monitorPanel === "history";
  const [openHistoryBatchId, setOpenHistoryBatchId] = useState<string | null>(null);
  const [cancellingQueueRunId, setCancellingQueueRunId] = useState<string | null>(null);
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [hideHeaderActions, setHideHeaderActions] = useState(false);
  const [isServiceWarningSticky, setIsServiceWarningSticky] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const warningProgressBaselineRef = useRef<{ key: string; score: number } | null>(null);
  const {
    activity,
    loading,
    error,
    serviceUnavailableRemainingSeconds,
    lastSyncAt,
    checkingConnection,
    streamStatus,
    isMonitorOpen,
    openMonitor,
    closeMonitor,
    startActivityMonitor,
    refreshActivity,
    cancelBatch,
    cancelQueuedRun,
  } = useScanActivity(orgId, {
    orgSlug,
  });

  const fetchSchedules = async () => {
    setSchedulesLoading(true);
    try {
      const res = await fetch(`/api/orgs/scans/schedules?orgId=${orgId}`);
      const data = await res.json().catch(() => ({}));
      if (data.schedules) {
        setSchedules(data.schedules);
      }
    } catch { /* ignore */ } finally {
      setSchedulesLoading(false);
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    setDeletingScheduleId(scheduleId);
    try {
      await fetch(`/api/orgs/scans/schedules/${scheduleId}?orgId=${orgId}`, {
        method: "DELETE",
      });
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    } catch { /* ignore */ } finally {
      setDeletingScheduleId(null);
    }
  };

  // Fetch schedules on mount (for floating button badge) and when monitor opens
  useEffect(() => {
    void fetchSchedules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isMonitorOpen) {
      void fetchSchedules();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonitorOpen]);

  useEffect(() => {
    if (monitorPanel === "scheduled" && isMonitorOpen) {
      void fetchSchedules();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitorPanel]);


  const latestBatch = activity?.latestBatch || null;
  const upcomingQueue = activity?.upcomingQueue || [];
  const activeSingles = (activity?.activeBatches || []).filter((batch) => batch.type === "single").slice(0, 3);
  const activeBatch = activity?.activeBatches[0] || null;
  const featuredBatch = activeBatch;
  const hasRunningSharedScan = Boolean(
    activity?.activeBatches.some(
      (batch) => batch.status === "running" || batch.status === "queued"
    )
  );
  const miniStreamStatus: "idle" | "connecting" | "connected" | "error" = hasRunningSharedScan
    ? streamStatus === "connected"
      ? "connected"
      : streamStatus === "error"
        ? "error"
        : "connecting"
    : streamStatus === "error"
      ? "error"
      : "idle";
  const canStart = miniStreamStatus !== "connecting" && miniStreamStatus !== "connected";
  const canStop = canScan && Boolean(activeBatch);
  const modalStreamStatus: "idle" | "connecting" | "connected" | "error" =
    checkingConnection || isStarting
      ? "connecting"
      : hasRunningSharedScan
        ? streamStatus === "connected"
          ? "connected"
          : streamStatus === "error"
            ? "error"
            : "connecting"
        : streamStatus;
  const streamChip = streamChipTone(modalStreamStatus);
  const miniStreamChip = streamChipTone(miniStreamStatus);
  const showMiniProgress = miniStreamStatus === "connected" && Boolean(featuredBatch);
  const syncInFlight =
    isStarting ||
    checkingConnection ||
    miniStreamStatus === "connecting" ||
    modalStreamStatus === "connecting";
  const cardStateLabel = activity?.lock.active
    ? "In progress"
    : featuredBatch?.status === "queued"
          ? "Queued"
          : featuredBatch?.status === "running"
            ? "Running"
            : "Idle";
  const modalStateLabel = activity?.lock.active
    ? "In progress"
    : latestBatch?.status === "completed"
      ? "Completed"
      : latestBatch?.status === "cancelled"
        ? "Cancelled"
      : latestBatch?.status === "failed"
        ? "Last attempt failed"
        : latestBatch?.status === "queued"
          ? "Queued"
          : latestBatch?.status === "running"
            ? "Running"
            : "Idle";
  const hasActiveSharedScan = Boolean(activity?.activeBatches.length);
  const liveScanBatch = activeBatch;
  const shouldShowHistoryPanel = hasActiveSharedScan ? showHistoryPanel : true;
  const shouldShowLiveScanPanel = hasActiveSharedScan && monitorPanel === "live";
  const shouldShowQueuePanel = monitorPanel === "queue";
  const shouldShowScheduledPanel = monitorPanel === "scheduled";
  const queuedBatchCount = activity?.queuedBatchCount ?? 0;
  const activeScheduleCount = schedules.filter((s: any) => s.enabled).length;
  const historyEntries = activity?.recentHistory || [];
  const headerActionsHideEnter = 72;
  const headerActionsHideExit = 26;
  const headerCompactEnter = 104;
  const headerCompactExit = 52;
  const effectiveHeaderCompact = isHeaderCompact || hideHeaderActions;
  const serviceWarningEngine = activity?.lock.engine || activeBatch?.engine || latestBatch?.engine || null;
  const outageSignalActive = Boolean(
    error && /endpoint appears unavailable|service unavailable|may stall|nmap api/i.test(error)
  );
  const serviceWarningTitle = `${engineServiceLabel(serviceWarningEngine)} warning`;
  const serviceWarningMessage =
    error ||
    `${engineServiceLabel(serviceWarningEngine)} appears unavailable. Live scans may stall until the service recovers.`;
  const streamOutageLikely =
    streamStatus === "error" &&
    (Boolean(activity?.lock.active) || hasActiveSharedScan || Boolean(activeBatch));
  const progressMarker = useMemo(() => {
    const progressBatch = activity?.activeBatches[0] || activity?.latestBatch || null;
    if (progressBatch) {
      return {
        key: `batch:${progressBatch.id}`,
        score: progressBatch.completedAssets + progressBatch.failedAssets + (progressBatch.percentComplete / 1000),
      };
    }

    if (activity?.lock.batchId) {
      return {
        key: `lock:${activity.lock.batchId}`,
        score: activity.lock.percentComplete / 1000,
      };
    }

    return {
      key: "none",
      score: 0,
    };
  }, [activity]);
  const hasServiceUnavailableCountdown = Number.isFinite(serviceUnavailableRemainingSeconds);
  const serviceUnavailableCountdownSeconds = hasServiceUnavailableCountdown
    ? Math.max(0, Math.ceil(serviceUnavailableRemainingSeconds as number))
    : null;
  const showServiceUnavailableWarning = isServiceWarningSticky || hasServiceUnavailableCountdown;
  const serviceUnavailableCountdownText = serviceUnavailableCountdownSeconds !== null
    ? `${serviceUnavailableCountdownSeconds}s`
    : null;
  const lastSyncText = (() => {
    if (!lastSyncAt) return "Last sync: not available yet.";
    const syncDate = new Date(lastSyncAt);
    if (Number.isNaN(syncDate.getTime())) return "Last sync: not available yet.";
    return `Last sync ${formatDistanceToNow(syncDate, { addSuffix: true })}.`;
  })();

  useEffect(() => {
    if (!isMonitorOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMonitor();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMonitor, isMonitorOpen]);

  useEffect(() => {
    if (!isMonitorOpen) {
      setIsHeaderCompact(false);
      setHideHeaderActions(false);
      setMonitorPanel("live");
      return;
    }

    const container = modalScrollRef.current;
    if (!container) return;

    const onScroll = () => {
      const scrollTop = container.scrollTop;
      setHideHeaderActions((prev) =>
        prev ? scrollTop > headerActionsHideExit : scrollTop > headerActionsHideEnter
      );
      setIsHeaderCompact((prev) =>
        prev ? scrollTop > headerCompactExit : scrollTop > headerCompactEnter
      );
    };

    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", onScroll);
    };
  }, [headerActionsHideEnter, headerActionsHideExit, headerCompactEnter, headerCompactExit, isMonitorOpen]);

  useEffect(() => {
    if (outageSignalActive || streamOutageLikely) {
      if (!isServiceWarningSticky) {
        warningProgressBaselineRef.current = progressMarker;
      }
      setIsServiceWarningSticky(true);
    }
  }, [outageSignalActive, streamOutageLikely, isServiceWarningSticky, progressMarker]);

  useEffect(() => {
    const noActiveScan = !hasActiveSharedScan && !activity?.lock.active;
    const shouldClearAfterShutdown =
      noActiveScan &&
      !outageSignalActive &&
      !streamOutageLikely &&
      serviceUnavailableRemainingSeconds === null;

    if (shouldClearAfterShutdown && isServiceWarningSticky) {
      setIsServiceWarningSticky(false);
      warningProgressBaselineRef.current = null;
    }
  }, [
    activity?.lock.active,
    hasActiveSharedScan,
    isServiceWarningSticky,
    outageSignalActive,
    serviceUnavailableRemainingSeconds,
    streamOutageLikely,
  ]);

  useEffect(() => {
    if (!isServiceWarningSticky) {
      warningProgressBaselineRef.current = null;
      return;
    }

    const baseline = warningProgressBaselineRef.current;
    if (!baseline) {
      warningProgressBaselineRef.current = progressMarker;
      return;
    }

    const progressedInSameBatch = baseline.key === progressMarker.key && progressMarker.score > baseline.score;
    const movedToNewBatch = baseline.key !== "none" && progressMarker.key !== baseline.key && progressMarker.key !== "none";

    if (progressedInSameBatch || movedToNewBatch) {
      setIsServiceWarningSticky(false);
      warningProgressBaselineRef.current = null;
    }
  }, [progressMarker, isServiceWarningSticky]);

  useEffect(() => {
    if (!hasActiveSharedScan) {
      setMonitorPanel("history");
      return;
    }
    setMonitorPanel("live");
  }, [hasActiveSharedScan]);

  const handleStart = async () => {
    if (!canStart) return;
    setIsStarting(true);
    try {
      await startActivityMonitor();
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    if (!canStop || !activeBatch || isStopping) return;
    setIsStopping(true);
    try {
      const latestActivity = await refreshActivity();
      const latestActiveIds = latestActivity?.activeBatches.map((batch) => batch.id) || [];
      const targetBatchId = latestActiveIds.includes(activeBatch.id)
        ? activeBatch.id
        : (latestActiveIds[0] || null);

      if (!targetBatchId) return;
      await cancelBatch(targetBatchId);
    } finally {
      setIsStopping(false);
    }
  };

  const handleCancelQueuedRun = async (runId: string) => {
    if (!canScan || cancellingQueueRunId) return;
    setCancellingQueueRunId(runId);
    try {
      const result = await cancelQueuedRun(runId);
      if (!result.ok) {
        toast.error(result.error || "Failed to cancel queued scheduled scan.");
      } else {
        toast.success("Queued scheduled scan cancelled.");
      }
    } finally {
      setCancellingQueueRunId(null);
    }
  };

  return (
    <>
      <div
        className={`w-full rounded-[1.35rem] border border-white/15 bg-white/10 p-3.5 text-left transition-all hover:bg-white/15 ${
          compact ? "min-w-[230px]" : ""
        }`}
      >
        <div className="w-full text-left">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-xl bg-white/12 text-white">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-black text-white">Activity Monitor</p>
                <span
                  className={`scan-live-dot-mini inline-flex h-3.5 w-3.5 shrink-0 rounded-full border border-white/25 ${
                    miniStreamStatus === "connected"
                      ? "scan-live-dot bg-emerald-400"
                      : miniStreamStatus === "connecting"
                        ? "scan-live-dot bg-amber-500"
                        : miniStreamStatus === "error"
                          ? "bg-red-300"
                          : "bg-stone-300"
                  }`}
                  aria-label={miniStreamChip.label}
                  title={miniStreamChip.label}
                />
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-red-100/80">
                {featuredBatch ? batchLabel(featuredBatch.type, featuredBatch.engine) : "No active shared scans"}
              </p>
              {upcomingQueue.length > 0 && (
                <p className="mt-1 truncate text-[11px] font-semibold text-red-100/75">
                  {upcomingQueue.length} upcoming scheduled {upcomingQueue.length === 1 ? "scan" : "scans"} in queue
                </p>
              )}
            </div>
          </div>
          {showMiniProgress && (
            <div className="mt-3 flex items-center gap-2.5">
              <div className="scan-progress-track h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="scan-progress-fill h-full rounded-full bg-linear-to-r from-amber-300 via-amber-100 to-white transition-all"
                  style={{ width: `${featuredBatch?.percentComplete ?? 0}%` }}
                />
              </div>
              <span className="shrink-0 text-sm font-black text-white">
                {featuredBatch?.percentComplete ?? 0}%
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          {showMiniProgress ? (
            <div className="min-w-0 flex items-center gap-2 text-white/88">
              <span className="truncate font-bold">
                {`${featuredBatch.completedAssets + featuredBatch.failedAssets}/${featuredBatch.totalAssets}`}
              </span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            {showServiceUnavailableWarning && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-red-300/85 bg-red-600/95 px-2 py-1 text-white">
                <span
                  className="scan-mini-warning-badge inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-700 text-white"
                  aria-label={serviceWarningTitle}
                  title={serviceWarningTitle}
                >
                  <AlertTriangle className="scan-mini-warning-icon h-3 w-3" />
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-white">
                  {serviceUnavailableCountdownText || "Warning"}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={openMonitor}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white transition hover:bg-white/25"
              aria-label="Open activity monitor"
              title="Open activity monitor"
            >
              <Maximize2 className="h-4 w-4" />
              {(queuedBatchCount > 0 || activeScheduleCount > 0) && (
                <span className={`absolute -right-1 -top-1 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white shadow-sm ${
                  queuedBatchCount > 0 && activeScheduleCount > 0
                    ? "bg-gradient-to-r from-amber-500 to-blue-500"
                    : activeScheduleCount > 0
                      ? "bg-blue-500"
                      : "bg-amber-500"
                }`}>
                  {queuedBatchCount + activeScheduleCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart || syncInFlight}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-55"
              aria-label={syncInFlight ? "Connecting activity monitor" : "Sync activity monitor"}
              title={syncInFlight ? "Connecting activity monitor" : "Sync activity monitor"}
            >
              {syncInFlight ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {isMonitorOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-[#2b1400]/45 px-4 pb-6 pt-[5.75rem] backdrop-blur-sm"
          onMouseDown={closeMonitor}
        >
          <div
            className="scan-monitor-shell relative flex h-[calc(100vh-7rem)] w-full max-w-[min(820px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.25rem] shadow-[0_28px_80px_rgba(43,20,0,0.36)]"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Activity Monitor"
          >
            <div
              className={`scan-modal-header flex justify-between gap-5 border-b border-white/20 px-6 transition-all duration-300 sm:px-7 ${
                effectiveHeaderCompact ? "items-center py-2" : "items-start py-5"
              }`}
            >
              <div
                className={`transition-all duration-300 ${
                  effectiveHeaderCompact ? "flex min-h-10 items-center" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <h2 className={`leading-none whitespace-nowrap font-extrabold tracking-tight text-white transition-all duration-300 ${effectiveHeaderCompact ? "text-[1.7rem]" : "text-[2.25rem]"}`}>
                    Activity Monitor
                  </h2>
                  <div className="relative">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/12 text-white/90 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                      aria-label="About Activity Monitor"
                      aria-expanded={showInfoTooltip}
                      onMouseEnter={() => setShowInfoTooltip(true)}
                      onMouseLeave={() => setShowInfoTooltip(false)}
                      onFocus={() => setShowInfoTooltip(true)}
                      onBlur={() => setShowInfoTooltip(false)}
                      onClick={() => setShowInfoTooltip((value) => !value)}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                    {showInfoTooltip && (
                      <div className="absolute left-0 top-10 z-20 w-72 rounded-xl border border-white/30 bg-[#5d0000]/94 p-3 text-xs font-medium leading-relaxed text-red-50 shadow-xl backdrop-blur-sm">
                        <p>Track live scan progress, recent runs, and failure diagnostics for this organization.</p>
                        <p className="mt-1 text-red-100/85">Updates reconnect automatically while scans are in progress.</p>
                      </div>
                    )}
                  </div>
                  {effectiveHeaderCompact && (
                    <div className="scan-compact-actions-enter ml-1 flex items-center gap-1.5">
                      <span
                        className="qw-tip inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10"
                        data-tip={streamChip.label}
                        aria-label={streamChip.label}
                      >
                        <span className={`scan-live-dot h-2.5 w-2.5 rounded-full ${streamChip.dot}`} />
                      </span>
                      {canStart && (
                        <button
                          type="button"
                          onClick={handleStart}
                          disabled={syncInFlight}
                          className="qw-tip inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/12 text-white transition hover:bg-white/20"
                          data-tip="Sync now"
                          aria-label="Sync now"
                        >
                          {syncInFlight ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      {canStop && activeBatch && (
                        <button
                          type="button"
                          onClick={handleStop}
                          className="qw-tip inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200/55 bg-red-500/20 text-red-100 transition hover:bg-red-500/30"
                          data-tip="Stop scan"
                          aria-label="Stop scan"
                        >
                          {isStopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      {hasActiveSharedScan && (
                        <button
                          type="button"
                          onClick={() => setMonitorPanel("live")}
                          className={`qw-tip inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs font-bold transition ${
                            monitorPanel === "live"
                              ? "border-white bg-white text-[#6b0000]"
                              : "border-white/30 bg-white/12 text-white hover:bg-white/20"
                          }`}
                          data-tip="Live activity"
                          aria-label="Live activity"
                        >
                          Live
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setMonitorPanel("queue")}
                        className={`qw-tip relative inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs font-bold transition ${
                          monitorPanel === "queue"
                            ? "border-white bg-white text-[#6b0000]"
                            : "border-white/30 bg-white/12 text-white hover:bg-white/20"
                        }`}
                        data-tip="Scan queue"
                        aria-label="Scan queue"
                      >
                        Queue
                        {queuedBatchCount > 0 && (
                          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-extrabold text-white">
                            {queuedBatchCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMonitorPanel("scheduled")}
                        className={`qw-tip relative inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs font-bold transition ${
                          monitorPanel === "scheduled"
                            ? "border-white bg-white text-[#6b0000]"
                            : "border-white/30 bg-white/12 text-white hover:bg-white/20"
                        }`}
                        data-tip="Scheduled scans"
                        aria-label="Scheduled scans"
                      >
                        <CalendarClock className="mr-1 h-3 w-3" />
                        Scheduled
                        {activeScheduleCount > 0 && (
                          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-extrabold text-white">
                            {activeScheduleCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMonitorPanel("history")}
                        className={`qw-tip inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs font-bold transition ${
                          monitorPanel === "history"
                            ? "border-white bg-white text-[#6b0000]"
                            : "border-white/30 bg-white/12 text-white hover:bg-white/20"
                        }`}
                        data-tip="Scan history"
                        aria-label="Scan history"
                      >
                        <Clock3 className="mr-1 h-3 w-3" />
                        History
                      </button>
                    </div>
                  )}
                </div>
                <div
                  className={`mt-4 flex flex-wrap items-center gap-2.5 transition-all duration-300 ${
                    effectiveHeaderCompact
                      ? "invisible max-h-0 overflow-hidden opacity-0 pointer-events-none mt-0"
                      : "visible max-h-24 opacity-100"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/28 bg-white/12 px-3 py-1.5 text-xs font-semibold text-white">
                    <span className={`scan-live-dot h-2 w-2 rounded-full ${streamChip.dot}`} />
                    {streamChip.label}
                  </span>
                  {canStart && (
                    <button
                      type="button"
                      onClick={handleStart}
                      disabled={syncInFlight}
                      className="qw-tip inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/35 bg-white/14 px-4 py-2 text-base/none font-semibold text-white transition hover:bg-white/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
                      data-tip="Sync current scan activity"
                    >
                      {syncInFlight ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Sync now
                    </button>
                  )}
                  {canStop && activeBatch && (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="qw-tip inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-red-200/60 bg-red-500/20 px-4 py-2 text-base/none font-semibold text-red-100 transition hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/70"
                      data-tip="Stop the active organization scan"
                    >
                      {isStopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                      Stop Scan
                    </button>
                  )}
                  {hasActiveSharedScan && (
                    <button
                      type="button"
                      onClick={() => setMonitorPanel("live")}
                      className={`qw-tip inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-base/none font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
                        monitorPanel === "live"
                          ? "border-white bg-white text-[#6b0000] hover:bg-red-50 focus-visible:ring-white/70"
                          : "border-white/35 bg-white/14 text-white hover:bg-white/24 focus-visible:ring-white/55"
                      }`}
                      data-tip="Active scan details"
                    >
                      Live
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMonitorPanel("queue")}
                    className={`qw-tip relative inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-base/none font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
                      monitorPanel === "queue"
                        ? "border-white bg-white text-[#6b0000] hover:bg-red-50 focus-visible:ring-white/70"
                        : "border-white/35 bg-white/14 text-white hover:bg-white/24 focus-visible:ring-white/55"
                    }`}
                    data-tip="View queued and scheduled scans"
                  >
                    Queue
                    {queuedBatchCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-extrabold text-white">
                        {queuedBatchCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonitorPanel("scheduled")}
                    className={`qw-tip relative inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-base/none font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
                      monitorPanel === "scheduled"
                        ? "border-white bg-white text-[#6b0000] hover:bg-red-50 focus-visible:ring-white/70"
                        : "border-white/35 bg-white/14 text-white hover:bg-white/24 focus-visible:ring-white/55"
                    }`}
                    data-tip="View scheduled scans"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Scheduled
                    {activeScheduleCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-extrabold text-white">
                        {activeScheduleCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonitorPanel("history")}
                    className={`qw-tip inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-base/none font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
                      monitorPanel === "history"
                        ? "border-white bg-white text-[#6b0000] hover:bg-red-50 focus-visible:ring-white/70"
                        : "border-white/35 bg-white/14 text-white hover:bg-white/24 focus-visible:ring-white/55"
                    }`}
                    data-tip="Previous scan history"
                  >
                    Scan History
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMonitor}
                className="qw-tip inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/12 text-white/95 backdrop-blur-md transition-all hover:bg-white/18 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
                data-tip="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={modalScrollRef} className="flex-1 overflow-y-auto px-6 py-6 sm:px-7">
              {showServiceUnavailableWarning && (
                <div className="mb-4 rounded-[1.05rem] border border-red-300 bg-red-600 px-4 py-3 text-white shadow-[0_8px_28px_rgba(127,29,29,0.35)]">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="scan-modal-warning-icon mt-0.5 h-5 w-5 shrink-0 text-white" />
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-red-100">Warning</p>
                      <p className="mt-0.5 text-sm font-semibold leading-relaxed text-white">
                        {serviceWarningMessage}
                      </p>
                      {serviceUnavailableCountdownText && (
                        <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.12em] text-red-100">
                          Auto-stop in {serviceUnavailableCountdownText} remaining
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!activity ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <div className="flex items-center gap-3 text-[#8a5d33]/65">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-bold">Loading scan activity…</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {modalStreamStatus !== "connected" && modalStreamStatus !== "connecting" && (
                    <div className="rounded-[1.35rem] border border-slate-200/85 bg-white/45 p-5 backdrop-blur-md">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-[#8a5d33]/55">Live activity</p>
                            <div className="relative">
                              <button
                                type="button"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#8a5d33]/25 bg-white/70 text-[#6b0000] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a5d33]/35"
                                aria-label="About Live Activity"
                                aria-expanded={showLiveActivityInfoTooltip}
                                onMouseEnter={() => setShowLiveActivityInfoTooltip(true)}
                                onMouseLeave={() => setShowLiveActivityInfoTooltip(false)}
                                onFocus={() => setShowLiveActivityInfoTooltip(true)}
                                onBlur={() => setShowLiveActivityInfoTooltip(false)}
                                onClick={() => setShowLiveActivityInfoTooltip((value) => !value)}
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                              {showLiveActivityInfoTooltip && (
                                <div className="absolute left-0 top-8 z-20 w-96 max-w-[min(92vw,24rem)] rounded-xl border border-[#8a5d33]/28 bg-white/95 p-3 text-xs font-medium leading-relaxed text-[#5b3a1f] shadow-xl backdrop-blur-sm">
                                  <p>
                                    Activity Monitor connects you to the live organization scan activity stream, including work started manually or by the background scheduler.
                                  </p>
                                  <p className="mt-1">
                                    When you press Sync, you subscribe to the live SSE activity feed. If no scan is currently running, the monitor simply stays idle until new work appears.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="mt-1.5 text-[1.15rem] leading-snug font-bold text-[#3d200a]">
                            {modalStreamStatus === "error"
                              ? "Connection interrupted. Reconnecting automatically..."
                              : !hasActiveSharedScan
                                ? "No active scan detected."
                              : "Live updates are paused until you press Start."}
                          </p>
                          <p className="mt-1.5 text-[1.02rem] leading-relaxed font-medium text-[#8a5d33]/80">
                            {modalStreamStatus === "error"
                              ? "If a scan is still running, this monitor will reconnect and resume live updates. If it completed, this panel will switch back to idle."
                              : !hasActiveSharedScan
                                ? "Press Sync now to refresh activity."
                              : "This checks for active shared scan work and only opens SSE when there is work in progress."}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#6b0000]">{lastSyncText}</p>
                          {error && (
                            <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleStart}
                          disabled={!canStart || syncInFlight}
                          className="qw-tip inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#8B0000] px-6 py-3 text-base/none font-semibold text-white transition hover:bg-[#6d0000] disabled:cursor-not-allowed disabled:bg-[#8B0000]/50"
                          data-tip="Sync current scan activity"
                        >
                          {syncInFlight ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          Sync now
                        </button>
                      </div>
                    </div>
                  )}

                  {activity.lock.active && (
                    <div className="rounded-[1.75rem] border border-amber-300 bg-amber-50/90 p-5">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-semibold text-amber-800/75">Org scan lock</p>
                            {activity.lock.source && (
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${sourceBadgeMeta(activity.lock.source).tone}`}>
                                {sourceBadgeMeta(activity.lock.source).label}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm font-bold text-amber-900">
                            {activity.lock.message}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-amber-800/80">
                            Initiated by {activity.lock.initiatedBy?.name || activity.lock.initiatedBy?.email || "Unknown"} on {formatWhen(activity.lock.initiatedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <UpcomingQueueSection
                    entries={upcomingQueue}
                    canScan={canScan}
                    cancellingRunId={cancellingQueueRunId}
                    onCancel={handleCancelQueuedRun}
                  />

                  {shouldShowQueuePanel && (
                    <section className="space-y-4">
                      <div>
                        <h3 className="text-[1.75rem] leading-none font-extrabold tracking-tight text-[#3d200a]">Scan Queue</h3>
                        <p className="mt-2 text-sm font-semibold text-[#8a5d33]/75">
                          Batches queued here will execute one-by-one after the currently active scan completes.
                        </p>
                      </div>

                      {(() => {
                        const runningBatch = (activity?.activeBatches || []).find((b) => b.status === "running");
                        const queuedBatches = (activity?.activeBatches || []).filter(
                          (b) => b.status === "queued" && b.id !== (runningBatch?.id ?? (activity?.activeBatches || [])[0]?.id)
                        );

                        if (queuedBatches.length === 0 && upcomingQueue.length === 0) {
                          return (
                            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-amber-500/20 bg-white/50 p-10 text-center">
                              <Clock3 className="h-10 w-10 text-[#8a5d33]/25" />
                              <h3 className="mt-4 text-xl font-black text-[#3d200a]">Queue is empty</h3>
                              <p className="mt-2 max-w-md text-sm font-semibold text-[#8a5d33]/70">
                                Start a scan while another is running to automatically add it to the queue.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {queuedBatches.map((batch, index) => {
                              const sourceMeta = sourceBadgeMeta(batch.source);
                              return (
                                <div
                                  key={batch.id}
                                  className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-[#fffdf9] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 text-[11px] font-extrabold text-amber-700">
                                        #{index + 1}
                                      </span>
                                      <p className="text-sm font-black text-[#3d200a]">{batchLabel(batch.type, batch.engine)}</p>
                                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${sourceMeta.tone}`}>
                                        {sourceMeta.label}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-[#8a5d33]/80">
                                      {batch.totalAssets} {batch.totalAssets === 1 ? "asset" : "assets"} • Queued {formatWhen(batch.createdAt)}
                                    </p>
                                    <p className="mt-0.5 text-xs font-semibold text-[#8a5d33]/65">
                                      by {batch.initiatedBy?.name || batch.initiatedBy?.email || "Unknown"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                                      Queued
                                    </span>
                                    {canScan && (
                                      <button
                                        type="button"
                                        onClick={() => void cancelBatch(batch.id)}
                                        className="inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </section>
                  )}

                  {shouldShowScheduledPanel && (
                    <section className="space-y-4">
                      <div>
                        <h3 className="text-[1.75rem] leading-none font-extrabold tracking-tight text-[#3d200a]">Scheduled Scans</h3>
                        <p className="mt-2 text-sm font-semibold text-[#8a5d33]/75">
                          Scans scheduled for later will automatically run at the chosen time and be added to the queue.
                        </p>
                      </div>

                      {schedulesLoading ? (
                        <div className="flex min-h-[200px] items-center justify-center">
                          <div className="flex items-center gap-3 text-[#8a5d33]/65">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm font-bold">Loading schedules…</span>
                          </div>
                        </div>
                      ) : schedules.length === 0 ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-blue-500/15 bg-white/50 p-10 text-center">
                          <CalendarClock className="h-10 w-10 text-[#8a5d33]/25" />
                          <h3 className="mt-4 text-xl font-black text-[#3d200a]">No scheduled scans</h3>
                          <p className="mt-2 max-w-md text-sm font-semibold text-[#8a5d33]/70">
                            Use &ldquo;Schedule for Later&rdquo; from any scan dialog to set up a future scan.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {schedules.map((schedule: any) => {
                            const isDeleting = deletingScheduleId === schedule.id;
                            const engineLabel =
                              schedule.engine === "portDiscovery"
                                ? "Port Discovery"
                                : schedule.engine === "openssl"
                                  ? "OpenSSL Scan"
                                  : schedule.engine || "Scan";
                            const typeLabel =
                              schedule.type === "full"
                                ? "Full"
                                : schedule.type === "group"
                                  ? "Group"
                                  : schedule.type === "single"
                                    ? "Single"
                                    : schedule.type;
                            const nextRun = schedule.nextRunAt ? new Date(schedule.nextRunAt) : null;
                            const isPast = nextRun && nextRun.getTime() <= Date.now();
                            const assetCount = Array.isArray(schedule.assetIds) ? schedule.assetIds.length : 0;

                            return (
                              <div
                                key={schedule.id}
                                className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-[#fffdf9] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <CalendarClock className="h-4 w-4 text-blue-500" />
                                    <p className="text-sm font-black text-[#3d200a]">{engineLabel} — {typeLabel}</p>
                                    {schedule.mode === "one_time" && (
                                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
                                        One-time
                                      </span>
                                    )}
                                    {schedule.mode === "recurring" && (
                                      <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-purple-700">
                                        Recurring
                                      </span>
                                    )}
                                    {!schedule.enabled && (
                                      <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-stone-500">
                                        Disabled
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-sm font-semibold text-[#8a5d33]/80">
                                    {assetCount} {assetCount === 1 ? "asset" : "assets"}
                                    {nextRun && (
                                      <>
                                        {" • "}
                                        {isPast ? (
                                          <span className="text-amber-600">
                                            Due {formatDistanceToNow(nextRun, { addSuffix: true })}
                                          </span>
                                        ) : (
                                          <>
                                            Runs {formatDistanceToNow(nextRun, { addSuffix: true })}
                                            <span className="text-[#8a5d33]/55"> ({nextRun.toLocaleString()})</span>
                                          </>
                                        )}
                                      </>
                                    )}
                                    {!nextRun && schedule.enabled && (
                                      <span className="text-stone-400"> • Completed</span>
                                    )}
                                  </p>
                                  {schedule.createdByEmail && (
                                    <p className="mt-0.5 text-xs font-semibold text-[#8a5d33]/55">
                                      by {schedule.createdByName || schedule.createdByEmail}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {schedule.enabled && nextRun && (
                                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                                      Active
                                    </span>
                                  )}
                                  {canScan && (
                                    <button
                                      type="button"
                                      onClick={() => void deleteSchedule(schedule.id)}
                                      disabled={isDeleting}
                                      className="inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                    >
                                      {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  )}

                  {shouldShowLiveScanPanel && liveScanBatch && (
                    <BatchSection batch={liveScanBatch} />
                  )}

                  {!latestBatch && historyEntries.length === 0 && !shouldShowLiveScanPanel && (
                    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-amber-500/20 bg-white/50 p-10 text-center">
                      <Clock3 className="h-10 w-10 text-[#8a5d33]/25" />
                      <h3 className="mt-4 text-xl font-black text-[#3d200a]">No scan batches yet</h3>
                      <p className="mt-2 max-w-md text-sm font-semibold text-[#8a5d33]/70">
                        Once someone in this organization starts a scan or port-discovery run, it will appear here with shared progress.
                      </p>
                    </div>
                  )}

                  {activeSingles.length > 1 && (
                    <section className="rounded-[1.75rem] border border-amber-500/10 bg-white/60 p-5">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4.5 w-4.5 text-[#8B0000]" />
                        <h3 className="text-lg font-black tracking-tight text-[#3d200a]">Other Active Single Scans</h3>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {activeSingles.slice(latestBatch?.type === "single" ? 1 : 0).map((batch) => (
                          <div key={batch.id} className="rounded-2xl border border-amber-500/10 bg-[#fffdf9] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-black text-[#3d200a]">{batchLabel(batch.type, batch.engine)}</p>
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${sourceBadgeMeta(batch.source).tone}`}>
                                    {sourceBadgeMeta(batch.source).label}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-[#8a5d33]/65">
                                  {batch.initiatedBy?.name || batch.initiatedBy?.email || "Unknown"} • {formatWhen(batch.createdAt)}
                                </p>
                              </div>
                              <span className="text-lg font-black text-[#8B0000]">{batch.percentComplete}%</span>
                            </div>
                            <div className="scan-progress-track mt-3 h-2 overflow-hidden rounded-full bg-amber-100">
                              <div className="scan-progress-fill h-full rounded-full bg-linear-to-r from-[#8B0000] to-amber-500" style={{ width: `${batch.percentComplete}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {shouldShowHistoryPanel && historyEntries.length > 0 && (
                    <section className="rounded-[1.35rem] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[2rem] leading-none font-extrabold tracking-tight text-[#3d200a]">Scan History</h3>
                          <div className="relative">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#8a5d33]/25 bg-white/60 text-[#6b0000] transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a5d33]/35"
                              aria-label="About Scan History"
                              aria-expanded={showHistoryInfoTooltip}
                              onMouseEnter={() => setShowHistoryInfoTooltip(true)}
                              onMouseLeave={() => setShowHistoryInfoTooltip(false)}
                              onFocus={() => setShowHistoryInfoTooltip(true)}
                              onBlur={() => setShowHistoryInfoTooltip(false)}
                              onClick={() => setShowHistoryInfoTooltip((value) => !value)}
                            >
                              <Info className="h-4 w-4" />
                            </button>
                            {showHistoryInfoTooltip && (
                              <div className="absolute left-0 top-10 z-20 w-80 rounded-xl border border-[#8a5d33]/28 bg-white/95 p-3 text-xs font-medium leading-relaxed text-[#5b3a1f] shadow-xl backdrop-blur-sm">
                                <p>Shows recent single, group, and full scan batches with timing and categorized asset outcomes.</p>
                                <p className="mt-1">Open any entry to inspect the passed, timeout, DNS expired, and failed assets from that run.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {historyEntries.map((entry) => {
                          const isOpen = openHistoryBatchId === entry.batchId;

                          return (
                          <div
                            key={entry.batchId}
                            className={`scan-history-accordion group rounded-2xl bg-white ${
                              isOpen ? "is-open" : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setOpenHistoryBatchId((current) => (current === entry.batchId ? null : entry.batchId))}
                              className="scan-history-summary flex w-full cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                              aria-expanded={isOpen}
                            >
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="scan-history-title text-sm font-black text-[#3d200a]">{batchLabel(entry.type, entry.engine)}</p>
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${sourceBadgeMeta(entry.source).tone}`}>
                                    {sourceBadgeMeta(entry.source).label}
                                  </span>
                                </div>
                                <p className="scan-history-meta mt-1 text-xs font-semibold text-[#8a5d33]/70">
                                  {formatWhen(entry.completedAt || entry.createdAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  Passed: {entry.passedAssets}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  Timeout: {entry.timeoutAssets}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  DNS Expired: {entry.dnsExpiredAssets}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  Failed: {entry.failedAssets}
                                </span>
                                <span className={`scan-history-chevron inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#8a5d33] transition-transform duration-200 ${
                                  isOpen ? "rotate-180" : ""
                                }`}>
                                  <ChevronDown className="h-4 w-4" />
                                </span>
                              </div>
                            </button>
                            <div className="scan-history-expand">
                              <div className="scan-history-main">
                                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                  <div className="rounded-xl border border-amber-500/10 bg-white px-3 py-2">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6b0000]">Time</p>
                                    <p className="mt-1 text-sm font-black text-[#3d200a]">{formatDuration(entry.durationSeconds)}</p>
                                  </div>
                                  <div className="rounded-xl border border-amber-500/10 bg-white px-3 py-2">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6b0000]">Passed</p>
                                    <p className="mt-1 text-sm font-black text-emerald-700">{entry.passedAssets}</p>
                                  </div>
                                  <div className="rounded-xl border border-amber-500/10 bg-white px-3 py-2">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6b0000]">Timeout</p>
                                    <p className="mt-1 text-sm font-black text-amber-700">{entry.timeoutAssets}</p>
                                  </div>
                                  <div className="rounded-xl border border-amber-500/10 bg-white px-3 py-2">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6b0000]">DNS Expired</p>
                                    <p className="mt-1 text-sm font-black text-rose-700">{entry.dnsExpiredAssets}</p>
                                  </div>
                                  <div className="rounded-xl border border-amber-500/10 bg-white px-3 py-2">
                                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6b0000]">Failed</p>
                                    <p className="mt-1 text-sm font-black text-red-700">{entry.failedAssets}</p>
                                  </div>
                                </div>
                                <HistoryBatchSection entry={entry} />
                              </div>
                            </div>
                          </div>
                        );})}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .scan-monitor-shell {
          border: 1px solid rgba(156, 197, 255, 0.55);
          background-color: rgba(242, 248, 255, 0.95);
          background-image:
            radial-gradient(circle at 1px 1px, rgba(90, 0, 24, 0.42) 1.1px, transparent 1.2px),
            linear-gradient(180deg, rgba(245, 250, 255, 0.97), rgba(252, 254, 255, 0.93));
          background-size: 16px 16px, 100% 100%;
          background-position: 0 0, 0 0;
        }

        .scan-modal-header {
          background-color: #8b0000;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.11) 1px, transparent 1px),
            linear-gradient(180deg, rgba(165, 0, 0, 0) 0%, rgba(80, 0, 0, 0.42) 100%);
          background-size: 30px 30px, 30px 30px, 100% 100%;
        }

        .qw-tip {
          position: relative;
        }

        .scan-live-dot {
          position: relative;
          overflow: visible;
          box-shadow: 0 0 0 rgba(16, 185, 129, 0.35);
        }

        .scan-live-dot::after {
          content: "";
          position: absolute;
          inset: -5px;
          border-radius: 9999px;
          border: 1.5px solid transparent;
          opacity: 0;
          transform: scale(0.7);
          pointer-events: none;
        }

        .scan-live-dot-mini::after {
          inset: -8px;
          border-width: 2px;
        }

        .scan-shimmer {
          position: relative;
          overflow: hidden;
        }

        .scan-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-140%);
          background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.28) 45%, transparent 70%);
          animation: scan-shimmer 2.2s ease-in-out infinite;
        }

        .scan-progress-fill {
          position: relative;
          overflow: hidden;
        }

        .scan-progress-track {
          overflow: visible;
        }

        .scan-progress-fill::after {
          content: "";
          position: absolute;
          inset: -2px -12px;
          border-radius: 9999px;
          background: linear-gradient(
            90deg,
            rgba(255, 185, 46, 0) 0%,
            rgba(255, 208, 91, 0.2) 40%,
            rgba(255, 245, 194, 0.98) 50%,
            rgba(255, 208, 91, 0.2) 60%,
            rgba(255, 185, 46, 0) 100%
          );
          box-shadow: 0 0 8px rgba(255, 209, 82, 0.55);
          animation: scan-progress-flow 1.8s linear infinite;
        }

        .scan-progress-fill-static::after {
          content: none;
          animation: none;
        }

        .scan-running-card {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          background: linear-gradient(112deg, #fffcf2 0%, #fff1cc 38%, #ffe7a6 50%, #fff1cc 62%, #fffcf2 100%);
          background-size: 220% 100%;
          animation: scan-card-bg-shimmer 5.4s linear infinite;
          box-shadow: inset 0 0 0 1px rgba(245, 178, 62, 0.08);
          transition:
            background 220ms ease,
            box-shadow 220ms ease,
            border-color 220ms ease;
        }

        .scan-running-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: linear-gradient(118deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0) 34%, rgba(255, 232, 163, 0.44) 45%, rgba(255, 255, 255, 0.98) 50%, rgba(255, 232, 163, 0.44) 55%, rgba(255, 255, 255, 0) 66%, rgba(255, 255, 255, 0) 100%);
          transform: translateX(-140%);
          animation: scan-card-shimmer-pass 2.4s ease-in-out infinite;
        }

        .scan-running-card::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            linear-gradient(180deg, rgba(255, 214, 51, 0.08), rgba(255, 214, 51, 0)),
            radial-gradient(circle at 18% 50%, rgba(255, 224, 122, 0.26), transparent 34%),
            radial-gradient(circle at 82% 50%, rgba(255, 224, 122, 0.2), transparent 28%);
          animation: scan-card-glow-pulse 3.4s ease-in-out infinite;
        }

        .scan-running-card-completed {
          background: linear-gradient(112deg, #effcf6 0%, #dcfce7 45%, #bbf7d0 100%);
          box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.2);
          animation: none;
        }

        .scan-running-card-completed::before,
        .scan-running-card-completed::after {
          content: none;
          animation: none;
        }

        .scan-running-card-content {
          position: relative;
          z-index: 1;
        }

        .scan-running-card-enter {
          opacity: 0;
          filter: blur(3px);
          transform: translateY(6px) scale(0.988);
          animation: scan-running-card-enter 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .scan-running-card-exit {
          opacity: 0;
          filter: blur(2px);
          transform: translateY(-2px) scale(0.992);
          transition:
            opacity 180ms ease,
            filter 180ms ease,
            transform 180ms ease;
        }

        .scan-history-accordion.is-open .scan-history-summary {
          background: transparent;
          border-top-left-radius: 1rem;
          border-top-right-radius: 1rem;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .scan-history-accordion.is-open {
          background-color: #0f2748;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(180deg, rgba(28, 68, 122, 0) 0%, rgba(8, 22, 45, 0.42) 100%);
          background-size: 26px 26px, 26px 26px, 100% 100%;
          border-color: rgba(191, 219, 254, 0.45);
        }

        .scan-history-accordion.is-open .scan-history-chevron {
          color: rgba(255, 244, 244, 0.95);
          background: rgba(255, 255, 255, 0.16);
        }

        .scan-history-accordion.is-open .scan-history-title,
        .scan-history-accordion.is-open .scan-history-meta {
          color: #fff2f2;
        }

        .scan-history-accordion.is-open .scan-history-status-badge {
          background: rgba(241, 245, 249, 0.92);
          color: #475569;
        }

        .scan-history-accordion.is-open .scan-history-state-icon {
          background: rgba(241, 245, 249, 0.92);
        }

        .scan-history-accordion {
          overflow: hidden;
        }

        .scan-history-expand {
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transform: translateY(-6px);
          transition: max-height 0.38s ease, opacity 0.26s ease, transform 0.32s ease;
        }

        .scan-history-accordion.is-open .scan-history-expand {
          max-height: 1800px;
          opacity: 1;
          transform: translateY(0);
        }

        .scan-history-main {
          margin-top: 0;
          padding: 6px;
          border-top: 0;
          background: transparent;
        }

        .scan-history-main .scan-batch-section {
          background: #ffffff;
          border-color: rgba(203, 213, 225, 0.82);
          box-shadow: none;
        }

        .scan-history-main .scan-batch-section .min-w-\[220px\] {
          background: rgba(244, 244, 245, 0.92);
          border-color: rgba(212, 216, 223, 0.86);
        }

        .scan-history-main .scan-batch-section .min-w-\[220px\] p,
        .scan-history-main .scan-batch-section .min-w-\[220px\] span {
          color: #334155;
        }

        .scan-history-main .scan-batch-section .min-w-\[220px\] .text-emerald-600 {
          color: #0f766e;
        }

        .scan-history-main .scan-batch-section .min-w-\[220px\] .text-red-600,
        .scan-history-main .scan-batch-section .min-w-\[220px\] .text-amber-600 {
          color: #475569;
        }

        .scan-history-main .scan-batch-section .scan-progress-track {
          background: #e2e8f0;
        }

        .scan-history-main .scan-batch-section .scan-progress-fill {
          background: linear-gradient(90deg, #475569 0%, #64748b 100%);
        }

        .scan-history-main .scan-batch-section .text-emerald-600,
        .scan-history-main .scan-batch-section .text-red-600,
        .scan-history-main .scan-batch-section .text-amber-600 {
          color: #475569;
        }

        .scan-history-main .scan-batch-section .border-amber-500\/15.bg-white,
        .scan-history-main .scan-batch-section .border-amber-500\/15.bg-\[\#fffdf9\] {
          border-color: rgba(203, 213, 225, 0.9);
          background: #f8fafc;
        }

        .scan-history-main .scan-batch-section thead tr {
          background: #e8ecf2;
        }

        .scan-history-main .scan-batch-section th {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #475569;
        }

        .scan-history-main .scan-batch-section tbody tr {
          border-top-color: #e2e8f0;
        }

        .scan-history-main .scan-batch-section tbody tr:nth-child(odd) {
          background: #ffffff;
        }

        .scan-history-main .scan-batch-section tbody tr:nth-child(even) {
          background: #f8fafc;
        }

        .scan-history-main .scan-batch-section tbody tr:hover {
          background: #eef2f7;
        }

        .scan-history-main .scan-batch-section tbody td:first-child p {
          font-size: 1.02rem;
          font-weight: 650;
          color: #334155;
        }

        .scan-history-main .scan-batch-section tbody td:nth-child(2) span {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .scan-history-main .scan-batch-section tbody td:nth-child(3) p {
          font-size: 0.9rem;
          font-weight: 500;
          color: #64748b;
        }

        .scan-history-main .rounded-\[1\.6rem\] {
          border-radius: 1.1rem;
          margin: 0;
        }

        .scan-history-status-pulse {
          animation: scan-history-status-pulse 1.8s ease-in-out infinite;
        }

        .scan-live-dot.bg-emerald-500 {
          animation: scan-live-pulse 1.8s ease-out infinite;
        }

        .scan-live-dot.bg-emerald-500::after,
        .scan-live-dot.bg-emerald-400::after {
          border-color: rgba(52, 211, 153, 0.55);
          animation: scan-live-radar 1.35s ease-out infinite;
        }

        .scan-live-dot-mini.bg-emerald-400::after,
        .scan-live-dot-mini.bg-emerald-500::after {
          border-color: rgba(52, 211, 153, 0.82);
          animation: scan-live-radar 1.05s ease-out infinite;
        }

        .scan-live-dot.bg-amber-500 {
          animation: scan-live-pulse 1.8s ease-out infinite;
        }

        .scan-live-dot.bg-amber-500::after {
          border-color: rgba(245, 158, 11, 0.58);
          animation: scan-live-radar 1.35s ease-out infinite;
        }

        .scan-live-dot-mini.bg-amber-500::after {
          border-color: rgba(245, 158, 11, 0.86);
          animation: scan-live-radar 1.05s ease-out infinite;
        }

        .scan-compact-actions-enter {
          animation: scan-compact-actions-enter 220ms ease-out;
        }

        .scan-mini-warning-badge {
          position: relative;
          animation: scan-mini-warning-pulse 1.2s ease-in-out infinite;
          box-shadow: 0 0 0 rgba(220, 38, 38, 0.5);
        }

        .scan-mini-warning-badge::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 9999px;
          border: 1.5px solid rgba(255, 255, 255, 0.9);
          opacity: 0;
          transform: scale(0.78);
          animation: scan-mini-warning-radar 1.2s ease-out infinite;
          pointer-events: none;
        }

        .scan-mini-warning-icon {
          animation: scan-mini-warning-icon-blink 1.2s ease-in-out infinite;
        }

        .scan-modal-warning-icon {
          animation: scan-mini-warning-icon-blink 1.2s ease-in-out infinite;
        }

        @keyframes scan-shimmer {
          100% {
            transform: translateX(140%);
          }
        }

        @keyframes scan-progress-flow {
          0% {
            transform: translateX(-92%);
          }

          100% {
            transform: translateX(92%);
          }
        }

        @keyframes scan-card-shimmer-pass {
          0% {
            transform: translateX(-140%);
          }

          100% {
            transform: translateX(140%);
          }
        }

        @keyframes scan-card-bg-shimmer {
          0% {
            background-position: 0% 50%;
          }

          100% {
            background-position: 200% 50%;
          }
        }

        @keyframes scan-card-glow-pulse {
          0%,
          100% {
            opacity: 0.75;
          }

          50% {
            opacity: 1;
          }
        }

        @keyframes scan-live-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35);
            opacity: 0.9;
          }

          70% {
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
            opacity: 1;
          }

          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
            opacity: 0.9;
          }
        }

        @keyframes scan-live-radar {
          0% {
            transform: scale(0.65);
            opacity: 0.65;
          }

          100% {
            transform: scale(1.9);
            opacity: 0;
          }
        }

        @keyframes scan-history-status-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.28);
          }

          50% {
            box-shadow: 0 0 0 5px rgba(245, 158, 11, 0);
          }
        }

        @keyframes scan-running-card-enter {
          0% {
            opacity: 0;
            filter: blur(3px);
            transform: translateY(6px) scale(0.988);
          }

          100% {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0) scale(1);
          }
        }

        @keyframes scan-compact-actions-enter {
          0% {
            opacity: 0.2;
            transform: translateY(-2px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scan-mini-warning-pulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5);
          }

          50% {
            transform: scale(1.08);
            box-shadow: 0 0 0 6px rgba(220, 38, 38, 0);
          }
        }

        @keyframes scan-mini-warning-radar {
          0% {
            opacity: 0.95;
            transform: scale(0.72);
          }

          100% {
            opacity: 0;
            transform: scale(1.38);
          }
        }

        @keyframes scan-mini-warning-icon-blink {
          0%,
          100% {
            opacity: 1;
          }

          50% {
            opacity: 0.55;
          }
        }
      `}</style>
    </>
  );
}
