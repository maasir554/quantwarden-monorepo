import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { createReportEmailSchedule, listReportEmailSchedules } from "@/lib/report-email-schedule-server";
import { notifyScanWorkerOfSchedule } from "@/lib/scan-worker-wake";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const orgId = new URL(req.url).searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    if (!(await getOrgScanAccess(orgId, session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ schedules: await listReportEmailSchedules(orgId) });
  } catch (error) {
    console.error("List report email schedules error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => null);
    const orgId = typeof body?.orgId === "string" ? body.orgId : "";
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    const access = await getOrgScanAccess(orgId, session.user.id);
    if (!access?.canScan) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const schedule = await createReportEmailSchedule({
      organizationId: orgId,
      createdByUserId: session.user.id,
      title: body?.title,
      heading: body?.heading,
      frequency: body?.frequency,
      interval: body?.interval,
      runAt: body?.runAt,
      recipients: body?.recipients,
      sections: body?.sections,
      enabled: body?.enabled,
      timezone: body?.timezone,
    });
    if (schedule?.enabled && schedule.nextRunAt) {
      void notifyScanWorkerOfSchedule({ orgId, scheduleId: schedule.id, nextRunAt: schedule.nextRunAt });
    }
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Error" }, { status: 400 });
  }
}
