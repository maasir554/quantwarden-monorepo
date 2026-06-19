import http, { IncomingMessage, ServerResponse } from "node:http";
import { prisma } from "@/lib/prisma";
import { claimNextPendingScan, listOrganizationsWithActiveScanWork } from "@/lib/scan-batch-server";
import { runOpenSSLScanItem } from "@/lib/openssl-scan-runner";
import { runPortDiscoveryItem } from "@/lib/port-discovery-runner";
import { runSubdomainDiscoveryItem } from "@/lib/subdomain-discovery-runner";
import { ensureScanSchedulingTables, runSchedulerMaintenanceCycle } from "@/lib/scan-schedule-server";
import { advanceOrgWorkflows, listOrgsWithPendingWorkflows } from "@/lib/scan-workflow";
import { ensureWorkflowTable } from "@/lib/scan-workflow-schema";
import type { ClaimedScanItem } from "@/lib/scan-batch-server";
import { loadWorkerConfig } from "./config";
import { logger } from "./logger";

type LoopName = "executor" | "scheduler";

const config = loadWorkerConfig();
const runningJobs = new Map<string, Promise<void>>();
const loopWakeWaiters: Record<LoopName, Set<() => void>> = {
  executor: new Set(),
  scheduler: new Set(),
};
const prioritizedOrgIds = new Set<string>();

let shuttingDown = false;
let activeUntilMs = 0;
let executorTickPromise: Promise<void> | null = null;
let schedulerTickPromise: Promise<void> | null = null;
let controlServer: http.Server | null = null;
let healthServer: http.Server | null = null;

function refreshActiveWindow(orgId?: string) {
  activeUntilMs = Math.max(activeUntilMs, Date.now() + config.activeGraceMs);
  if (orgId) {
    prioritizedOrgIds.add(orgId);
  }
  notifyLoop("executor");
  notifyLoop("scheduler");
}

function markWorkerActive(reason: string, orgId?: string) {
  const wasActive = isWorkerActive();
  refreshActiveWindow(orgId);
  if (!wasActive || orgId) {
    logger.info("Worker switched to active mode.", { reason, orgId: orgId || null });
  }
}

function isWorkerActive() {
  return runningJobs.size > 0 || Date.now() < activeUntilMs;
}

function getLoopTickMs(loop: LoopName) {
  if (loop === "executor") {
    return isWorkerActive() ? config.activeExecutorTickMs : config.idleExecutorTickMs;
  }

  return isWorkerActive() ? config.activeSchedulerTickMs : config.idleSchedulerTickMs;
}

function waitForNextTick(loop: LoopName, ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    const waiter = () => done();

    function done() {
      clearTimeout(timer);
      loopWakeWaiters[loop].delete(waiter);
      resolve();
    }

    loopWakeWaiters[loop].add(waiter);
  });
}

function notifyLoop(loop: LoopName) {
  for (const wake of [...loopWakeWaiters[loop]]) {
    wake();
  }
}

function json(res: ServerResponse, statusCode: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload).toString(),
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk.toString();
      if (raw.length > 8192) {
        reject(new Error("Request body too large."));
      }
    });

    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}

function isAuthorizedWakeRequest(req: IncomingMessage) {
  const expectedSecret = config.wakeSecret.trim();
  if (!expectedSecret) {
    return false;
  }

  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${expectedSecret}`;
}

async function handleControlRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "POST" && req.url === "/internal/wake") {
    if (!config.wakeSecret.trim()) {
      json(res, 503, { error: "Wake endpoint is disabled." });
      return;
    }

    if (!isAuthorizedWakeRequest(req)) {
      json(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const body = (await readJsonBody(req)) as {
        reason?: string;
        orgId?: string;
        batchId?: string;
        nextRunAt?: string | null;
      };

      markWorkerActive(body.reason || "manual_wake", body.orgId);
      void runExecutorTickSafe();

      const now = Date.now();
      const runAtTime = body.nextRunAt ? new Date(body.nextRunAt).getTime() : now;

      if (!Number.isNaN(runAtTime) && runAtTime > now) {
        // Limit max timeout to ~24.8 days (Node.js limit), but our idle polling handles huge gaps anyway
        const delayMs = Math.min(runAtTime - now, 2147483647);
        setTimeout(() => {
          void runSchedulerTickSafe();
        }, delayMs);
      } else {
        void runSchedulerTickSafe();
      }

      json(res, 200, {
        ok: true,
        mode: "active",
        orgId: body.orgId || null,
        batchId: body.batchId || null,
      });
      return;
    } catch (error: any) {
      json(res, 400, { error: error?.message || "Invalid wake request." });
      return;
    }
  }

  json(res, 404, { error: "Not found" });
}

async function handleHealthRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "GET" && (req.url === "/" || req.url === "/healthz")) {
    json(res, 200, {
      ok: true,
      status: "alive",
      mode: isWorkerActive() ? "active" : "idle",
      runningJobs: runningJobs.size,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  json(res, 404, { error: "Not found" });
}

async function startControlServer() {
  await new Promise<void>((resolve, reject) => {
    controlServer = http.createServer((req, res) => {
      void handleControlRequest(req, res);
    });

    controlServer.once("error", reject);
    controlServer.listen(config.controlPort, "0.0.0.0", () => {
      resolve();
    });
  });

  if (!config.wakeSecret.trim()) {
    logger.warn("Worker wake endpoint started without a configured secret. Manual wake requests are disabled.", {
      controlPort: config.controlPort,
    });
    return;
  }

  logger.info("Worker control server started.", {
    controlPort: config.controlPort,
  });
}

async function startHealthServer() {
  await new Promise<void>((resolve, reject) => {
    healthServer = http.createServer((req, res) => {
      void handleHealthRequest(req, res);
    });

    healthServer.once("error", reject);
    healthServer.listen(config.healthPort, "0.0.0.0", () => {
      resolve();
    });
  });

  logger.info("Worker health server started.", {
    healthPort: config.healthPort,
  });
}

async function launchScanJob(orgId: string, claimed: ClaimedScanItem) {
  if (runningJobs.has(claimed.scanId)) {
    return;
  }

  markWorkerActive("scan_claimed", orgId);

  const job = (async () => {
    try {
      logger.info("Executing scan item.", {
        orgId,
        scanId: claimed.scanId,
        batchId: claimed.batchId,
        engine: claimed.engine,
        assetId: claimed.assetId,
      });

      if (claimed.engine === "portDiscovery") {
        await runPortDiscoveryItem({
          orgId,
          assetId: claimed.assetId,
          scanId: claimed.scanId,
          batchId: claimed.batchId,
          configSnapshot: claimed.configSnapshot,
        });
      } else if (claimed.engine === "subdomainDiscovery") {
        await runSubdomainDiscoveryItem({
          orgId,
          assetId: claimed.assetId,
          scanId: claimed.scanId,
          batchId: claimed.batchId,
        });
      } else {
        await runOpenSSLScanItem({
          orgId,
          assetId: claimed.assetId,
          scanId: claimed.scanId,
          batchId: claimed.batchId,
        });
      }
    } catch (error: any) {
      logger.error("Scan item execution failed.", {
        orgId,
        scanId: claimed.scanId,
        batchId: claimed.batchId,
        engine: claimed.engine,
        message: error?.message || String(error),
      });

      // Safety net: mark scan failed + refresh batch so it doesn't stay stuck
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "asset_scan"
           SET status = 'failed', "resultData" = $1, "completedAt" = $2
           WHERE id = $3 AND status IN ('pending', 'running')`,
          JSON.stringify({ error: error?.message || "Unexpected worker error" }),
          new Date(),
          claimed.scanId
        );
        const { refreshScanBatch } = await import("@/lib/scan-batch-server");
        await refreshScanBatch(claimed.batchId);
      } catch (cleanupErr: any) {
        logger.warn("Failed to mark scan as failed after error.", {
          scanId: claimed.scanId,
          message: cleanupErr?.message || String(cleanupErr),
        });
      }
    } finally {
      runningJobs.delete(claimed.scanId);
      refreshActiveWindow(orgId);

      // Advance any automated scan workflows for this org now that a batch step finished
      void advanceOrgWorkflows(orgId, config.subfinderUrl).catch((err: any) => {
        logger.warn("Workflow advancement failed after scan job.", {
          orgId,
          scanId: claimed.scanId,
          message: err?.message || String(err),
        });
      });

      void runSchedulerTickSafe();
      void runExecutorTickSafe();
      if (runningJobs.size > 0) {
        markWorkerActive("scan_job_still_running");
      }
    }
  })();

  runningJobs.set(claimed.scanId, job);
}

function orderedOrgQueue(orgIds: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const orgId of prioritizedOrgIds) {
    if (!seen.has(orgId)) {
      ordered.push(orgId);
      seen.add(orgId);
    }
  }

  for (const orgId of orgIds) {
    if (!seen.has(orgId)) {
      ordered.push(orgId);
      seen.add(orgId);
    }
  }

  prioritizedOrgIds.clear();
  return ordered;
}

async function recoverStaleScanItems() {
  // Find scan items stuck in 'running' for over 5 minutes that this worker isn't actively processing.
  // This handles: worker crashes, old code bugs, restarts, etc.
  const STALE_THRESHOLD_MINUTES = 5;
  try {
    const staleRows = await prisma.$queryRawUnsafe<{ id: string; batchId: string }[]>(
      `SELECT s.id, s."batchId" as "batchId"
       FROM "asset_scan" s
       INNER JOIN "asset_scan_batch" b ON b.id = s."batchId"
       WHERE s.status = 'running'
         AND b.status IN ('queued', 'running')
         AND s."createdAt" < NOW() - INTERVAL '${STALE_THRESHOLD_MINUTES} minutes'
       LIMIT 50`
    );

    const staleScanIds = staleRows.filter((row) => !runningJobs.has(row.id));
    if (staleScanIds.length === 0) return;

    logger.warn("Recovering stale running scans.", { count: staleScanIds.length });

    const affectedBatchIds = new Set<string>();
    for (const row of staleScanIds) {
      await prisma.$executeRawUnsafe(
        `UPDATE "asset_scan"
         SET status = 'failed', "resultData" = $1, "completedAt" = $2
         WHERE id = $3 AND status = 'running'`,
        JSON.stringify({ error: "Scan timed out or worker crashed. Marked as failed by recovery." }),
        new Date(),
        row.id
      );
      affectedBatchIds.add(row.batchId);
    }

    const { refreshScanBatch } = await import("@/lib/scan-batch-server");
    for (const batchId of affectedBatchIds) {
      await refreshScanBatch(batchId);
    }

    logger.info("Stale scan recovery complete.", {
      scansRecovered: staleScanIds.length,
      batchesRefreshed: affectedBatchIds.size,
    });
  } catch (err: any) {
    logger.warn("Stale scan recovery failed.", { message: err?.message || String(err) });
  }
}

async function runExecutorTick() {
  // Recover any scans stuck in 'running' from previous crashes / bugs
  await recoverStaleScanItems();

  const orgIds = await listOrganizationsWithActiveScanWork(config.activeOrgQueryLimit);
  const orderedOrgIds = orderedOrgQueue(orgIds);

  if (orderedOrgIds.length > 0 || runningJobs.size > 0) {
    markWorkerActive("active_scan_work_detected");
  }

  for (const orgId of orderedOrgIds) {
    while (!shuttingDown) {
      const claimed = await claimNextPendingScan(orgId);
      if (!claimed) {
        break;
      }

      await launchScanJob(orgId, claimed);
    }
  }

  // Also advance any pending automated workflows (picks up orgs not in active batches yet)
  const workflowOrgIds = await listOrgsWithPendingWorkflows(config.activeOrgQueryLimit);
  for (const orgId of workflowOrgIds) {
    if (shuttingDown) break;
    await advanceOrgWorkflows(orgId, config.subfinderUrl).catch((err: any) => {
      logger.warn("Workflow tick advancement failed.", {
        orgId,
        message: err?.message || String(err),
      });
    });
  }

  if (workflowOrgIds.length > 0) {
    markWorkerActive("active_workflow_detected");
  }
}

async function runExecutorTickSafe() {
  if (executorTickPromise) {
    return executorTickPromise;
  }

  executorTickPromise = (async () => {
    try {
      await runExecutorTick();
    } finally {
      executorTickPromise = null;
    }
  })();

  return executorTickPromise;
}

async function runSchedulerTick() {
  await runSchedulerMaintenanceCycle();
  notifyLoop("executor");
}

async function runSchedulerTickSafe() {
  if (schedulerTickPromise) {
    return schedulerTickPromise;
  }

  schedulerTickPromise = (async () => {
    try {
      await runSchedulerTick();
    } finally {
      schedulerTickPromise = null;
    }
  })();

  return schedulerTickPromise;
}

async function runLoop(loop: LoopName, fn: () => Promise<void>) {
  while (!shuttingDown) {
    try {
      await fn();
    } catch (error: any) {
      logger.error(`${loop} loop failed.`, {
        message: error?.message || String(error),
      });
    }

    if (shuttingDown) {
      break;
    }

    await waitForNextTick(loop, getLoopTickMs(loop));
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  notifyLoop("executor");
  notifyLoop("scheduler");

  logger.warn("Shutdown requested.", {
    signal,
    runningJobs: runningJobs.size,
  });

  if (controlServer) {
    await new Promise<void>((resolve) => {
      controlServer?.close(() => resolve());
    }).catch(() => undefined);
  }
  if (healthServer) {
    await new Promise<void>((resolve) => {
      healthServer?.close(() => resolve());
    }).catch(() => undefined);
  }

  if (runningJobs.size > 0) {
    await Promise.allSettled([...runningJobs.values()]);
  }

  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

async function main() {
  await ensureScanSchedulingTables();
  await ensureWorkflowTable();
  await startControlServer();
  await startHealthServer();

  logger.info("Worker started.", {
    activeExecutorTickMs: config.activeExecutorTickMs,
    activeSchedulerTickMs: config.activeSchedulerTickMs,
    idleExecutorTickMs: config.idleExecutorTickMs,
    idleSchedulerTickMs: config.idleSchedulerTickMs,
    activeGraceMs: config.activeGraceMs,
    activeOrgQueryLimit: config.activeOrgQueryLimit,
    controlPort: config.controlPort,
    healthPort: config.healthPort,
    wakeEndpointEnabled: Boolean(config.wakeSecret.trim()),
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection.", {
      message: reason instanceof Error ? reason.message : String(reason),
    });
  });
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception.", {
      message: error?.message || String(error),
    });
  });

  await Promise.all([
    runLoop("scheduler", async () => {
      await runSchedulerTickSafe();
    }),
    runLoop("executor", async () => {
      await runExecutorTickSafe();
    }),
  ]);
}

void main().catch(async (error: any) => {
  logger.error("Worker boot failed.", {
    message: error?.message || String(error),
  });
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
