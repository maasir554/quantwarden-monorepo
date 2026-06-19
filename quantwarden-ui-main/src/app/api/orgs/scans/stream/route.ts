import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import type { OrgScanActivityPayload, ScanActivityBatch, ScanActivityItem } from "@/lib/scan-activity-types";
import { getOrgScanActivity } from "@/lib/scan-batch-server";

const ACTIVE_TICK_MS = 1500;
const IDLE_TICK_MS = 10000;
const HEARTBEAT_MS = 10000;

export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function activityBatches(activity: OrgScanActivityPayload) {
  const batches = [...activity.activeBatches];
  if (activity.latestCompletedBatch && !batches.some((batch) => batch.id === activity.latestCompletedBatch?.id)) {
    batches.push(activity.latestCompletedBatch);
  }
  return batches;
}

function hasBatchChanged(previous: ScanActivityBatch | undefined, next: ScanActivityBatch) {
  if (!previous) return true;

  return (
    previous.status !== next.status ||
    previous.totalAssets !== next.totalAssets ||
    previous.completedAssets !== next.completedAssets ||
    previous.failedAssets !== next.failedAssets ||
    previous.pendingAssets !== next.pendingAssets ||
    previous.runningAssets !== next.runningAssets ||
    previous.percentComplete !== next.percentComplete ||
    previous.completedAt !== next.completedAt ||
    previous.startedAt !== next.startedAt
  );
}

function hasItemChanged(previous: ScanActivityItem | undefined, next: ScanActivityItem) {
  if (!previous) return true;

  return (
    previous.status !== next.status ||
    previous.portNumber !== next.portNumber ||
    previous.portProtocol !== next.portProtocol ||
    previous.error !== next.error ||
    previous.completedAt !== next.completedAt
  );
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return new NextResponse("Missing orgId", { status: 400 });
  }

  const scanAccess = await getOrgScanAccess(orgId, session.user.id);
  if (!scanAccess) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;

        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const stop = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", stop);

      let previousActivity: OrgScanActivityPayload | null = null;
      let lastHeartbeatAt = 0;

      const emitActivityChanges = (nextActivity: OrgScanActivityPayload) => {
        if (!previousActivity) {
          sendEvent("snapshot", nextActivity);
          previousActivity = nextActivity;
          return;
        }

        if (JSON.stringify(previousActivity.lock) !== JSON.stringify(nextActivity.lock)) {
          sendEvent("lock_update", {
            lock: nextActivity.lock,
            activity: nextActivity,
          });
        }

        const previousBatchMap = new Map(activityBatches(previousActivity).map((batch) => [batch.id, batch]));
        for (const batch of activityBatches(nextActivity)) {
          const previousBatch = previousBatchMap.get(batch.id);
          if (hasBatchChanged(previousBatch, batch)) {
            sendEvent("batch_update", {
              batch,
              activity: nextActivity,
            });
          }

          const previousItemMap = new Map((previousBatch?.items || []).map((item) => [item.id, item]));
          for (const item of batch.items) {
            const previousItem = previousItemMap.get(item.id);
            if (hasItemChanged(previousItem, item)) {
              sendEvent("item_update", {
                batchId: batch.id,
                item,
                activity: nextActivity,
              });
            }
          }
        }

        previousActivity = nextActivity;
      };

      try {
        while (!closed) {
          const nextActivity = await getOrgScanActivity(orgId, scanAccess.canScan);
          emitActivityChanges(nextActivity);

          const heartbeatNow = Date.now();
          if (heartbeatNow - lastHeartbeatAt >= HEARTBEAT_MS) {
            sendEvent("heartbeat", { timestamp: heartbeatNow });
            lastHeartbeatAt = heartbeatNow;
          }

          const delay = nextActivity.activeBatches.length > 0 ? ACTIVE_TICK_MS : IDLE_TICK_MS;
          await sleep(delay);
        }
      } catch (error) {
        console.error("Scan SSE stream error:", error);
        sendEvent("stream_error", { message: "Scan activity stream failed." });
      } finally {
        stop();
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
