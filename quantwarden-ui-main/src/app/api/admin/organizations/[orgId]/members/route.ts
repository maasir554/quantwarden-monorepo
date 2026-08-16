import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureSuperAdminOrganizationMembership,
  getSuperAdminAuth,
  isSuperAdminEmail,
} from "@/lib/super-admin";
import { writeOrganizationAuditLog } from "@/lib/audit-log";

async function resolveContext(context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  return orgId;
}

async function validAssignableRole(organizationId: string, role: string) {
  if (["admin", "analyst", "auditor", "member"].includes(role.toLowerCase())) return true;
  return Boolean(
    await prisma.role.findFirst({
      where: { organizationId, OR: [{ id: role }, { name: { equals: role, mode: "insensitive" } }] },
      select: { id: true },
    })
  );
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
    const organizationId = await resolveContext(context);
    await ensureSuperAdminOrganizationMembership(admin.session.user.id, organizationId);

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    const members = await prisma.$queryRawUnsafe<
      {
        id: string;
        userId: string;
        roleId: string;
        roleName: string;
        userName: string;
        userEmail: string;
        createdAt: Date;
      }[]
    >(
      `SELECT m.id, m."userId", m.role AS "roleId", COALESCE(r.name, m.role) AS "roleName",
              u.name AS "userName", u.email AS "userEmail", m."createdAt"
       FROM "member" m
       JOIN "user" u ON u.id = m."userId"
       LEFT JOIN "role" r ON r."organizationId" = m."organizationId"
         AND (r.id::text = m.role OR LOWER(r.name) = LOWER(m.role))
       WHERE m."organizationId" = $1
       ORDER BY CASE WHEN m.role = 'owner' THEN 0 WHEN m.role = 'admin' THEN 1 ELSE 2 END,
                m."createdAt" ASC`,
      organizationId
    );
    const roles = await prisma.role.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, permissions: true },
    });

    return NextResponse.json({ organization, members, roles });
  } catch (error) {
    console.error("Admin members GET error:", error);
    return NextResponse.json({ error: "Could not load organization members." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
    const organizationId = await resolveContext(context);
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : "";
    const role = typeof body.role === "string" ? body.role.trim() : "member";

    if (!userId || role.toLowerCase() === "owner" || !(await validAssignableRole(organizationId, role))) {
      return NextResponse.json({ error: "Choose a valid user and non-owner role." }, { status: 400 });
    }
    const [organization, user, existing] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.member.findFirst({ where: { organizationId, userId }, select: { id: true } }),
    ]);
    if (!organization || !user) return NextResponse.json({ error: "Organization or user not found." }, { status: 404 });
    if (existing) return NextResponse.json({ error: "That user is already a member." }, { status: 409 });

    await prisma.member.create({
      data: { id: crypto.randomUUID(), organizationId, userId, role, createdAt: new Date() },
    });
    await writeOrganizationAuditLog({
      category: "team",
      action: "team.member_added_by_admin",
      message: `Super administrator added a member with the ${role} role.`,
      actorUserId: admin.session.user.id,
      actorEmail: admin.session.user.email,
      organizationId,
      targetType: "user",
      targetId: userId,
      metadata: { role },
      request: req,
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Admin members POST error:", error);
    return NextResponse.json({ error: "Could not add member." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
    const organizationId = await resolveContext(context);
    const body = await req.json().catch(() => ({}));
    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    if (!memberId || role.toLowerCase() === "owner" || !(await validAssignableRole(organizationId, role))) {
      return NextResponse.json({ error: "Choose a valid non-owner role." }, { status: 400 });
    }

    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId },
      include: { user: { select: { email: true, isSuperAdmin: true } } },
    });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (member.role.toLowerCase() === "owner") {
      return NextResponse.json({ error: "Organization ownership must be transferred explicitly." }, { status: 409 });
    }
    if (member.user.isSuperAdmin || isSuperAdminEmail(member.user.email)) {
      return NextResponse.json({ error: "The configured super-admin membership is protected." }, { status: 400 });
    }

    await prisma.member.update({ where: { id: memberId }, data: { role } });
    await writeOrganizationAuditLog({
      category: "team",
      action: "team.member_role_updated_by_admin",
      message: `Super administrator changed a member role from ${member.role} to ${role}.`,
      actorUserId: admin.session.user.id,
      actorEmail: admin.session.user.email,
      organizationId,
      targetType: "user",
      targetId: member.userId,
      metadata: { previousRole: member.role, newRole: role },
      request: req,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin members PATCH error:", error);
    return NextResponse.json({ error: "Could not update member." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
    const organizationId = await resolveContext(context);
    const body = await req.json().catch(() => ({}));
    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId },
      include: { user: { select: { email: true, isSuperAdmin: true } } },
    });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (member.role.toLowerCase() === "owner" || member.user.isSuperAdmin || isSuperAdminEmail(member.user.email)) {
      return NextResponse.json({ error: "Owner and super-admin memberships are protected." }, { status: 409 });
    }

    await prisma.member.delete({ where: { id: memberId } });
    await writeOrganizationAuditLog({
      category: "team",
      action: "team.member_removed_by_admin",
      message: "Super administrator removed a member.",
      actorUserId: admin.session.user.id,
      actorEmail: admin.session.user.email,
      organizationId,
      targetType: "user",
      targetId: member.userId,
      metadata: { previousRole: member.role },
      request: req,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin members DELETE error:", error);
    return NextResponse.json({ error: "Could not remove member." }, { status: 500 });
  }
}
