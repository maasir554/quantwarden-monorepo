import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSuperAdminMemberships, getSuperAdminAuth } from "@/lib/super-admin";
import { writeOrganizationAuditLog } from "@/lib/audit-log";

export async function GET() {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

    await ensureSuperAdminMemberships(admin.session.user.id);
    const organizations = await prisma.$queryRawUnsafe<
      {
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        isPublic: boolean;
        discoverable: boolean;
        memberCount: number;
        assetCount: number;
        scanCount: number;
      }[]
    >(
      `SELECT o.id, o.name, o.slug, o."createdAt", o."isPublic", o.discoverable,
              (SELECT COUNT(*)::int FROM "member" m WHERE m."organizationId" = o.id) AS "memberCount",
              (SELECT COUNT(*)::int FROM "asset" a WHERE a."organizationId" = o.id) AS "assetCount",
              (SELECT COUNT(*)::int FROM "asset_scan_batch" b WHERE b."organizationId" = o.id) AS "scanCount"
       FROM "organization" o
       ORDER BY o."createdAt" DESC`
    );

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("Admin organizations GET error:", error);
    return NextResponse.json({ error: "Could not load organizations." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!organizationId || name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "A valid organization and name are required." }, { status: 400 });
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name,
        isPublic: Boolean(body.isPublic),
        discoverable: Boolean(body.discoverable),
      },
    });

    await writeOrganizationAuditLog({
      category: "configuration",
      action: "organization.settings_updated_by_admin",
      message: "Organization settings updated by a super administrator.",
      actorUserId: admin.session.user.id,
      actorEmail: admin.session.user.email,
      organizationId,
      targetType: "organization",
      targetId: organizationId,
      metadata: { requestsAllowed: Boolean(body.isPublic) },
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin organizations PATCH error:", error);
    return NextResponse.json({ error: "Could not update organization." }, { status: 500 });
  }
}
