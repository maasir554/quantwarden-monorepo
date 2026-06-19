/**
 * TEMPORARY DEBUG ENDPOINT — remove after troubleshooting.
 * GET /api/orgs/debug-workflow?orgId=xxx
 * Returns workflow rows, recent batches, and whether the source column exists.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  try {
    // Check if source column exists
    const columnCheck = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'asset_scan_batch' AND column_name = 'source'
      ) as exists
    `);

    // Check if workflow table exists
    const workflowTableCheck = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'org_scan_workflow'
      ) as exists
    `);

    const hasWorkflowTable = workflowTableCheck[0]?.exists;

    // Get workflows
    let workflows: unknown[] = [];
    if (hasWorkflowTable) {
      workflows = await prisma.$queryRawUnsafe(
        `SELECT id, "workflowType", "currentStep", status, "activeBatchId", "triggeredByUserId",
                "createdAt", "updatedAt", "assetIds"
         FROM "org_scan_workflow"
         WHERE "organizationId" = $1
         ORDER BY "createdAt" DESC
         LIMIT 10`,
        orgId
      );
    }

    // Get recent batches
    const batches = await prisma.$queryRawUnsafe(
      `SELECT id, engine, type, status, "createdAt", "startedAt", "completedAt", "totalAssets"
       FROM "asset_scan_batch"
       WHERE "organizationId" = $1
       ORDER BY "createdAt" DESC
       LIMIT 10`,
      orgId
    );

    // Get root domain assets
    const rootAssets = await prisma.$queryRawUnsafe(
      `SELECT id, value, type, "isRoot", "createdAt"
       FROM "asset"
       WHERE "organizationId" = $1 AND "isRoot" = true
       ORDER BY "createdAt" DESC
       LIMIT 20`,
      orgId
    );

    return NextResponse.json({
      sourceColumnExists: columnCheck[0]?.exists,
      workflowTableExists: hasWorkflowTable,
      workflows,
      recentBatches: batches,
      rootAssets,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
