import { prisma } from "@/lib/prisma";

export interface OrgMemberAccess {
  memberId: string;
  roleId: string;
  roleName: string;
  isPrivileged: boolean;
  canManageTeam: boolean;
  canScan: boolean;
  canManageAssets: boolean;
  canManageRoles: boolean;
}

interface MemberPermissionRow {
  memberId: string;
  roleId: string;
  roleName: string;
  permissions: string | null;
}

function parsePermissions(raw: string | null) {
  const defaults = {
    team: false,
    scan: false,
    asset: false,
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw);
    return {
      team: Boolean(parsed?.team),
      scan: Boolean(parsed?.scan),
      asset: Boolean(parsed?.asset),
    };
  } catch {
    return defaults;
  }
}

export async function getOrgMemberAccess(orgId: string, userId: string): Promise<OrgMemberAccess | null> {
  const rows = await prisma.$queryRawUnsafe<MemberPermissionRow[]>(
    `SELECT
        m.id as "memberId",
        m.role as "roleId",
        COALESCE(r.name, m.role) as "roleName",
        r.permissions as permissions
      FROM "member" m
      LEFT JOIN "role" r
        ON r."organizationId" = m."organizationId"
       AND (r.id::text = m.role OR LOWER(r.name) = LOWER(m.role))
      WHERE m."organizationId" = $1 AND m."userId" = $2
      LIMIT 1`,
    orgId,
    userId
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  const roleId = row.roleId?.toLowerCase?.() ?? "";
  const roleName = row.roleName?.toLowerCase?.() ?? "";
  const isPrivileged =
    roleId === "owner" ||
    roleId === "admin" ||
    roleId === "administrator" ||
    roleName === "owner" ||
    roleName === "admin" ||
    roleName === "administrator";
  const permissions = parsePermissions(row.permissions);

  return {
    memberId: row.memberId,
    roleId: row.roleId,
    roleName: row.roleName,
    isPrivileged,
    canManageTeam: isPrivileged || permissions.team,
    canScan: isPrivileged || permissions.scan,
    canManageAssets: isPrivileged || permissions.asset,
    canManageRoles: isPrivileged || permissions.team,
  };
}

export async function getOrgScanAccess(orgId: string, userId: string): Promise<Pick<OrgMemberAccess, "memberId" | "roleId" | "roleName" | "canScan"> | null> {
  const access = await getOrgMemberAccess(orgId, userId);
  if (!access) return null;

  return {
    memberId: access.memberId,
    roleId: access.roleId,
    roleName: access.roleName,
    canScan: access.canScan,
  };
}
