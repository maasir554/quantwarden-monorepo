import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { listScanScheduleRunsForOrganization } from "@/lib/scan-schedule-server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const limit = Number.parseInt(searchParams.get("limit") || "25", 10);

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const runs = await listScanScheduleRunsForOrganization(
      orgId,
      Number.isFinite(limit) ? Math.min(100, Math.max(1, limit)) : 25
    );

    return NextResponse.json({ runs });
  } catch (error) {
    console.error("List scan schedule runs error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
