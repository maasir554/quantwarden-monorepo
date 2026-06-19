interface WakeWorkerPayload {
  orgId: string;
  batchId: string;
  reason?: string;
}

interface WakeWorkerResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
}

const DEFAULT_WAKE_TIMEOUT_MS = 1500;

function parseWakeTimeoutMs() {
  const raw = process.env.SCAN_WORKER_WAKE_TIMEOUT_MS;
  if (!raw) return DEFAULT_WAKE_TIMEOUT_MS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_WAKE_TIMEOUT_MS;

  return Math.min(10000, Math.max(250, parsed));
}

export async function notifyScanWorkerOfManualBatch(payload: WakeWorkerPayload): Promise<WakeWorkerResult> {
  const wakeUrl = process.env.SCAN_WORKER_WAKE_URL?.trim();
  const wakeSecret = process.env.SCAN_WORKER_WAKE_SECRET?.trim();

  if (!wakeUrl || !wakeSecret) {
    return {
      ok: false,
      skipped: true,
      error: "Worker wake endpoint is not configured.",
    };
  }

  const timeoutMs = parseWakeTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(wakeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${wakeSecret}`,
      },
      body: JSON.stringify({
        reason: payload.reason || "manual_batch_created",
        orgId: payload.orgId,
        batchId: payload.batchId,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        error: errorText || `Worker wake request failed with status ${response.status}.`,
      };
    }

    return { ok: true, status: response.status };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.name === "AbortError"
        ? `Worker wake request timed out after ${timeoutMs}ms.`
        : error?.message || "Worker wake request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyScanWorkerOfSchedule(payload: {
  orgId: string;
  scheduleId: string;
  nextRunAt?: string | Date | null;
}): Promise<WakeWorkerResult> {
  const wakeUrl = process.env.SCAN_WORKER_WAKE_URL?.trim();
  const wakeSecret = process.env.SCAN_WORKER_WAKE_SECRET?.trim();

  if (!wakeUrl || !wakeSecret) {
    return {
      ok: false,
      skipped: true,
      error: "Worker wake endpoint is not configured.",
    };
  }

  const timeoutMs = parseWakeTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const runAtIso = payload.nextRunAt
      ? typeof payload.nextRunAt === "string"
        ? payload.nextRunAt
        : payload.nextRunAt.toISOString()
      : null;

    const response = await fetch(wakeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${wakeSecret}`,
      },
      body: JSON.stringify({
        reason: "schedule_created",
        orgId: payload.orgId,
        nextRunAt: runAtIso,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        error: errorText || `Worker wake request failed with status ${response.status}.`,
      };
    }

    return { ok: true, status: response.status };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.name === "AbortError"
        ? `Worker wake request timed out after ${timeoutMs}ms.`
        : error?.message || "Worker wake request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
