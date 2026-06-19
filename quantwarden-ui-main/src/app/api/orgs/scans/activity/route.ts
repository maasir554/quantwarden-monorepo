import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { getOrgScanActivity } from "@/lib/scan-batch-server";

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

    const activity = await getOrgScanActivity(orgId, scanAccess.canScan);
    return NextResponse.json(activity);
  } catch (error) {
    console.error("Scan activity fetch error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
