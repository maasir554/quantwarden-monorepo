import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: inviteId } = await params;

    const authEmail = session.user.email;
    if (!authEmail) {
      return NextResponse.json({ error: "No email mapped to your login session." }, { status: 400 });
    }

    // Fetch the invite with relations
    const inviteRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT i.*, 
              o.name as "orgName", o.slug as "orgSlug", 
              u.name as "userName", u.email as "userEmail"
       FROM "invitation" i
       LEFT JOIN "organization" o ON o.id = i."organizationId"
       LEFT JOIN "user" u ON u.id = i."inviterId"
       WHERE i.id = $1 LIMIT 1`,
      inviteId
    );
    const inviteQuery = inviteRows.length > 0 ? inviteRows[0] : null;

    if (!inviteQuery) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // We only serve the full payload if the auth email matches
    if (inviteQuery.email.toLowerCase() !== authEmail.toLowerCase()) {
      return NextResponse.json({ error: "This invitation is for someone else." }, { status: 403 });
    }

    // Attempt to lookup the precise roleName if it exists
    let roleName = "Member";
    if (inviteQuery.role) {
      const roleQuery = await prisma.$queryRawUnsafe<{ name: string }[]>(
        `SELECT name FROM "role" WHERE id = $1 LIMIT 1`,
        inviteQuery.role
      );
      if (roleQuery.length > 0) roleName = roleQuery[0].name;
    }

    return NextResponse.json({
      id: inviteQuery.id,
      organizationId: inviteQuery.organizationId,
      email: inviteQuery.email,
      status: inviteQuery.status,
      expiresAt: inviteQuery.expiresAt,
      roleName: roleName,
      organization: { name: inviteQuery.orgName, slug: inviteQuery.orgSlug },
      user: { name: inviteQuery.userName, email: inviteQuery.userEmail },
    });
  } catch (error) {
    console.error("GET Invite error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: inviteId } = await params;
    const body = await req.json();
    const action = body.action; // "accept" or "decline"

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Fetch raw invite to check existence, status, and owner
    const rawInvites = await prisma.$queryRawUnsafe<{ id: string, email: string, status: string, "organizationId": string, "expiresAt": Date, role: string }[]>(
      `SELECT * FROM "invitation" WHERE id = $1 LIMIT 1`,
      inviteId
    );
    const invite = rawInvites.length > 0 ? rawInvites[0] : null;

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invite.email.toLowerCase() !== session.user.email?.toLowerCase()) {
      return NextResponse.json({ error: "This invitation was sent to a different email address." }, { status: 403 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: `Invitation already ${invite.status}` }, { status: 400 });
    }

    if (new Date() > new Date(invite.expiresAt)) {
      // Mark as expired implicitly
      await prisma.$executeRawUnsafe(
        `UPDATE "invitation" SET status = 'expired' WHERE id = $1`,
        inviteId
      );
      return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
    }

    if (action === "decline") {
      await prisma.$executeRawUnsafe(
        `UPDATE "invitation" SET status = 'declined' WHERE id = $1`,
        inviteId
      );
      return NextResponse.json({ success: true });
    }

    if (action === "accept") {
      // Begin transaction to ensure data integrity
      await prisma.$transaction(async (tx) => {
        // Mark invite accepted
        await tx.$executeRawUnsafe(
          `UPDATE "invitation" SET status = 'accepted' WHERE id = $1`,
          inviteId
        );

        // Insert Member record
        const memberId = crypto.randomUUID();
        await tx.$executeRawUnsafe(
          `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
           VALUES ($1, $2, $3, $4, $5)`,
          memberId,
          invite.organizationId,
          session.user.id,
          invite.role || "member", // The ID of the custom/system role
          new Date()
        );
      });

      return NextResponse.json({ success: true });
    }

  } catch (error) {
    console.error("PATCH Invite error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: inviteId } = await params;

    // Check existing invite
    const rawDelInvites = await prisma.$queryRawUnsafe<{ id: string, "organizationId": string }[]>(
      `SELECT id, "organizationId" FROM "invitation" WHERE id = $1 LIMIT 1`,
      inviteId
    );
    const invite = rawDelInvites.length > 0 ? rawDelInvites[0] : null;

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const access = await getOrgMemberAccess(invite.organizationId, session.user.id);
    if (!access?.canManageTeam) {
      return NextResponse.json({ error: "Forbidden: You do not have team management permission." }, { status: 403 });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "invitation" WHERE id = $1`,
      inviteId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Invite error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
