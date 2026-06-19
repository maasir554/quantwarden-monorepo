import { NextRequest, NextResponse } from "next/server";

/**
 * This route has been superseded by the worker-managed subdomain discovery batch system.
 * Subdomain scans are now created via POST /api/orgs/scans/batches with engine: "subdomainDiscovery"
 * and executed by the background worker using the SubdomainDiscoveryRunner.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      error: "This endpoint has been deprecated. Use POST /api/orgs/scans/batches with engine: \"subdomainDiscovery\" instead.",
      code: "ENDPOINT_DEPRECATED",
    },
    { status: 410 }
  );
}
