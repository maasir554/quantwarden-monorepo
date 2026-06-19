import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { enqueueOnboardingWorkflow } from "@/lib/scan-workflow";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, discoverable, isPublic, domains, setupComplete, roles } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    // Verify permissions
    const memberRows = await prisma.$queryRawUnsafe<{ role: string }[]>(
      `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      organizationId,
      session.user.id
    );

    if (memberRows.length === 0 || (memberRows[0].role !== "owner" && memberRows[0].role !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Only owners and admins can complete setup." }, { status: 403 });
    }

    // Partial update properties
    const setQueryParts = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (discoverable !== undefined) {
      setQueryParts.push(`discoverable = $${paramIndex++}`);
      values.push(!!discoverable);
    }
    if (isPublic !== undefined) {
      setQueryParts.push(`"isPublic" = $${paramIndex++}`);
      values.push(!!isPublic);
    }
    if (setupComplete !== undefined) {
      setQueryParts.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify({ setupComplete: !!setupComplete }));
    }

    if (setQueryParts.length > 0) {
      values.push(organizationId); // Add organizationId at the very end
      const query = `UPDATE "organization" SET ${setQueryParts.join(", ")} WHERE id = $${paramIndex}`;
      await prisma.$executeRawUnsafe(query, ...values);
    }

    // Update Domains if provided
    if (domains && Array.isArray(domains)) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "asset" WHERE "organizationId" = $1 AND "isRoot" = true AND type = 'domain'`,
        organizationId
      );

      for (const d of domains) {
        try {
          const assetId = crypto.randomUUID();
          await prisma.$executeRawUnsafe(
            `INSERT INTO "asset" (id, value, type, "isRoot", "organizationId", verified, "openPorts", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            assetId,
            d,
            "domain",
            true,
            organizationId,
            false,
            JSON.stringify([{ number: 443, protocol: "tcp" }]),
            new Date()
          );
        } catch (e) {
          console.warn("Domain insert failed for:", d, e);
        }
      }
    }

    // Trigger onboarding workflow AFTER domains are saved so root assets exist in DB.
    // Chain: subdomain discovery → full port discovery → full openssl scan.
    if (setupComplete === true) {
      void (async () => {
        try {
          const rootAssets = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id FROM "asset"
             WHERE "organizationId" = $1
               AND "isRoot" = true
               AND type = 'domain'
             ORDER BY "createdAt" ASC`,
            organizationId
          );
          for (const asset of rootAssets) {
            await enqueueOnboardingWorkflow(organizationId, asset.id, session.user.id);
          }
        } catch (err: any) {
          console.warn("[workflow] Failed to enqueue onboarding workflows:", err?.message);
        }
      })();
    }

    // Update Roles if provided
    if (roles && Array.isArray(roles)) {
      // Remove roles that are no longer in the list (by ID)
      const incomingIds = roles
        .map((r: any) => (typeof r.id === "string" && r.id.trim() ? r.id.trim() : null))
        .filter(Boolean);

      if (incomingIds.length > 0) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "role" WHERE "organizationId" = $1 AND id != ALL($2::text[])`,
          organizationId,
          incomingIds
        );
      } else {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "role" WHERE "organizationId" = $1`,
          organizationId
        );
      }

      for (const r of roles) {
        try {
          // Preserve the client-provided ID so invitation.role FKs remain valid
          const roleId = typeof r.id === "string" && r.id.trim() ? r.id.trim() : crypto.randomUUID();
          await prisma.$executeRawUnsafe(
            `INSERT INTO "role" (id, name, permissions, "organizationId", "createdAt")
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE
               SET name = EXCLUDED.name,
                   permissions = EXCLUDED.permissions`,
            roleId,
            r.name,
            JSON.stringify(r.permissions || {}),
            organizationId,
            new Date()
          );
        } catch (e) {
          console.warn("Role upsert failed for:", r.name, e);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Org setup error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
