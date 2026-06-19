import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getOrgScanAccess } from "@/lib/org-scan-permissions";
import { runOpenSSLScanItem } from "@/lib/openssl-scan-runner";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assetId, orgId, scanId, batchId } = await req.json();

    if (!assetId || !orgId || !scanId || !batchId) {
      return NextResponse.json({ error: "Missing config fields" }, { status: 400 });
    }

    const scanAccess = await getOrgScanAccess(orgId, session.user.id);
    if (!scanAccess?.canScan) {
      return NextResponse.json({ error: "Forbidden: You do not have scan permission." }, { status: 403 });
    }

    const result = await runOpenSSLScanItem({ orgId, assetId, scanId, batchId });
    const statusCode = result.status === "failed" && result.error ? 500 : 200;

    return NextResponse.json(
      {
        success: result.status === "completed",
        scanId: result.scanId,
        status: result.status,
        data: result.data,
        error: result.error,
      },
      { status: statusCode }
    );
  } catch {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
