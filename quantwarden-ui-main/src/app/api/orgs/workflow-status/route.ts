/**
 * GET /api/orgs/workflow-status?orgId=xxx
 * Returns active/recent workflows for an org so the UI can show subdomain discovery progress.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { ensureWorkflowTable } from "@/lib/scan-workflow-schema";

export interface WorkflowStatusEntry {
  id: string;
  workflowType: "onboarding" | "asset_added";
  currentStep: "subdomain_discovery" | "port_discovery" | "openssl" | "done";
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  activeBatchId: string | null;
  triggerAssetId: string;
  createdAt: string;
  updatedAt: string;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const access = await getOrgMemberAccess(orgId, session.user.id);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await ensureWorkflowTable();

    const rows = await prisma.$queryRawUnsafe<WorkflowStatusEntry[]>(
      `SELECT id, "workflowType", "currentStep", status, "activeBatchId",
              "triggerAssetId", "createdAt", "updatedAt"
       FROM "org_scan_workflow"
       WHERE "organizationId" = $1
         AND "createdAt" > NOW() - INTERVAL '24 hours'
       ORDER BY "createdAt" DESC
       LIMIT 20`,
      orgId
    );

    return NextResponse.json({ workflows: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
