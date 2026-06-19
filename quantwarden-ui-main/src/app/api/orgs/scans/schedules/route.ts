import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { createScanSchedule, listScanSchedulesForOrganization } from "@/lib/scan-schedule-server";
import { notifyScanWorkerOfSchedule } from "@/lib/scan-worker-wake";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schedules = await listScanSchedulesForOrganization(orgId);
    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("List scan schedules error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const orgId = typeof body?.orgId === "string" ? body.orgId : null;

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess?.canScan) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedAssetIds = Array.isArray(body?.assetIds) ? body.assetIds : [];
    console.log("[Schedule API] Creating schedule:", {
      engine: body?.engine,
      type: body?.type,
      mode: body?.mode,
      assetIdsCount: resolvedAssetIds.length,
      assetIds: resolvedAssetIds.slice(0, 5),
      rawAssetIdsType: typeof body?.assetIds,
      rawAssetIdsIsArray: Array.isArray(body?.assetIds),
    });

    const schedule = await createScanSchedule({
      organizationId: orgId,
      createdByUserId: session.user.id,
      engine: body?.engine,
      type: body?.type,
      mode: body?.mode,
      runAt: body?.runAt,
      frequency: body?.frequency,
      interval: body?.interval,
      assetIds: Array.isArray(body?.assetIds) ? body.assetIds : [],
      configSnapshot: body?.configSnapshot,
      timezone: body?.timezone,
    });

    // Fire-and-forget: wake the worker so it processes the schedule immediately
    void notifyScanWorkerOfSchedule({
      orgId,
      scheduleId: schedule.id,
      nextRunAt: schedule.nextRunAt,
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error: any) {
    console.error("Create scan schedule error:", error);
    return NextResponse.json({ error: error?.message || "Internal Error" }, { status: 400 });
  }
}
