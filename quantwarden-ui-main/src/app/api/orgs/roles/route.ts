import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, roles } = await req.json();

    if (!organizationId || !Array.isArray(roles)) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const access = await getOrgMemberAccess(organizationId, session.user.id);
    if (!access?.canManageRoles) {
      return NextResponse.json({ error: "Forbidden: You do not have role management permission." }, { status: 403 });
    }

    // Upsert roles (insert if new, update if exists)
    // To handle deletion, we delete all custom roles that are not in the payload
    // We assume system roles are "owner", "admin", "analyst", "auditor" which can't be deleted

    const submittedIds = roles.map((r: any) => r.id).filter((id: string) => id && id.length > 5);

    // Delete custom roles not in the submitted list
    if (submittedIds.length > 0) {
      const idList = submittedIds.map((id: string) => `'${id}'`).join(',');
      await prisma.$executeRawUnsafe(
        `DELETE FROM "role" WHERE "organizationId" = $1 AND name NOT IN ('Owner', 'Administrator', 'Analyst', 'Auditor') AND id NOT IN (${idList})`,
        organizationId
      );
    } else {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "role" WHERE "organizationId" = $1 AND name NOT IN ('Owner', 'Administrator', 'Analyst', 'Auditor')`,
        organizationId
      );
    }

    for (const r of roles) {
      if (!r.name) continue;

      // check if it exists
      let existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "role" WHERE id = $1 AND "organizationId" = $2 LIMIT 1`,
        r.id,
        organizationId
      );

      if (existing.length === 0 && ['Owner', 'Administrator', 'Analyst', 'Auditor'].includes(r.name)) {
        existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "role" WHERE name = $1 AND "organizationId" = $2 LIMIT 1`,
          r.name,
          organizationId
        );
      }

      if (existing.length > 0) {
        // Update
        await prisma.$executeRawUnsafe(
          `UPDATE "role" SET name = $1, permissions = $2 WHERE id = $3 AND "organizationId" = $4`,
          r.name,
          JSON.stringify(r.permissions || {}),
          existing[0].id,
          organizationId
        );
      } else {
        // Insert
        // Make sure we have a valid uuid
        const roleId = (r.id && r.id.length > 10) ? r.id : crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "role" (id, name, permissions, "organizationId", "createdAt") VALUES ($1, $2, $3, $4, $5)`,
          roleId,
          r.name,
          JSON.stringify(r.permissions || {}),
          organizationId,
          new Date()
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Role update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
