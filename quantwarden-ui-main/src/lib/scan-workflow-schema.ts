import { prisma } from "@/lib/prisma";

/**
 * Ensures the org_scan_workflow table exists.
 * Called at worker startup alongside ensureScanSchedulingTables.
 */
export async function ensureWorkflowTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "org_scan_workflow" (
      id TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "workflowType" TEXT NOT NULL,
      "triggerAssetId" TEXT NOT NULL,
      "currentStep" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      "assetIds" TEXT NOT NULL DEFAULT '[]',
      "portDiscoveryConfigSnapshot" TEXT,
      "activeBatchId" TEXT,
      "triggeredByUserId" TEXT,
      "createdAt" TIMESTAMP NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    )
  `);

  // Index for efficient org-level workflow queries
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "org_scan_workflow_org_status_idx"
    ON "org_scan_workflow" ("organizationId", status)
  `);

  // Ensure asset_scan_batch has a `source` column for automated/manual/scheduled tagging.
  // Safe to run on existing databases — IF NOT EXISTS is idempotent.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "asset_scan_batch"
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  `);
}

export type WorkflowType = "onboarding" | "asset_added";
export type WorkflowStep = "subdomain_discovery" | "port_discovery" | "openssl" | "done";
export type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface WorkflowRow {
  id: string;
  organizationId: string;
  workflowType: WorkflowType;
  triggerAssetId: string;
  currentStep: WorkflowStep;
  status: WorkflowStatus;
  assetIds: string; // JSON array of asset IDs
  portDiscoveryConfigSnapshot: string | null;
  activeBatchId: string | null;
  triggeredByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
