import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    // Get the current session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user's organizations with their role and member count in one query
    const orgs = await prisma.$queryRawUnsafe<
      {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
        createdAt: Date;
        metadata: string | null;
        isPublic: boolean;
        discoverable: boolean;
        role: string;
        memberCount: number;
      }[]
    >(
      `SELECT 
        o.id, o.name, o.slug, o.logo, o."createdAt", o.metadata,
        o."isPublic", o.discoverable,
        COALESCE(r.name, m.role) as role,
        (SELECT COUNT(*)::int FROM "member" m2 WHERE m2."organizationId" = o.id) as "memberCount"
      FROM "organization" o
      INNER JOIN "member" m ON m."organizationId" = o.id AND m."userId" = $1
      LEFT JOIN "role" r ON r.id::text = m.role AND r."organizationId" = o.id
      ORDER BY o."createdAt" DESC`,
      userId
    );

    // Also fetch pending/denied join requests for the user
    const pendingRequests = await prisma.$queryRawUnsafe<
      {
        requestId: string;
        organizationId: string;
        orgName: string;
        orgSlug: string;
        orgLogo: string | null;
        status: string;
        createdAt: Date;
        memberCount: number;
      }[]
    >(
      `SELECT 
        jr.id as "requestId", jr."organizationId", jr.status, jr."createdAt",
        o.name as "orgName", o.slug as "orgSlug", o.logo as "orgLogo",
        (SELECT COUNT(*)::int FROM "member" m2 WHERE m2."organizationId" = o.id) as "memberCount"
      FROM "join_request" jr
      INNER JOIN "organization" o ON o.id = jr."organizationId"
      WHERE jr."userId" = $1 AND jr.status IN ('pending', 'denied')
      ORDER BY jr."createdAt" DESC`,
      userId
    );

    return NextResponse.json({ organizations: orgs, pendingRequests });
  } catch (error) {
    console.error("List orgs error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
