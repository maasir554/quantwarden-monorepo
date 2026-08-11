import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

// GET /api/orgs/members?orgId=...
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    // Verify caller is a member (configured super admins are attached lazily).
    const callerAccess = await getOrgMemberAccess(orgId, session.user.id);
    if (!callerAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all members with user info, resolving custom role UUIDs to names
    const members = await prisma.$queryRawUnsafe<any[]>(
      `SELECT m.id, m.role as "roleId", 
              COALESCE(r.name, m.role) as role,
              m."createdAt", m."userId",
              u.name as "userName", u.email as "userEmail", u.image as "userImage", u.username as "userUsername"
       FROM "member" m
       INNER JOIN "user" u ON u.id = m."userId"
       LEFT JOIN "role" r ON r.id::text = m.role AND r."organizationId" = m."organizationId"
       WHERE m."organizationId" = $1
       ORDER BY 
         CASE m.role 
           WHEN 'owner' THEN 0 
           WHEN 'admin' THEN 1 
           ELSE 2 
         END,
         m."createdAt" ASC`,
      orgId
    );

    return NextResponse.json(members);
  } catch (error) {
    console.error("GET members error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH /api/orgs/members — update role
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, memberId, newRole } = await req.json();
    if (!organizationId || !memberId || !newRole) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const callerAccess = await getOrgMemberAccess(organizationId, session.user.id);
    if (!callerAccess?.canManageTeam) {
      return NextResponse.json({ error: "Forbidden: You do not have team management permission." }, { status: 403 });
    }

    // Cannot change owner's role
    const targetRows = await prisma.$queryRawUnsafe<{ role: string, userId: string }[]>(
      `SELECT role, "userId" FROM "member" WHERE id = $1 AND "organizationId" = $2 LIMIT 1`,
      memberId,
      organizationId
    );
    if (targetRows.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (targetRows[0].role === "owner") {
      return NextResponse.json({ error: "Cannot change the owner's role." }, { status: 400 });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "member" SET role = $1 WHERE id = $2 AND "organizationId" = $3`,
      newRole,
      memberId,
      organizationId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH member error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/orgs/members — remove member
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, memberId } = await req.json();
    if (!organizationId || !memberId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Check target member
    const targetRows = await prisma.$queryRawUnsafe<{ role: string, userId: string }[]>(
      `SELECT role, "userId" FROM "member" WHERE id = $1 AND "organizationId" = $2 LIMIT 1`,
      memberId,
      organizationId
    );
    if (targetRows.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isLeavingSelf = targetRows[0].userId === session.user.id;

    if (isLeavingSelf) {
      // Cannot leave if you're the owner
      if (targetRows[0].role === "owner") {
        return NextResponse.json({ error: "Owner cannot leave the organization. Transfer ownership first." }, { status: 400 });
      }
    } else {
      const callerAccess = await getOrgMemberAccess(organizationId, session.user.id);
      if (!callerAccess?.canManageTeam) {
        return NextResponse.json({ error: "Forbidden: You do not have team management permission." }, { status: 403 });
      }
      // Cannot remove the owner
      if (targetRows[0].role === "owner") {
        return NextResponse.json({ error: "Cannot remove the organization owner." }, { status: 400 });
      }
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "member" WHERE id = $1 AND "organizationId" = $2`,
      memberId,
      organizationId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE member error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
