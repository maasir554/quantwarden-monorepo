import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { claimNextPendingScan } from "@/lib/scan-batch-server";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await req.json();
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const claim = await claimNextPendingScan(orgId);

    if (!claim) {
      return NextResponse.json({ claimed: false });
    }

    return NextResponse.json({
      claimed: true,
      scan: claim,
    });
  } catch (error) {
    console.error("Claim scan error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
