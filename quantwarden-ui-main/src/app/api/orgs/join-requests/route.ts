import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

// GET /api/orgs/join-requests?orgId=...
// Admin view: get pending requests for the org
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

    const access = await getOrgMemberAccess(orgId, session.user.id);
    if (!access?.canManageTeam) {
      return NextResponse.json({ error: "Forbidden: You do not have team management permission." }, { status: 403 });
    }

    const requests = await prisma.$queryRawUnsafe<any[]>(
      `SELECT jr.id, jr.status, jr."createdAt", jr."userId",
              u.name as "userName", u.email as "userEmail", u.image as "userImage"
       FROM "join_request" jr
       INNER JOIN "user" u ON u.id = jr."userId"
       WHERE jr."organizationId" = $1 AND jr.status = 'pending'
       ORDER BY jr."createdAt" ASC`,
      orgId
    );

    return NextResponse.json(requests);
  } catch (error) {
    console.error("GET join-requests error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/orgs/join-requests — user creates a join request
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await req.json();
    if (!slug || slug.length < 3) {
      return NextResponse.json({ error: "Invalid organization code." }, { status: 400 });
    }

    // Find organization
    const orgRows = await prisma.$queryRawUnsafe<{ id: string, isPublic: boolean }[]>(
      `SELECT id, "isPublic" FROM "organization" WHERE slug = $1 LIMIT 1`,
      slug.toLowerCase()
    );
    if (orgRows.length === 0) {
      return NextResponse.json({ error: "Organization not found. Check the code and try again." }, { status: 404 });
    }

    const orgId = orgRows[0].id;
    const isPublic = orgRows[0].isPublic;

    // Check if already a member
    const memberRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      orgId,
      session.user.id
    );
    if (memberRows.length > 0) {
      return NextResponse.json({ error: "You are already a member of this organization." }, { status: 400 });
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "join_request" WHERE "organizationId" = $1 AND "userId" = $2 AND status = 'pending' LIMIT 1`,
      orgId,
      session.user.id
    );
    if (existingRequest.length > 0) {
      return NextResponse.json({ error: "You already have a pending request for this organization." }, { status: 400 });
    }

    if (isPublic) {
      // Public org: instant join
      const newMemberId = crypto.randomUUID().replace(/-/g, "");
      await prisma.$executeRawUnsafe(
        `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)`,
        newMemberId,
        orgId,
        session.user.id,
        "member",
        new Date()
      );
      return NextResponse.json({ success: true, instant: true, organizationId: orgId });
    } else {
      // Private org: create join request
      const requestId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "join_request" (id, "organizationId", "userId", status, "createdAt") VALUES ($1, $2, $3, 'pending', $4)`,
        requestId,
        orgId,
        session.user.id,
        new Date()
      );
      return NextResponse.json({ success: true, instant: false, requestPending: true, organizationId: orgId });
    }
  } catch (error) {
    console.error("POST join-request error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// PATCH /api/orgs/join-requests — admin accepts or denies
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId, action, role } = await req.json();
    if (!requestId || (action !== "accept" && action !== "deny")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Fetch the request
    const requestRows = await prisma.$queryRawUnsafe<{ id: string, organizationId: string, userId: string, status: string }[]>(
      `SELECT id, "organizationId", "userId", status FROM "join_request" WHERE id = $1 LIMIT 1`,
      requestId
    );
    if (requestRows.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const joinReq = requestRows[0];
    if (joinReq.status !== "pending") {
      return NextResponse.json({ error: `Request already ${joinReq.status}` }, { status: 400 });
    }

    const access = await getOrgMemberAccess(joinReq.organizationId, session.user.id);
    if (!access?.canManageTeam) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "deny") {
      await prisma.$executeRawUnsafe(
        `UPDATE "join_request" SET status = 'denied' WHERE id = $1`,
        requestId
      );
      return NextResponse.json({ success: true });
    }

    if (action === "accept") {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE "join_request" SET status = 'accepted' WHERE id = $1`,
          requestId
        );
        const memberId = crypto.randomUUID().replace(/-/g, "");
        await tx.$executeRawUnsafe(
          `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)`,
          memberId,
          joinReq.organizationId,
          joinReq.userId,
          role || "member",
          new Date()
        );
      });
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("PATCH join-request error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/orgs/join-requests — user withdraws their own request
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: "Request ID required" }, { status: 400 });
    }

    // Verify ownership of the request
    const requestRows = await prisma.$queryRawUnsafe<{ id: string, userId: string, status: string }[]>(
      `SELECT id, "userId", status FROM "join_request" WHERE id = $1 LIMIT 1`,
      requestId
    );
    if (requestRows.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (requestRows[0].userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "join_request" WHERE id = $1`,
      requestId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE join-request error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
