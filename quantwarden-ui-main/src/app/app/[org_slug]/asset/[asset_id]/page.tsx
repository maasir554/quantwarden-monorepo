import { redirect } from "next/navigation";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { prisma } from "@/lib/prisma";
import AssetIntelligenceClient from "./_components/AssetIntelligenceClient";
import { getSafeServerSession } from "@/lib/auth-session";

export default async function AssetIntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ org_slug: string; asset_id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Await params for Next.js async params API
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const session = await getSafeServerSession();
  if (!session?.user) redirect("/login");

  const orgRows = await prisma.$queryRawUnsafe<{ id: string, name: string, slug: string }[]>(
     `SELECT id, name, slug FROM "organization" WHERE "slug" = $1 LIMIT 1`, resolvedParams.org_slug
  );
  if (orgRows.length === 0) redirect("/app");
  const org = orgRows[0];

  const access = await getOrgMemberAccess(org.id, session.user.id);
  if (!access) redirect("/app");

  // Check if it's a UUID/CUID structure (broad match for alphanumeric IDs vs domains)
  // CUIDs and UUIDs lack dots, domains have dots.
  const isId = !resolvedParams.asset_id.includes(".");
  
  let assetRows;
  if (isId) {
    assetRows = await prisma.$queryRawUnsafe<any[]>(
       `SELECT * FROM "asset" WHERE "id" = $1 AND "organizationId" = $2 LIMIT 1`,
       resolvedParams.asset_id, org.id
    );
  } else {
    const decodedValue = decodeURIComponent(resolvedParams.asset_id);
    assetRows = await prisma.$queryRawUnsafe<any[]>(
       `SELECT * FROM "asset" WHERE "value" = $1 AND "organizationId" = $2 LIMIT 1`,
       decodedValue, org.id
    );
  }
  if (assetRows.length === 0) redirect(`/app/${org.slug}`);
  const asset = assetRows[0];

  const scanRows = await prisma.$queryRawUnsafe<any[]>(
     `SELECT * FROM "asset_scan" WHERE "assetId" = $1 AND type = 'openssl' ORDER BY "createdAt" DESC`,
     asset.id
  );

  return (
      <div className="relative isolate min-h-screen">
         <div
            aria-hidden
            className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]"
         />

         <div className="relative z-10 min-h-screen overflow-y-auto">
            <AssetIntelligenceClient 
               org={org} 
               asset={asset} 
               initialScans={scanRows}
               initialSelectedPortQuery={typeof resolvedSearchParams.port === "string" ? resolvedSearchParams.port : ""}
               canScan={access.canScan}
               canManageAssets={access.canManageAssets}
            />
         </div>
    </div>
  );
}
