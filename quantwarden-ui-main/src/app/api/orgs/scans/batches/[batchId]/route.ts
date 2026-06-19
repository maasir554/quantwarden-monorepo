import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { cancelScanBatch, getOrgScanActivity } from "@/lib/scan-batch-server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { batchId } = await params;
    const { orgId } = await req.json().catch(() => ({ orgId: null }));

    if (!batchId || !orgId) {
      return NextResponse.json({ error: "Missing batchId or orgId." }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess?.canScan) {
      return NextResponse.json({ error: "Forbidden: You do not have scan permission." }, { status: 403 });
    }

    const cancelled = await cancelScanBatch(orgId, batchId);
    if (!cancelled) {
      return NextResponse.json({ error: "Active scan batch not found." }, { status: 404 });
    }

    const activity = await getOrgScanActivity(orgId, scanAccess.canScan);
    return NextResponse.json({
      success: true,
      batchId,
      activity,
    });
  } catch (error) {
    console.error("Cancel scan batch error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
