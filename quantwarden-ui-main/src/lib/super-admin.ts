import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export function getSuperAdminEmails(): string[] {
  return String(process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.trim().toLowerCase());
}

export async function isSuperAdminUser(
  userId: string,
  email?: string | null
): Promise<boolean> {
  if (isSuperAdminEmail(email)) return true;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return Boolean(user?.isSuperAdmin);
}

export async function getSuperAdminAuth() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }
  if (!(await isSuperAdminUser(session.user.id, session.user.email))) {
    return { ok: false as const, status: 403 as const, error: "Super-admin access required." };
  }
  return { ok: true as const, session };
}

export async function revokeSuperAdminMemberships(userId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "member" m
     USING "organization" o
     WHERE m."organizationId" = o.id
       AND m."userId" = $1
       AND m.id = md5(o.id || $1 || 'quantwarden-super-admin')`,
    userId
  );
}

export async function ensureSuperAdminMemberships(userId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
     SELECT md5(o.id || $1 || 'quantwarden-super-admin'), o.id, $1, 'admin', NOW()
     FROM "organization" o
     WHERE NOT EXISTS (
       SELECT 1 FROM "member" m
       WHERE m."organizationId" = o.id AND m."userId" = $1
     )`,
    userId
  );
}

export async function ensureSuperAdminOrganizationMembership(
  userId: string,
  organizationId: string
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
     SELECT md5($1 || $2 || 'quantwarden-super-admin'), $2, $1, 'admin', NOW()
     WHERE EXISTS (SELECT 1 FROM "organization" WHERE id = $2)
       AND NOT EXISTS (
         SELECT 1 FROM "member"
         WHERE "organizationId" = $2 AND "userId" = $1
       )`,
    userId,
    organizationId
  );
}
