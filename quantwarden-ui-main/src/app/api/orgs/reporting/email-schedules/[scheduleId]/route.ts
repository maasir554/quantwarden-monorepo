import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { deleteReportEmailSchedule, updateReportEmailSchedule } from "@/lib/report-email-schedule-server";
import { notifyScanWorkerOfSchedule } from "@/lib/scan-worker-wake";

type Context = { params: Promise<{ scheduleId: string }> };

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => null);
    const orgId = typeof body?.orgId === "string" ? body.orgId : "";
    const { scheduleId } = await context.params;
    if (!orgId || !scheduleId) return NextResponse.json({ error: "Missing scheduleId or orgId" }, { status: 400 });
    const access = await getOrgScanAccess(orgId, session.user.id);
    if (!access?.canScan) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const schedule = await updateReportEmailSchedule({ scheduleId, organizationId: orgId, ...body });
    if (schedule?.enabled && schedule.nextRunAt) {
      void notifyScanWorkerOfSchedule({ orgId, scheduleId, nextRunAt: schedule.nextRunAt });
    }
    return NextResponse.json({ schedule });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Error" }, { status: error?.message === "Email schedule not found." ? 404 : 400 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const orgId = new URL(req.url).searchParams.get("orgId") || "";
    const { scheduleId } = await context.params;
    const access = orgId ? await getOrgScanAccess(orgId, session.user.id) : null;
    if (!access?.canScan) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!(await deleteReportEmailSchedule(scheduleId, orgId))) return NextResponse.json({ error: "Email schedule not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
