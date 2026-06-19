import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AssetExplorerClient from "./_components/AssetExplorerClient";
import { getSafeServerSession } from "@/lib/auth-session";

function getFirstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function getCsvQueryValues(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] || "" : value || "";
  return rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getPositiveIntegerQueryValue(value: string | string[] | undefined, fallback: number) {
  const rawValue = Array.isArray(value) ? value[0] || "" : value || "";
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function AssetExplorePage({ 
  params,
  searchParams
}: { 
  params: Promise<{ org_slug: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await params;
  const resolvedQuery = await searchParams;
  
  const session = await getSafeServerSession();
  if (!session?.user) redirect("/login");

  const orgRows = await prisma.$queryRawUnsafe<{ id: string, name: string, slug: string }[]>(
     `SELECT id, name, slug FROM "organization" WHERE "slug" = $1 LIMIT 1`, resolvedParams.org_slug
  );
  if (orgRows.length === 0) redirect("/app");
  const org = orgRows[0];

  const memberRows = await prisma.$queryRawUnsafe<{ role: string }[]>(
    `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
    org.id,
    session.user.id
  );
  if (memberRows.length === 0) redirect("/app");
  return (
    <div className="relative isolate min-h-screen">
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]"
      />

      <div className="relative z-10 min-h-screen overflow-y-auto">
        <AssetExplorerClient 
          org={org} 
          initialDnsState={getFirstQueryValue(resolvedQuery.dnsState)}
          initialCertState={getFirstQueryValue(resolvedQuery.certState)}
          initialTlsProfile={getFirstQueryValue(resolvedQuery.tlsProfile)}
          initialTlsMatch={getFirstQueryValue(resolvedQuery.tlsMatch)}
          initialSelfSigned={getFirstQueryValue(resolvedQuery.selfSigned)}
          initialSignatureAlgorithm={getFirstQueryValue(resolvedQuery.signatureAlgorithm)}
          initialPort={getFirstQueryValue(resolvedQuery.port)}
          initialCertExpiry={getFirstQueryValue(resolvedQuery.certExpiry)}
          initialTimeoutOnly={getFirstQueryValue(resolvedQuery.timeoutOnly)}
          initialNoTls={getFirstQueryValue(resolvedQuery.noTls)}
          initialCipher={getFirstQueryValue(resolvedQuery.cipher)}
          initialKeySize={getFirstQueryValue(resolvedQuery.keySize)}
          initialTls={getFirstQueryValue(resolvedQuery.tls)}
          initialPqcSupported={getFirstQueryValue(resolvedQuery.pqcSupported)}
          initialPqcNegotiated={getFirstQueryValue(resolvedQuery.pqcNegotiated)}
          initialPqcTier={getFirstQueryValue(resolvedQuery.pqcTier)}
          initialScanStatus={getFirstQueryValue(resolvedQuery.scanStatus)}
          initialBucket={getFirstQueryValue(resolvedQuery.bucket)}
          initialKexAlgorithms={getCsvQueryValues(resolvedQuery.kexAlgos)}
          initialKexGroups={getCsvQueryValues(resolvedQuery.kexGroups)}
          initialPage={getPositiveIntegerQueryValue(resolvedQuery.page, 1)}
          initialPageSize={getPositiveIntegerQueryValue(resolvedQuery.pageSize, 25)}
        />
      </div>
    </div>
  );
}
