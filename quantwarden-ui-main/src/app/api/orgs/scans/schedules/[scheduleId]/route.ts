import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { deleteScanSchedule, updateScanSchedule } from "@/lib/scan-schedule-server";

interface RouteContext {
  params: Promise<{
    scheduleId: string;
  }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scheduleId } = await context.params;
    const body = await req.json().catch(() => null);
    const orgId = typeof body?.orgId === "string" ? body.orgId : null;

    if (!scheduleId || !orgId) {
      return NextResponse.json({ error: "Missing scheduleId or orgId" }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess?.canScan) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schedule = await updateScanSchedule({
      scheduleId,
      organizationId: orgId,
      enabled: body?.enabled,
      engine: body?.engine,
      type: body?.type,
      mode: body?.mode,
      runAt: body?.runAt,
      frequency: body?.frequency,
      interval: body?.interval,
      assetIds: Array.isArray(body?.assetIds) ? body.assetIds : undefined,
      configSnapshot: body?.configSnapshot,
      timezone: body?.timezone,
    });

    return NextResponse.json({ schedule });
  } catch (error: any) {
    console.error("Update scan schedule error:", error);
    const status = error?.message === "Schedule not found." ? 404 : 400;
    return NextResponse.json({ error: error?.message || "Internal Error" }, { status });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { scheduleId } = await context.params;
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!scheduleId || !orgId) {
      return NextResponse.json({ error: "Missing scheduleId or orgId" }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess?.canScan) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await deleteScanSchedule(scheduleId, orgId);
    if (!deleted) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete scan schedule error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
