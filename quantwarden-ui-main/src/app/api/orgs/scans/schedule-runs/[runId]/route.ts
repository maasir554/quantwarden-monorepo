import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { getOrgScanActivity } from "@/lib/scan-batch-server";
import { cancelPendingScheduleRun } from "@/lib/scan-schedule-server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { runId } = await params;
    const { orgId } = await req.json().catch(() => ({ orgId: null }));

    if (!runId || !orgId) {
      return NextResponse.json({ error: "Missing runId or orgId." }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess?.canScan) {
      return NextResponse.json({ error: "Forbidden: You do not have scan permission." }, { status: 403 });
    }

    const cancelled = await cancelPendingScheduleRun(runId, orgId);
    if (!cancelled) {
      return NextResponse.json({ error: "Queued scheduled scan not found." }, { status: 404 });
    }

    const activity = await getOrgScanActivity(orgId, scanAccess.canScan);
    return NextResponse.json({
      success: true,
      runId,
      activity,
    });
  } catch (error) {
    console.error("Cancel schedule run error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
