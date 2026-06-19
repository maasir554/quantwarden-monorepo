import { prisma } from "@/lib/prisma";
import { inferAssetBucket, normalizeAssetBucket } from "@/lib/asset-buckets";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { redirect } from "next/navigation";
import OnboardingFlow from "./OnboardingFlow";
import OrgDashboard from "./OrgDashboard";
import PendingRequestView from "./PendingRequestView";
import type { DashboardSection } from "./dashboard-sections";
import { getSafeServerSession } from "@/lib/auth-session";

export async function renderOrganizationPage(orgSlug: string, activeSection: DashboardSection) {
  const session = await getSafeServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  const orgBasicRows = await prisma.$queryRawUnsafe<{
    id: string;
    name: string;
    slug: string;
    metadata: string | null;
    isPublic: boolean;
    discoverable: boolean;
    logo: string | null;
  }[]>(
    `SELECT id, name, slug, metadata, "isPublic", discoverable, logo
     FROM "organization" WHERE slug = $1 LIMIT 1`,
    orgSlug.toLowerCase()
  );

  if (orgBasicRows.length === 0) {
    redirect("/app");
  }

  const orgBasic = orgBasicRows[0];

  const memberRows = await prisma.$queryRawUnsafe<{
    id: string;
    role: string;
  }[]>(
    `SELECT id, role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
    orgBasic.id,
    session.user.id
  );

  if (memberRows.length === 0) {
    const requestRows = await prisma.$queryRawUnsafe<{
      id: string;
      status: string;
      createdAt: Date;
    }[]>(
      `SELECT id, status, "createdAt" FROM "join_request"
       WHERE "organizationId" = $1 AND "userId" = $2
       ORDER BY "createdAt" DESC LIMIT 1`,
      orgBasic.id,
      session.user.id
    );

    if (requestRows.length > 0) {
      return (
        <PendingRequestView
          org={{ id: orgBasic.id, name: orgBasic.name, slug: orgBasic.slug, logo: orgBasic.logo }}
          request={{ id: requestRows[0].id, status: requestRows[0].status, createdAt: requestRows[0].createdAt }}
        />
      );
    }

    redirect("/app");
  }

  const memberRole = memberRows[0].role;
  const access = await getOrgMemberAccess(orgBasic.id, session.user.id);

  if (!access) {
    redirect("/app");
  }

  const org: any = { ...orgBasic, domains: [] as string[], assets: [] as any[], roles: [] as any[] };

  let assetsRows: any[] = [];
  try {
    assetsRows = await prisma.$queryRawUnsafe<{ id: string, value: string, type: string, isRoot: boolean, parentId: string | null, verified: boolean, resolvedIp: string | null, openPorts: string | null, bucket: string | null, createdAt: Date, scanStatus: string, lastScanDate: Date | null, portDiscoveryStatus: string, lastPortDiscoveryDate: Date | null }[]>(
      `SELECT id, value, type, "isRoot", "parentId", verified, "resolvedIp", "openPorts", bucket, "createdAt", "scanStatus", "lastScanDate", "portDiscoveryStatus", "lastPortDiscoveryDate" FROM "asset" WHERE "organizationId" = $1`,
      org.id
    );
  } catch (err) {
    try {
      assetsRows = await prisma.$queryRawUnsafe<{ id: string, value: string, type: string, isRoot: boolean, parentId: string | null, verified: boolean, resolvedIp: string | null, openPorts: string | null, createdAt: Date, scanStatus: string, lastScanDate: Date | null, portDiscoveryStatus: string, lastPortDiscoveryDate: Date | null }[]>(
        `SELECT id, value, type, "isRoot", "parentId", verified, "resolvedIp", "openPorts", "createdAt", "scanStatus", "lastScanDate", "portDiscoveryStatus", "lastPortDiscoveryDate" FROM "asset" WHERE "organizationId" = $1`,
        org.id
      );
    } catch {
      assetsRows = await prisma.$queryRawUnsafe<{ id: string, value: string, type: string, isRoot: boolean, parentId: string | null, verified: boolean, createdAt: Date }[]>(
        `SELECT id, value, type, "isRoot", "parentId", verified, "createdAt" FROM "asset" WHERE "organizationId" = $1`,
        org.id
      );
    }
  }

  org.assets = assetsRows.map((asset) => ({
    ...asset,
    bucket: normalizeAssetBucket(asset.bucket || inferAssetBucket(asset.value)),
  }));
  org.domains = assetsRows.filter((a) => a.isRoot && a.type === "domain").map((a) => a.value);

  const rolesRows = await prisma.$queryRawUnsafe<{ id: string, name: string, permissions: string }[]>(
    `SELECT id, name, permissions FROM "role" WHERE "organizationId" = $1`,
    org.id
  );

  org.roles = rolesRows.map((r) => {
    let perms = { team: false, scan: false, asset: false };
    try {
      if (r.permissions) perms = { ...perms, ...JSON.parse(r.permissions) };
    } catch (e) {}
    return { id: r.id, name: r.name, permissions: perms };
  });

  const canManageTeam = access.canManageTeam;
  const canManageRoles = access.canManageRoles;
  const canManageAssets = access.canManageAssets;
  const canScan = access.canScan;

  let setupComplete = false;
  if (org.metadata) {
    try {
      const meta = JSON.parse(org.metadata);
      setupComplete = !!meta.setupComplete;
    } catch (e) {}
  }

  if (!setupComplete && (memberRole === "owner" || memberRole === "admin")) {
    return <OnboardingFlow org={org} />;
  }

  if (activeSection === "roles" && !canManageRoles) {
    redirect(`/app/${orgSlug}/team`);
  }

  return (
    <OrgDashboard
      org={org}
      currentUserRole={memberRole}
      currentUserId={session.user.id}
      activeSection={activeSection}
      canManageTeam={canManageTeam}
      canManageRoles={canManageRoles}
      canManageAssets={canManageAssets}
      canScan={canScan}
    />
  );
}
