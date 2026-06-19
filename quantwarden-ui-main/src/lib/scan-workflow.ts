/**
 * scan-workflow.ts
 *
 * Core automated scan workflow engine.
 *
 * Two workflow chains are supported:
 *
 *   onboarding:   subdomain_discovery → port_discovery → openssl → done
 *   asset_added:  port_discovery → openssl → done
 *
 * Workflows are stored in the org_scan_workflow table and advanced by the
 * background worker after each scan batch completes. Zero client dependency.
 */

import { prisma } from "@/lib/prisma";
import {
  createDefaultPortDiscoveryConfig,
  normalizePortDiscoveryConfig,
  type PortDiscoveryConfig,
} from "@/lib/port-discovery";
import { createScanBatch, isCreateScanBatchFailure } from "@/lib/scan-batch-create";
import { notifyScanWorkerOfManualBatch } from "@/lib/scan-worker-wake";
import { ensureWorkflowTable, type WorkflowRow, type WorkflowStep } from "@/lib/scan-workflow-schema";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getNextStep(workflowType: string, currentStep: WorkflowStep): WorkflowStep {
  const onboardingChain: WorkflowStep[] = [
    "subdomain_discovery",
    "port_discovery",
    "openssl",
    "done",
  ];
  const assetAddedChain: WorkflowStep[] = ["port_discovery", "openssl", "done"];

  const chain = workflowType === "onboarding" ? onboardingChain : assetAddedChain;
  const idx = chain.indexOf(currentStep);
  return chain[idx + 1] ?? "done";
}

function parseAssetIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Load the org's saved port discovery config from DB, or return the default.
 */
async function loadPortDiscoveryConfig(orgId: string): Promise<PortDiscoveryConfig> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ entries: string; probeBatchSize: number; probeTimeoutMs: number }>
    >(
      `SELECT entries, "probeBatchSize", "probeTimeoutMs"
       FROM "organization_port_discovery_config"
       WHERE "organizationId" = $1
       LIMIT 1`,
      orgId
    );

    if (rows[0]) {
      let entries: unknown = rows[0].entries;
      if (typeof entries === "string") {
        try {
          entries = JSON.parse(entries);
        } catch {
          entries = undefined;
        }
      }
      return normalizePortDiscoveryConfig({
        entries,
        probeBatchSize: rows[0].probeBatchSize,
        probeTimeoutMs: rows[0].probeTimeoutMs,
      });
    }
  } catch {
    /* fall through */
  }
  return createDefaultPortDiscoveryConfig();
}

// ---------------------------------------------------------------------------
// Subdomain discovery (runs inline in worker, not via SSE)
// ---------------------------------------------------------------------------

function getSubdomainAssetType(value: string): "domain" | "ip" | "unknown" {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$/.test(value)) {
    return "ip";
  }
  if (/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(value)) {
    return "domain";
  }
  return "unknown";
}

async function runSubdomainDiscovery(
  orgId: string,
  rootAssetId: string,
  subfinderUrl?: string
): Promise<string[]> {
  // Fetch root asset value
  const assetRows = await prisma.$queryRawUnsafe<{ value: string }[]>(
    `SELECT value FROM "asset" WHERE id = $1 AND "organizationId" = $2 LIMIT 1`,
    rootAssetId,
    orgId
  );

  if (assetRows.length === 0) return [];

  const domain = assetRows[0].value;
  const effectiveSubfinderUrl = subfinderUrl || process.env.SUBFINDER_API_URL || "http://127.0.0.1:8085";

  let subdomains: string[] = [];
  try {
    const response = await fetch(`${effectiveSubfinderUrl}/subdomains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });

    if (!response.ok) {
      throw new Error(`Subfinder API returned ${response.status}`);
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      subdomains = data;
    } else if (data && typeof data === "object") {
      if (Array.isArray(data.subdomains)) subdomains = data.subdomains;
      else if (Array.isArray(data.data)) subdomains = data.data;
      else if (Array.isArray(data.result)) subdomains = data.result;
    }
  } catch (err: any) {
    console.warn("[workflow] Subfinder call failed for", domain, "url:", effectiveSubfinderUrl, err?.message);
    return [];
  }

  const unique = [...new Set(subdomains)].filter(
    (sub) => typeof sub === "string" && sub.trim().length > 0 && sub !== domain
  );

  // Insert discovered subdomains, skipping duplicates
  const insertedIds: string[] = [];
  for (const sub of unique) {
    try {
      const leafId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "asset" (id, value, type, "isRoot", "organizationId", verified, "openPorts", "createdAt", "parentId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT DO NOTHING`,
        leafId,
        sub,
        getSubdomainAssetType(sub),
        false,
        orgId,
        false,
        JSON.stringify([{ number: 443, protocol: "tcp" }]),
        new Date(),
        rootAssetId
      );
      insertedIds.push(leafId);
    } catch {
      /* skip duplicate */
    }
  }

  return insertedIds;
}

// ---------------------------------------------------------------------------
// Workflow enqueue
// ---------------------------------------------------------------------------

/**
 * Enqueue an onboarding workflow for a root domain asset.
 * Chain: subdomain_discovery → port_discovery → openssl
 */
export async function enqueueOnboardingWorkflow(
  orgId: string,
  rootAssetId: string,
  userId: string
): Promise<void> {
  await ensureWorkflowTable();

  const id = crypto.randomUUID();
  const now = new Date();

  // Capture port discovery config snapshot at trigger time
  const config = await loadPortDiscoveryConfig(orgId);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "org_scan_workflow"
       (id, "organizationId", "workflowType", "triggerAssetId", "currentStep", status,
        "assetIds", "portDiscoveryConfigSnapshot", "triggeredByUserId", "createdAt", "updatedAt")
     VALUES ($1, $2, 'onboarding', $3, 'subdomain_discovery', 'pending', $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING`,
    id,
    orgId,
    rootAssetId,
    JSON.stringify([rootAssetId]),
    JSON.stringify(config),
    userId,
    now,
    now
  );

  // Wake the worker immediately
  await notifyScanWorkerOfManualBatch({ orgId, batchId: id, reason: "workflow_enqueued" });
}

/**
 * Enqueue an asset-added workflow for a single new asset.
 * Chain: port_discovery → openssl
 */
export async function enqueueAssetAddedWorkflow(
  orgId: string,
  assetId: string,
  userId: string
): Promise<void> {
  await ensureWorkflowTable();

  const id = crypto.randomUUID();
  const now = new Date();

  const config = await loadPortDiscoveryConfig(orgId);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "org_scan_workflow"
       (id, "organizationId", "workflowType", "triggerAssetId", "currentStep", status,
        "assetIds", "portDiscoveryConfigSnapshot", "triggeredByUserId", "createdAt", "updatedAt")
     VALUES ($1, $2, 'asset_added', $3, 'port_discovery', 'pending', $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING`,
    id,
    orgId,
    assetId,
    JSON.stringify([assetId]),
    JSON.stringify(config),
    userId,
    now,
    now
  );

  await notifyScanWorkerOfManualBatch({ orgId, batchId: id, reason: "workflow_enqueued" });
}

// ---------------------------------------------------------------------------
// Workflow advancement (called by worker after each job completes)
// ---------------------------------------------------------------------------

async function advanceSingleWorkflow(workflow: WorkflowRow, subfinderUrl?: string): Promise<void> {
  const orgId = workflow.organizationId;
  const now = new Date();

  // ── Step: subdomain_discovery ─────────────────────────────────────────────
  if (workflow.currentStep === "subdomain_discovery" && workflow.status === "pending") {
    // Mark as running
    await prisma.$executeRawUnsafe(
      `UPDATE "org_scan_workflow" SET status = 'running', "updatedAt" = $1 WHERE id = $2`,
      now,
      workflow.id
    );

    let discoveredIds: string[] = [];
    try {
      discoveredIds = await runSubdomainDiscovery(orgId, workflow.triggerAssetId, subfinderUrl);
    } catch (err: any) {
      console.warn("[workflow] Subdomain discovery failed:", err?.message);
    }

    // Collect all org domain/ip asset IDs (root + discovered) for the port_discovery step
    const allAssetRows = await prisma.$queryRawUnsafe<{ id: string; type: string }[]>(
      `SELECT id, type FROM "asset"
       WHERE "organizationId" = $1
         AND type IN ('domain', 'ip')
       ORDER BY "createdAt" ASC`,
      orgId
    );
    const allAssetIds = allAssetRows.map((r) => r.id);

    // Advance to port_discovery
    await prisma.$executeRawUnsafe(
      `UPDATE "org_scan_workflow"
       SET "currentStep" = 'port_discovery',
           status = 'pending',
           "assetIds" = $1,
           "updatedAt" = $2
       WHERE id = $3`,
      JSON.stringify(allAssetIds.length > 0 ? allAssetIds : [workflow.triggerAssetId]),
      now,
      workflow.id
    );

    // Immediately attempt to advance to the next step in the same tick
    const updated = await prisma.$queryRawUnsafe<WorkflowRow[]>(
      `SELECT * FROM "org_scan_workflow" WHERE id = $1 LIMIT 1`,
      workflow.id
    );
    if (updated[0]) {
      await advanceSingleWorkflow(updated[0], subfinderUrl);
    }
    return;
  }

  // ── Step: port_discovery ──────────────────────────────────────────────────
  if (workflow.currentStep === "port_discovery" && workflow.status === "pending") {
    const assetIds = parseAssetIds(workflow.assetIds);
    if (assetIds.length === 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "org_scan_workflow" SET status = 'skipped', "updatedAt" = $1 WHERE id = $2`,
        now,
        workflow.id
      );
      return;
    }

    const config = workflow.portDiscoveryConfigSnapshot
      ? normalizePortDiscoveryConfig(
          (() => {
            try { return JSON.parse(workflow.portDiscoveryConfigSnapshot!); } catch { return null; }
          })()
        )
      : createDefaultPortDiscoveryConfig();

    const batchType = assetIds.length === 1 ? "single" : "full";
    const userId = workflow.triggeredByUserId || "system";

    const result = await createScanBatch({
      orgId,
      initiatedByUserId: userId,
      type: batchType,
      engine: "portDiscovery",
      assetIds,
      configSnapshot: config,
      source: "automated",
    });

    if (isCreateScanBatchFailure(result)) {
      if (result.status === 409) {
        // Scan lock — leave as pending, retry on next tick
        console.log("[workflow] portDiscovery locked for org", orgId, "— will retry.");
        return;
      }
      console.warn("[workflow] portDiscovery batch creation failed:", result.error);
      await prisma.$executeRawUnsafe(
        `UPDATE "org_scan_workflow" SET status = 'failed', "updatedAt" = $1 WHERE id = $2`,
        now,
        workflow.id
      );
      return;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "org_scan_workflow"
       SET status = 'running', "activeBatchId" = $1, "updatedAt" = $2
       WHERE id = $3`,
      result.batchId,
      now,
      workflow.id
    );

    await notifyScanWorkerOfManualBatch({ orgId, batchId: result.batchId });
    return;
  }

  // ── Step: openssl ─────────────────────────────────────────────────────────
  if (workflow.currentStep === "openssl" && workflow.status === "pending") {
    // Only domain assets for openssl
    const allIds = parseAssetIds(workflow.assetIds);
    const domainRows = allIds.length > 0
      ? await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "asset"
           WHERE id = ANY($1::text[])
             AND type = 'domain'`,
          allIds
        )
      : [];

    const domainIds = domainRows.map((r) => r.id);

    if (domainIds.length === 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "org_scan_workflow" SET status = 'completed', "updatedAt" = $1 WHERE id = $2`,
        now,
        workflow.id
      );
      return;
    }

    const batchType = domainIds.length === 1 ? "single" : "full";
    const userId = workflow.triggeredByUserId || "system";

    const result = await createScanBatch({
      orgId,
      initiatedByUserId: userId,
      type: batchType,
      engine: "openssl",
      assetIds: domainIds,
      source: "automated",
    });

    if (isCreateScanBatchFailure(result)) {
      if (result.status === 409) {
        console.log("[workflow] openssl locked for org", orgId, "— will retry.");
        return;
      }
      console.warn("[workflow] openssl batch creation failed:", result.error);
      await prisma.$executeRawUnsafe(
        `UPDATE "org_scan_workflow" SET status = 'failed', "updatedAt" = $1 WHERE id = $2`,
        now,
        workflow.id
      );
      return;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "org_scan_workflow"
       SET status = 'running', "activeBatchId" = $1, "updatedAt" = $2
       WHERE id = $3`,
      result.batchId,
      now,
      workflow.id
    );

    await notifyScanWorkerOfManualBatch({ orgId, batchId: result.batchId });
    return;
  }

  // ── Status: running — check if active batch has completed ─────────────────
  if (workflow.status === "running" && workflow.activeBatchId) {
    const batchRows = await prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM "asset_scan_batch" WHERE id = $1 LIMIT 1`,
      workflow.activeBatchId
    );

    const batchStatus = batchRows[0]?.status;
    const batchDone =
      batchStatus === "completed" ||
      batchStatus === "failed" ||
      batchStatus === "cancelled";

    if (!batchDone) return; // still running, come back later

    // Batch finished — advance to next step
    const nextStep = getNextStep(workflow.workflowType, workflow.currentStep);

    if (nextStep === "done") {
      await prisma.$executeRawUnsafe(
        `UPDATE "org_scan_workflow"
         SET "currentStep" = 'done', status = 'completed', "activeBatchId" = NULL, "updatedAt" = $1
         WHERE id = $2`,
        now,
        workflow.id
      );
      return;
    }

    // For openssl step we pass the same assetIds (filter happens in that branch)
    await prisma.$executeRawUnsafe(
      `UPDATE "org_scan_workflow"
       SET "currentStep" = $1, status = 'pending', "activeBatchId" = NULL, "updatedAt" = $2
       WHERE id = $3`,
      nextStep,
      now,
      workflow.id
    );

    // Re-load and advance immediately so the next batch queues in the same tick
    const updated = await prisma.$queryRawUnsafe<WorkflowRow[]>(
      `SELECT * FROM "org_scan_workflow" WHERE id = $1 LIMIT 1`,
      workflow.id
    );
    if (updated[0]) {
      await advanceSingleWorkflow(updated[0], subfinderUrl);
    }
  }
}

/**
 * Advance all active workflows for an org.
 * Called by worker: (a) after every scan job completes, (b) on every executor tick.
 */
export async function advanceOrgWorkflows(orgId: string, subfinderUrl?: string): Promise<void> {
  await ensureWorkflowTable();

  const workflows = await prisma.$queryRawUnsafe<WorkflowRow[]>(
    `SELECT * FROM "org_scan_workflow"
     WHERE "organizationId" = $1
       AND status IN ('pending', 'running')
     ORDER BY "createdAt" ASC`,
    orgId
  );

  for (const workflow of workflows) {
    try {
      await advanceSingleWorkflow(workflow, subfinderUrl);
    } catch (err: any) {
      console.error("[workflow] Error advancing workflow", workflow.id, err?.message);
    }
  }
}

/**
 * Return list of org IDs that have pending or running workflows.
 * Used by worker executor tick to self-wake.
 */
export async function listOrgsWithPendingWorkflows(limit = 50): Promise<string[]> {
  try {
    await ensureWorkflowTable();
    const rows = await prisma.$queryRawUnsafe<{ organizationId: string }[]>(
      `SELECT DISTINCT "organizationId"
       FROM "org_scan_workflow"
       WHERE status IN ('pending', 'running')
       ORDER BY "organizationId" ASC
       LIMIT $1`,
      limit
    );
    return rows.map((r) => r.organizationId);
  } catch {
    return [];
  }
}
