"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { OrgScanActivityPayload, ScanBatchType, ScanEngine } from "@/lib/scan-activity-types";

const STREAM_RECONNECT_BASE_MS = 1000;
const STREAM_RECONNECT_MAX_MS = 15000;
const STREAM_ROTATE_AFTER_MS = 255000;
const STREAM_NO_ACTIVE_GRACE_CHECKS = 2;
const LAST_SYNC_STORAGE_PREFIX = "scan-activity-last-sync:";
const SCAN_REQUEST_TIMEOUT_MS = 20000;
const WORKFLOW_POLL_INTERVAL_MS = 5000;

interface CreateBatchInput {
  orgId: string;
  type: ScanBatchType;
  assetIds: string[];
  engine?: ScanEngine;
  configSnapshot?: unknown;
}

interface CancelBatchInput {
  orgId: string;
  batchId: string;
}

interface CancelQueuedRunInput {
  orgId: string;
  runId: string;
}

interface RegisteredOrgOptions {
  orgId: string;
  orgSlug?: string;
}

type StreamIntent = "off" | "manual" | "batch-driven";
type StreamStatus = "idle" | "connecting" | "connected" | "error";

interface OrgActivityState {
  data: OrgScanActivityPayload | null;
  loading: boolean;
  error: string | null;
  serviceUnavailableRemainingSeconds: number | null;
  checkingConnection: boolean;
  orgSlug?: string;
  lastSyncAt: string | null;
  connected: boolean;
  streamIntent: StreamIntent;
  streamStatus: StreamStatus;
  pendingBatchType: ScanBatchType | null;
  pendingBatchEngine: ScanEngine | null;
  cancellingBatchId: string | null;
}

interface StreamConnectionState {
  source: EventSource | null;
  reconnectAttempt: number;
  reconnectTimer: number | null;
  rotationTimer: number | null;
}

interface ScanActivityContextValue {
  hydrated: boolean;
  monitorOrgId: string | null;
  openMonitor: (orgId: string) => void;
  closeMonitor: () => void;
  registerOrg: (options: RegisteredOrgOptions) => void;
  unregisterOrg: (orgId: string) => void;
  getOrgState: (orgId: string) => OrgActivityState;
  refreshOrgActivity: (orgId: string) => Promise<OrgScanActivityPayload | null>;
  checkForActiveScans: (
    orgId: string,
    options?: { showIdleToast?: boolean; startStreamOnActive?: boolean }
  ) => Promise<OrgScanActivityPayload | null>;
  startActivityMonitor: (orgId: string) => Promise<void>;
  createBatch: (input: CreateBatchInput) => Promise<{ ok: boolean; error?: string }>;
  cancelBatch: (input: CancelBatchInput) => Promise<{ ok: boolean; error?: string }>;
  cancelQueuedRun: (input: CancelQueuedRunInput) => Promise<{ ok: boolean; error?: string }>;
}

const ScanActivityContext = createContext<ScanActivityContextValue | null>(null);

function lastSyncStorageKey(orgId: string) {
  return `${LAST_SYNC_STORAGE_PREFIX}${orgId}`;
}

function readStoredLastSync(orgId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(lastSyncStorageKey(orgId));
  } catch {
    return null;
  }
}

function writeStoredLastSync(orgId: string, syncedAt: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lastSyncStorageKey(orgId), syncedAt);
  } catch {
    // Ignore storage write failures so sync state still works in memory.
  }
}

function batchActionLabel(type: ScanBatchType | null | undefined, engine: ScanEngine | null | undefined) {
  if (engine === "portDiscovery") {
    if (type === "full") return "full port discovery";
    if (type === "group") return "group port discovery";
    if (type === "single") return "single port discovery";
    return "port discovery";
  }

  if (type === "full") return "full scan";
  if (type === "group") return "group scan";
  if (type === "single") return "scan";
  return "scan";
}

const defaultOrgState: OrgActivityState = {
  data: null,
  loading: true,
  error: null,
  serviceUnavailableRemainingSeconds: null,
  checkingConnection: false,
  lastSyncAt: null,
  connected: false,
  streamIntent: "off",
  streamStatus: "idle",
  pendingBatchType: null,
  pendingBatchEngine: null,
  cancellingBatchId: null,
};

export function ScanActivityProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [monitorOrgId, setMonitorOrgId] = useState<string | null>(null);
  const [orgStates, setOrgStates] = useState<Record<string, OrgActivityState>>({});
  const orgStatesRef = useRef<Record<string, OrgActivityState>>({});
  const subscriptionsRef = useRef<Map<string, { count: number; orgSlug?: string }>>(new Map());
  const refreshPromisesRef = useRef<Map<string, Promise<OrgScanActivityPayload | null>>>(new Map());
  const streamConnectionsRef = useRef<Map<string, StreamConnectionState>>(new Map());
  const createBatchPromisesRef = useRef<Map<string, Promise<{ ok: boolean; error?: string }>>>(new Map());
  const noActiveGraceChecksRef = useRef<Map<string, number>>(new Map());
  // Stable ref to ensureOrgStream to avoid circular dependency with applyActivityState
  const ensureOrgStreamRef = useRef<((orgId: string, intent: StreamIntent, activity?: OrgScanActivityPayload | null) => Promise<void>) | null>(null);
  // Tracks which workflow+step pairs we've already toasted, so we don't re-fire
  const workflowSeenRef = useRef<Set<string>>(new Set());
  // Poller interval IDs per org
  const workflowPollersRef = useRef<Map<string, number>>(new Map());

  const setOrgState = useCallback((orgId: string, nextState: OrgActivityState) => {
    setOrgStates((previous) => {
      const next = { ...previous, [orgId]: nextState };
      orgStatesRef.current = next;
      return next;
    });
  }, []);

  const applyActivityState = useCallback((
    orgId: string,
    activity: OrgScanActivityPayload,
    options?: { connected?: boolean; error?: string | null }
  ) => {
    const previous = orgStatesRef.current[orgId] || defaultOrgState;
    const hadActiveBatches = Boolean(previous.data?.activeBatches?.length);
    const hasActiveBatches = Boolean(activity.activeBatches.length);
    const syncedAt = new Date().toISOString();

    writeStoredLastSync(orgId, syncedAt);

    if (hasActiveBatches) {
      noActiveGraceChecksRef.current.set(orgId, 0);
    }

    if (hadActiveBatches && !hasActiveBatches && previous.streamIntent !== "off") {
      toast.success("Scan completed. Live monitor is now idle.");
    }

    // Detect newly appeared batches and auto-start SSE stream for live progress
    if (hasActiveBatches) {
      const previousBatchIds = new Set(
        (previous.data?.activeBatches || []).map((b) => b.id)
      );
      let hasNewBatch = false;
      for (const batch of activity.activeBatches) {
        if (!previousBatchIds.has(batch.id)) {
          hasNewBatch = true;

          // Show toast for automated batches only
          if (batch.source === "automated") {
            const engineLabel = batch.engine === "portDiscovery" ? "port discovery"
              : batch.engine === "subdomainDiscovery" ? "subdomain discovery"
              : "SSL scan";
            const typeLabel = batch.type === "full" ? "Full" : batch.type === "group" ? "Group" : "Single";
            toast.info(`${typeLabel} ${engineLabel} started automatically.`, {
              id: `auto-batch-${batch.id}`,
              duration: 8000,
              position: "bottom-right",
              action: {
                label: "View",
                onClick: () => setMonitorOrgId(orgId),
              },
            });
          }
        }
      }

      // Start SSE stream for any new batch (manual or automated) so the UI goes green
      if (hasNewBatch) {
        const latestState = orgStatesRef.current[orgId] || defaultOrgState;
        if (latestState.streamIntent === "off" && ensureOrgStreamRef.current) {
          void ensureOrgStreamRef.current(orgId, "batch-driven", activity);
        }
      }
    }

    setOrgState(orgId, {
      data: activity,
      loading: false,
      error: options?.error ?? null,
      serviceUnavailableRemainingSeconds: null,
      checkingConnection: previous.checkingConnection,
      orgSlug: previous.orgSlug,
      lastSyncAt: syncedAt,
      connected: options?.connected ?? previous.connected,
      streamIntent: previous.streamIntent,
      streamStatus: options?.connected
        ? "connected"
        : previous.streamStatus === "error" && options?.error
          ? "error"
          : previous.streamStatus,
      pendingBatchType: previous.pendingBatchType,
      pendingBatchEngine: previous.pendingBatchEngine,
      cancellingBatchId: previous.cancellingBatchId,
    });
  }, [setOrgState]);

  const setCheckingConnection = useCallback((orgId: string, checking: boolean) => {
    const previous = orgStatesRef.current[orgId] || defaultOrgState;
    setOrgState(orgId, {
      ...previous,
      checkingConnection: checking,
    });
  }, [setOrgState]);

  const refreshOrgActivity = useCallback(async (orgId: string) => {
    const existingPromise = refreshPromisesRef.current.get(orgId);
    if (existingPromise) {
      return existingPromise;
    }

    const previous = orgStatesRef.current[orgId] || defaultOrgState;
    setOrgState(orgId, { ...previous, loading: previous.data ? false : true, error: null });

    const refreshPromise = (async (): Promise<OrgScanActivityPayload | null> => {
      try {
        const response = await fetch(`/api/orgs/scans/activity?orgId=${encodeURIComponent(orgId)}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to fetch scan activity.");
        }

        // Route through applyActivityState so automated-batch detection runs on every poll
        const subscription = subscriptionsRef.current.get(orgId);
        const latestPrev = orgStatesRef.current[orgId] || defaultOrgState;
        if (subscription?.orgSlug && !latestPrev.orgSlug) {
          setOrgState(orgId, { ...latestPrev, orgSlug: subscription.orgSlug });
        }
        applyActivityState(orgId, data, {
          connected: (orgStatesRef.current[orgId] || defaultOrgState).connected,
          error: null,
        });

        return data;
      } catch (error: any) {
        setOrgState(orgId, {
          ...previous,
          loading: false,
          error: error?.message || "Failed to fetch scan activity.",
        });
        return null;
      } finally {
        refreshPromisesRef.current.delete(orgId);
      }
    })();

    refreshPromisesRef.current.set(orgId, refreshPromise);
    return refreshPromise;
  }, [setOrgState, applyActivityState]);

  const setStreamState = useCallback((
    orgId: string,
    options: {
      streamIntent?: StreamIntent;
      streamStatus?: StreamStatus;
      connected?: boolean;
      error?: string | null;
    }
  ) => {
    const previous = orgStatesRef.current[orgId] || defaultOrgState;
    setOrgState(orgId, {
      ...previous,
      connected: options.connected ?? previous.connected,
      error: options.error !== undefined ? options.error : previous.error,
      serviceUnavailableRemainingSeconds: previous.serviceUnavailableRemainingSeconds,
      streamIntent: options.streamIntent ?? previous.streamIntent,
      streamStatus: options.streamStatus ?? previous.streamStatus,
      pendingBatchType: previous.pendingBatchType,
      pendingBatchEngine: previous.pendingBatchEngine,
      cancellingBatchId: previous.cancellingBatchId,
      lastSyncAt: previous.lastSyncAt,
    });
  }, [setOrgState]);

  const closeOrgStream = useCallback((orgId: string) => {
    const existing = streamConnectionsRef.current.get(orgId);
    if (!existing) return;

    if (existing.reconnectTimer) {
      window.clearTimeout(existing.reconnectTimer);
    }

    if (existing.rotationTimer) {
      window.clearTimeout(existing.rotationTimer);
    }

    existing.source?.close();
    streamConnectionsRef.current.set(orgId, {
      source: null,
      reconnectAttempt: existing.reconnectAttempt,
      reconnectTimer: null,
      rotationTimer: null,
    });
  }, []);

  const stopOrgStreaming = useCallback((
    orgId: string,
    options?: { clearIntent?: boolean; error?: string | null }
  ) => {
    closeOrgStream(orgId);
    noActiveGraceChecksRef.current.set(orgId, 0);
    const previous = orgStatesRef.current[orgId] || defaultOrgState;
    setOrgState(orgId, {
      ...previous,
      connected: false,
      error: options?.error ?? null,
      serviceUnavailableRemainingSeconds: null,
      streamIntent: options?.clearIntent === false ? previous.streamIntent : "off",
      streamStatus: options?.error ? "error" : "idle",
      pendingBatchType: previous.pendingBatchType,
      pendingBatchEngine: previous.pendingBatchEngine,
      cancellingBatchId: previous.cancellingBatchId,
      lastSyncAt: previous.lastSyncAt,
    });
  }, [closeOrgStream, setOrgState]);

  const scheduleReconnect = useCallback((orgId: string) => {
    const subscription = subscriptionsRef.current.get(orgId);
    if (!subscription) return;

    const existing = streamConnectionsRef.current.get(orgId) || {
      source: null,
      reconnectAttempt: 0,
      reconnectTimer: null,
      rotationTimer: null,
    };

    if (existing.reconnectTimer) return;

    const nextAttempt = existing.reconnectAttempt + 1;
    const delay = Math.min(
      STREAM_RECONNECT_BASE_MS * (2 ** (nextAttempt - 1)),
      STREAM_RECONNECT_MAX_MS
    );

    const timer = window.setTimeout(async () => {
      const latest = streamConnectionsRef.current.get(orgId);
      streamConnectionsRef.current.set(orgId, {
        source: latest?.source || null,
        reconnectAttempt: nextAttempt,
        reconnectTimer: null,
        rotationTimer: latest?.rotationTimer || null,
      });

      const activity = await refreshOrgActivity(orgId);
      const latestState = orgStatesRef.current[orgId] || defaultOrgState;
      const shouldReconnect = latestState.streamIntent !== "off" && Boolean(activity?.activeBatches.length);

      if (shouldReconnect && subscriptionsRef.current.has(orgId)) {
        noActiveGraceChecksRef.current.set(orgId, 0);
        openOrgStream(orgId, latestState.streamIntent);
      } else if (!activity?.activeBatches.length) {
        const graceChecks = (noActiveGraceChecksRef.current.get(orgId) || 0) + 1;
        noActiveGraceChecksRef.current.set(orgId, graceChecks);

        if (latestState.streamIntent !== "off" && graceChecks <= STREAM_NO_ACTIVE_GRACE_CHECKS) {
          setStreamState(orgId, {
            streamStatus: "connecting",
            connected: false,
            error: "Verifying scan status and reconnecting...",
          });
          scheduleReconnect(orgId);
          return;
        }

        stopOrgStreaming(orgId, { clearIntent: true, error: null });
      }
    }, delay);

    streamConnectionsRef.current.set(orgId, {
      source: existing.source,
      reconnectAttempt: nextAttempt,
      reconnectTimer: timer,
      rotationTimer: existing.rotationTimer,
    });
  }, [refreshOrgActivity, stopOrgStreaming]);

  const rotateOrgStream = useCallback(async (orgId: string) => {
    const subscription = subscriptionsRef.current.get(orgId);
    if (!subscription) return;

    const existing = streamConnectionsRef.current.get(orgId);
    if (!existing?.source) return;

    const previous = orgStatesRef.current[orgId] || defaultOrgState;
    setOrgState(orgId, {
      ...previous,
      connected: false,
      streamStatus: "connecting",
      error: "Refreshing live connection...",
    });

    closeOrgStream(orgId);
    const activity = await refreshOrgActivity(orgId);
    const latestState = orgStatesRef.current[orgId] || defaultOrgState;

    if (
      subscriptionsRef.current.has(orgId) &&
      latestState.streamIntent !== "off" &&
      activity?.activeBatches.length
    ) {
      noActiveGraceChecksRef.current.set(orgId, 0);
      openOrgStream(orgId, latestState.streamIntent);
      return;
    }

    scheduleReconnect(orgId);
  }, [closeOrgStream, refreshOrgActivity, scheduleReconnect, setOrgState]);

  const openOrgStream = useCallback((orgId: string, intent?: StreamIntent) => {
    if (typeof window === "undefined") return;

    const subscription = subscriptionsRef.current.get(orgId);
    if (!subscription) return;

    const latestState = orgStatesRef.current[orgId] || defaultOrgState;
    const effectiveIntent = intent ?? latestState.streamIntent;
    if (effectiveIntent === "off") return;

    const existing = streamConnectionsRef.current.get(orgId);
    if (existing?.source) return;

    setStreamState(orgId, {
      streamIntent: effectiveIntent,
      streamStatus: "connecting",
      connected: false,
      error: null,
    });

    const source = new EventSource(`/api/orgs/scans/stream?orgId=${encodeURIComponent(orgId)}`);

    const handleSnapshot = (activity: OrgScanActivityPayload) => {
      applyActivityState(orgId, activity, { connected: true, error: null });
      if (!activity.activeBatches.length) {
        stopOrgStreaming(orgId, { clearIntent: true, error: null });
      }
    };

    source.onopen = () => {
      const previous = orgStatesRef.current[orgId] || defaultOrgState;
      setOrgState(orgId, {
        ...previous,
        loading: previous.data ? false : previous.loading,
        error: null,
        connected: true,
        streamStatus: "connected",
      });

      const currentConnection = streamConnectionsRef.current.get(orgId);
      if (currentConnection?.rotationTimer) {
        window.clearTimeout(currentConnection.rotationTimer);
      }

      const rotationTimer = window.setTimeout(() => {
        void rotateOrgStream(orgId);
      }, STREAM_ROTATE_AFTER_MS);

      const latestConnection = streamConnectionsRef.current.get(orgId);
      streamConnectionsRef.current.set(orgId, {
        source,
        reconnectAttempt: 0,
        reconnectTimer: latestConnection?.reconnectTimer || null,
        rotationTimer,
      });
    };

    source.addEventListener("snapshot", (event) => {
      try {
        handleSnapshot(JSON.parse(event.data) as OrgScanActivityPayload);
      } catch {}
    });

    source.addEventListener("batch_update", (event) => {
      try {
        const payload = JSON.parse(event.data) as { activity?: OrgScanActivityPayload };
        if (payload.activity) {
          handleSnapshot(payload.activity);
        }
      } catch {}
    });

    source.addEventListener("item_update", (event) => {
      try {
        const payload = JSON.parse(event.data) as { activity?: OrgScanActivityPayload };
        if (payload.activity) {
          handleSnapshot(payload.activity);
        }
      } catch {}
    });

    source.addEventListener("lock_update", (event) => {
      try {
        const payload = JSON.parse(event.data) as { activity?: OrgScanActivityPayload };
        if (payload.activity) {
          handleSnapshot(payload.activity);
        }
      } catch {}
    });

    source.addEventListener("stream_error", (event) => {
      try {
        const payload = JSON.parse(event.data) as { message?: string };
        setStreamState(orgId, {
          error: payload.message || "Scan activity stream failed.",
          connected: false,
          streamStatus: "error",
        });
      } catch {}
    });

    source.addEventListener("service_unavailable", (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          message?: string;
          timestamp?: number;
          remainingSeconds?: number;
          shutdownAt?: number;
        };
        const message = payload.message || "Scanning endpoint appears unavailable.";
        const remainingSeconds = typeof payload.remainingSeconds === "number"
          ? Math.max(0, Math.ceil(payload.remainingSeconds))
          : null;
        const countdownMessage = remainingSeconds !== null
          ? `${message} Auto-stopping in ${remainingSeconds}s.`
          : message;

        toast.error(countdownMessage, {
          id: `scan-service-unavailable-${orgId}`,
          duration: 8000,
          position: "bottom-right",
          icon: <AlertTriangle className="h-4 w-4 text-white" />,
          style: {
            background: "#dc2626",
            border: "1px solid #b91c1c",
            color: "#ffffff",
          },
        });

        const previous = orgStatesRef.current[orgId] || defaultOrgState;
        setOrgState(orgId, {
          ...previous,
          error: message,
          serviceUnavailableRemainingSeconds: remainingSeconds,
          streamStatus: previous.connected ? "connected" : previous.streamStatus,
        });
      } catch {}
    });

    source.addEventListener("service_shutdown", (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          message?: string;
          activity?: OrgScanActivityPayload;
        };
        const shutdownMessage = payload.message || "Scanning endpoint stayed unavailable. Active scans were stopped.";

        if (payload.activity) {
          applyActivityState(orgId, payload.activity, { connected: false, error: null });
        }

        stopOrgStreaming(orgId, { clearIntent: true, error: shutdownMessage });
        const previous = orgStatesRef.current[orgId] || defaultOrgState;
        setOrgState(orgId, {
          ...previous,
          serviceUnavailableRemainingSeconds: null,
        });
      } catch {}
    });

    source.addEventListener("service_recovered", () => {
      const previous = orgStatesRef.current[orgId] || defaultOrgState;
      setOrgState(orgId, {
        ...previous,
        serviceUnavailableRemainingSeconds: null,
      });
    });

    source.addEventListener("heartbeat", () => {
      const previous = orgStatesRef.current[orgId] || defaultOrgState;
      if (!previous.connected) {
        setOrgState(orgId, {
          ...previous,
          connected: true,
          error: null,
          serviceUnavailableRemainingSeconds: previous.serviceUnavailableRemainingSeconds,
          streamStatus: "connected",
        });
      }
    });

    source.onerror = () => {
      const previous = orgStatesRef.current[orgId] || defaultOrgState;
      if (previous.streamIntent === "off") {
        stopOrgStreaming(orgId, { clearIntent: true, error: null });
        return;
      }

      setStreamState(orgId, {
        connected: false,
        error: previous.error || "Reconnecting to scan activity stream…",
        streamStatus: "error",
      });

      closeOrgStream(orgId);
      scheduleReconnect(orgId);
    };

    streamConnectionsRef.current.set(orgId, {
      source,
      reconnectAttempt: existing?.reconnectAttempt || 0,
      reconnectTimer: existing?.reconnectTimer || null,
      rotationTimer: existing?.rotationTimer || null,
    });
  }, [applyActivityState, closeOrgStream, rotateOrgStream, scheduleReconnect, setOrgState, setStreamState, stopOrgStreaming]);

  const ensureOrgStream = useCallback(async (orgId: string, intent: StreamIntent, activity?: OrgScanActivityPayload | null) => {
    const latestActivity = activity ?? await refreshOrgActivity(orgId);
    const latestState = orgStatesRef.current[orgId] || defaultOrgState;

    if (!latestActivity?.activeBatches.length) {
      stopOrgStreaming(orgId, { clearIntent: true, error: null });
      return;
    }

    const existingConnection = streamConnectionsRef.current.get(orgId);
    if (existingConnection?.source) {
      setStreamState(orgId, {
        streamIntent: intent,
        streamStatus: latestState.connected ? "connected" : "connecting",
        connected: latestState.connected,
        error: null,
      });
      return;
    }

    setOrgState(orgId, {
      ...latestState,
      connected: false,
      error: null,
      streamIntent: intent,
      streamStatus: "connecting",
    });

    openOrgStream(orgId, intent);
  }, [openOrgStream, refreshOrgActivity, setOrgState, setStreamState, stopOrgStreaming]);

  // Keep ref current so applyActivityState can call ensureOrgStream without circular dep
  ensureOrgStreamRef.current = ensureOrgStream;

  const checkForActiveScans = useCallback(async (
    orgId: string,
    options?: { showIdleToast?: boolean; startStreamOnActive?: boolean }
  ) => {
    const toastId = `scan-check-${orgId}`;
    setCheckingConnection(orgId, true);
    try {
      toast.loading("Checking for running scans...", { id: toastId });

      const activity = await refreshOrgActivity(orgId);
      if (!activity) {
        toast.error("Could not check running scans.", { id: toastId });
        return null;
      }

      if (activity.activeBatches.length > 0) {
        if (options?.startStreamOnActive) {
          await ensureOrgStream(orgId, "manual", activity);
        }

        toast.success("Live scan found.", {
          id: toastId,
          action: {
            label: "View",
            onClick: () => setMonitorOrgId(orgId),
          },
        });
        return activity;
      }

      stopOrgStreaming(orgId, { clearIntent: true, error: null });
      if (options?.showIdleToast) {
        toast.success("No active scans.", { id: toastId });
      } else {
        toast.dismiss(toastId);
      }

      return activity;
    } finally {
      setCheckingConnection(orgId, false);
    }
  }, [ensureOrgStream, refreshOrgActivity, setCheckingConnection, stopOrgStreaming]);

  const registerOrg = useCallback((options: RegisteredOrgOptions) => {
    const existing = subscriptionsRef.current.get(options.orgId);
    subscriptionsRef.current.set(options.orgId, {
      count: (existing?.count || 0) + 1,
      orgSlug: options.orgSlug || existing?.orgSlug,
    });

    if (!orgStatesRef.current[options.orgId]) {
      setOrgState(options.orgId, {
        ...defaultOrgState,
        orgSlug: options.orgSlug,
        lastSyncAt: readStoredLastSync(options.orgId),
      });
    }

    if (!existing) {
      setCheckingConnection(options.orgId, true);
      void refreshOrgActivity(options.orgId)
        .then((activity) => {
          const latestState = orgStatesRef.current[options.orgId] || defaultOrgState;
          if (activity?.activeBatches.length) {
            const nextIntent = latestState.streamIntent === "off" ? "batch-driven" : latestState.streamIntent;
            void ensureOrgStream(options.orgId, nextIntent, activity);
          } else if (latestState.streamIntent !== "off" && !activity?.activeBatches.length) {
            stopOrgStreaming(options.orgId, { clearIntent: true, error: null });
          }
        })
        .finally(() => {
          setCheckingConnection(options.orgId, false);
        });

      // Start workflow status poller to surface subdomain discovery toasts
      const pollWorkflowStatus = async () => {
        if (!subscriptionsRef.current.has(options.orgId)) return;
        try {
          const res = await fetch(`/api/orgs/workflow-status?orgId=${encodeURIComponent(options.orgId)}`, { cache: "no-store" });
          if (!res.ok) return;
          const json = await res.json() as { workflows?: Array<{ id: string; workflowType: string; currentStep: string; status: string }> };
          const workflows = json.workflows || [];
          for (const wf of workflows) {
            // Use a stable key tied to the subdomain_discovery step, not wf.currentStep
            // (currentStep may have already advanced by the time we first poll)
            const subdomainRunningKey = `${wf.id}:subdomain_discovery:running`;
            const doneKey = `${wf.id}:subdomain_discovery:done`;

            if (wf.currentStep === "subdomain_discovery" && (wf.status === "running" || wf.status === "pending")) {
              if (!workflowSeenRef.current.has(subdomainRunningKey)) {
                workflowSeenRef.current.add(subdomainRunningKey);
                toast.info("Discovering subdomains automatically…", {
                  id: `wf-subdomain-${wf.id}`,
                  duration: 30000,
                  position: "bottom-right",
                });
              }
            }

            // Only fire the "done" toast if we actually observed subdomain_discovery
            // running in THIS session — prevents firing on every page load for old workflows.
            if (
              wf.currentStep !== "subdomain_discovery" &&
              wf.workflowType === "onboarding" &&
              workflowSeenRef.current.has(subdomainRunningKey) &&
              !workflowSeenRef.current.has(doneKey)
            ) {
              workflowSeenRef.current.add(doneKey);
              toast.dismiss(`wf-subdomain-${wf.id}`);
              toast.success("Subdomain discovery complete. Port scan starting…", {
                id: `wf-subdomain-done-${wf.id}`,
                duration: 6000,
                position: "bottom-right",
              });
              // Refresh asset activity so new subdomains appear
              void refreshOrgActivity(options.orgId);
            }
          }
        } catch {
          // silent — non-critical poller
        }
      };

      void pollWorkflowStatus();
      const pollerId = window.setInterval(() => { void pollWorkflowStatus(); }, WORKFLOW_POLL_INTERVAL_MS);
      workflowPollersRef.current.set(options.orgId, pollerId);
    }
  }, [ensureOrgStream, refreshOrgActivity, setCheckingConnection, setOrgState, stopOrgStreaming]);

  const unregisterOrg = useCallback((orgId: string) => {
    const existing = subscriptionsRef.current.get(orgId);
    if (!existing) return;

    if (existing.count <= 1) {
      subscriptionsRef.current.delete(orgId);
      closeOrgStream(orgId);
      setStreamState(orgId, {
        connected: false,
        error: null,
        streamStatus: "idle",
      });
      // Stop workflow poller
      const pollerId = workflowPollersRef.current.get(orgId);
      if (pollerId) {
        window.clearInterval(pollerId);
        workflowPollersRef.current.delete(orgId);
      }
      return;
    }

    subscriptionsRef.current.set(orgId, {
      ...existing,
      count: existing.count - 1,
    });
  }, [closeOrgStream, setStreamState]);

  useEffect(() => {
    setHydrated(true);

    return () => {
      for (const [orgId] of streamConnectionsRef.current.entries()) {
        closeOrgStream(orgId);
      }
    };
  }, [closeOrgStream]);

  const startActivityMonitor = useCallback(async (orgId: string) => {
    await checkForActiveScans(orgId, {
      showIdleToast: true,
      startStreamOnActive: true,
    });
  }, [checkForActiveScans]);

  const createBatch = useCallback(async (input: CreateBatchInput) => {
    const existingPromise = createBatchPromisesRef.current.get(input.orgId);
    if (existingPromise) {
      return existingPromise;
    }

    const previous = orgStatesRef.current[input.orgId] || defaultOrgState;
    setOrgState(input.orgId, {
      ...previous,
      error: null,
      pendingBatchType: input.type,
      pendingBatchEngine: input.engine || "openssl",
    });

    const createToastId = `scan-create-${input.orgId}`;

    const createPromise = (async () => {
      try {
      toast.loading(`Starting ${batchActionLabel(input.type, input.engine || "openssl")}...`, { id: createToastId });

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), SCAN_REQUEST_TIMEOUT_MS);

      const response = await fetch("/api/orgs/scans/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(input),
      });
      window.clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(
          data?.error || "Failed to create scan batch.",
          {
            id: createToastId,
            action: data?.lockBatchId || data?.lockType ? {
              label: "View",
              onClick: () => setMonitorOrgId(input.orgId),
            } : undefined,
          }
        );
        return { ok: false, error: data?.error || "Failed to create scan batch." };
      }

      if (data?.activity) {
        applyActivityState(input.orgId, data.activity, {
          connected: (orgStatesRef.current[input.orgId] || defaultOrgState).connected,
          error: null,
        });
      } else {
        await refreshOrgActivity(input.orgId);
      }

      await ensureOrgStream(input.orgId, "batch-driven", data?.activity ?? null);

      const wasQueued = data?.queued === true;
      const actionLabel = batchActionLabel(input.type, input.engine || "openssl").replace(/^./, (c) => c.toUpperCase());
      if (wasQueued) {
        toast.info(`${actionLabel} queued.`, {
          id: createToastId,
          description: `Position #${(data?.queuePosition ?? 1)} in queue — will start after the current scan completes.`,
          action: {
            label: "View Queue",
            onClick: () => setMonitorOrgId(input.orgId),
          },
        });
      } else if ((input.engine || "openssl") === "portDiscovery") {
        toast.info(`${actionLabel} started.`, {
          id: createToastId,
          position: "bottom-right",
          action: {
            label: "View",
            onClick: () => setMonitorOrgId(input.orgId),
          },
        });
      } else {
        toast.success(`${actionLabel} started.`, {
          id: createToastId,
          action: {
            label: "View",
            onClick: () => setMonitorOrgId(input.orgId),
          },
        });
      }

      return { ok: true };
    } catch (error: any) {
      const message = error?.name === "AbortError"
        ? "Scan request timed out. The scanning service may be unavailable."
        : (error?.message || "Failed to create scan batch.");
      toast.error(message, { id: createToastId });
      return { ok: false, error: message };
      } finally {
        const latest = orgStatesRef.current[input.orgId] || defaultOrgState;
        setOrgState(input.orgId, {
          ...latest,
          pendingBatchType: null,
          pendingBatchEngine: null,
        });
        createBatchPromisesRef.current.delete(input.orgId);
      }
    })();

    createBatchPromisesRef.current.set(input.orgId, createPromise);
    return createPromise;
  }, [applyActivityState, ensureOrgStream, refreshOrgActivity, setOrgState]);

  const cancelBatch = useCallback(async (input: CancelBatchInput) => {
    const previous = orgStatesRef.current[input.orgId] || defaultOrgState;
    setOrgState(input.orgId, {
      ...previous,
      error: null,
      serviceUnavailableRemainingSeconds: null,
      pendingBatchEngine: previous.pendingBatchEngine,
      cancellingBatchId: input.batchId,
    });

    try {
      const response = await fetch(`/api/orgs/scans/batches/${encodeURIComponent(input.batchId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: input.orgId }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, error: data?.error || "Failed to stop scan batch." };
      }

      if (data?.activity) {
        applyActivityState(input.orgId, data.activity, {
          connected: false,
          error: null,
        });
      } else {
        await refreshOrgActivity(input.orgId);
      }

      stopOrgStreaming(input.orgId, { clearIntent: true, error: null });
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || "Failed to stop scan batch." };
    } finally {
      const latest = orgStatesRef.current[input.orgId] || defaultOrgState;
      setOrgState(input.orgId, {
        ...latest,
        pendingBatchEngine: latest.pendingBatchEngine,
        cancellingBatchId: null,
      });
    }
  }, [applyActivityState, refreshOrgActivity, setOrgState, stopOrgStreaming]);

  const cancelQueuedRun = useCallback(async (input: CancelQueuedRunInput) => {
    try {
      const response = await fetch(`/api/orgs/scans/schedule-runs/${encodeURIComponent(input.runId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: input.orgId }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, error: data?.error || "Failed to cancel queued scheduled scan." };
      }

      if (data?.activity) {
        applyActivityState(input.orgId, data.activity, {
          connected: false,
          error: null,
        });
      } else {
        await refreshOrgActivity(input.orgId);
      }

      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || "Failed to cancel queued scheduled scan." };
    }
  }, [applyActivityState, refreshOrgActivity]);

  const openMonitor = useCallback((orgId: string) => {
    setMonitorOrgId(orgId);
  }, []);

  const closeMonitor = useCallback(() => {
    setMonitorOrgId(null);
  }, []);

  const getOrgState = useCallback((orgId: string) => orgStates[orgId] || defaultOrgState, [orgStates]);

  const contextValue = useMemo<ScanActivityContextValue>(() => ({
    hydrated,
    monitorOrgId,
    openMonitor,
    closeMonitor,
    registerOrg,
    unregisterOrg,
    getOrgState,
    refreshOrgActivity,
    checkForActiveScans,
    startActivityMonitor,
    createBatch,
    cancelBatch,
    cancelQueuedRun,
  }), [
    cancelBatch,
    cancelQueuedRun,
    checkForActiveScans,
    closeMonitor,
    createBatch,
    getOrgState,
    hydrated,
    monitorOrgId,
    openMonitor,
    refreshOrgActivity,
    registerOrg,
    startActivityMonitor,
    unregisterOrg,
  ]);

  return (
    <ScanActivityContext.Provider value={contextValue}>
      {children}
    </ScanActivityContext.Provider>
  );
}

export function useScanActivity(
  orgId: string,
  options?: { orgSlug?: string }
) {
  const context = useContext(ScanActivityContext);
  if (!context) {
    throw new Error("useScanActivity must be used within ScanActivityProvider");
  }

  const {
    registerOrg,
    unregisterOrg,
    getOrgState,
    createBatch,
    cancelBatch,
    cancelQueuedRun,
    refreshOrgActivity,
    checkForActiveScans,
    startActivityMonitor,
    hydrated,
    monitorOrgId,
    openMonitor,
    closeMonitor,
  } = context;

  useEffect(() => {
    registerOrg({
      orgId,
      orgSlug: options?.orgSlug,
    });

    return () => unregisterOrg(orgId);
  }, [options?.orgSlug, orgId, registerOrg, unregisterOrg]);

  const state = getOrgState(orgId);

  return {
    hydrated,
    connected: state.connected,
    lastSyncAt: state.lastSyncAt,
    serviceUnavailableRemainingSeconds: state.serviceUnavailableRemainingSeconds ?? null,
    checkingConnection: state.checkingConnection,
    isMonitorOpen: monitorOrgId === orgId,
    openMonitor: () => openMonitor(orgId),
    closeMonitor,
    refreshActivity: () => refreshOrgActivity(orgId),
    checkForActiveScans: (options?: { showIdleToast?: boolean; startStreamOnActive?: boolean }) =>
      checkForActiveScans(orgId, options),
    startActivityMonitor: () => startActivityMonitor(orgId),
    createBatch: (input: Omit<CreateBatchInput, "orgId">) => createBatch({ ...input, orgId }),
    cancelBatch: (batchId: string) => cancelBatch({ orgId, batchId }),
    cancelQueuedRun: (runId: string) => cancelQueuedRun({ orgId, runId }),
    activity: state.data,
    loading: state.loading,
    error: state.error,
    streamStatus: state.streamStatus,
    pendingBatchType: state.pendingBatchType,
    pendingBatchEngine: state.pendingBatchEngine,
    cancellingBatchId: state.cancellingBatchId,
  };
}
