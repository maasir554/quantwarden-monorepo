import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgMemberAccess } from "@/lib/org-scan-permissions";
import { inferAssetBucket, normalizeAssetBucket } from "@/lib/asset-buckets";
import { normalizeAssetOpenPorts } from "@/lib/port-discovery";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const memberRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
      orgId,
      session.user.id
    );

    if (memberRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let assets: any[] = [];
    try {
      assets = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, value, type, "isRoot", "parentId", "resolvedIp", "openPorts", bucket, "createdAt", "scanStatus", "lastScanDate", "portDiscoveryStatus", "lastPortDiscoveryDate" FROM "asset" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC`,
        orgId
      );
    } catch(err) {
      try {
        assets = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, value, type, "isRoot", "parentId", "resolvedIp", "openPorts", "createdAt", "scanStatus", "lastScanDate", "portDiscoveryStatus", "lastPortDiscoveryDate" FROM "asset" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC`,
          orgId
        );
      } catch {
        assets = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, value, type, "isRoot", "parentId", "createdAt" FROM "asset" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC`,
          orgId
        );
      }
    }

    return NextResponse.json({
      assets: assets.map((asset) => ({
        ...asset,
        bucket: normalizeAssetBucket(asset.bucket || inferAssetBucket(asset.value)),
      })),
    });
  } catch (error) {
    console.error("Asset fetch error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, value, type, isRoot, parentId, openPorts, bucket } = await req.json();

    if (!orgId || !value) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const access = await getOrgMemberAccess(orgId, session.user.id);
    if (!access?.canManageAssets) {
      return NextResponse.json({ error: "Forbidden: You do not have asset management permission." }, { status: 403 });
    }

    const assetId = crypto.randomUUID();
    let query = "";
    const normalizedOpenPorts = normalizeAssetOpenPorts(openPorts);
    const normalizedBucket = normalizeAssetBucket(bucket || inferAssetBucket(value));
    const params: any[] = [assetId, value, type, isRoot, orgId, false, JSON.stringify(normalizedOpenPorts), normalizedBucket, new Date()];
    
    if (parentId) {
      query = `INSERT INTO "asset" (id, value, type, "isRoot", "organizationId", verified, "openPorts", bucket, "createdAt", "parentId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
      params.push(parentId);
    } else {
      query = `INSERT INTO "asset" (id, value, type, "isRoot", "organizationId", verified, "openPorts", bucket, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
    }

    try {
      await prisma.$executeRawUnsafe(query, ...params);
    } catch (dbError: any) {
      const missingNewColumns =
        typeof dbError?.message === "string" &&
        (dbError.message.includes("openPorts") || dbError.message.includes("resolvedIp") || dbError.message.includes("bucket"));

      if (missingNewColumns) {
        const legacyParams: any[] = [assetId, value, type, isRoot, orgId, false, new Date()];
        const legacyQuery = parentId
          ? `INSERT INTO "asset" (id, value, type, "isRoot", "organizationId", verified, "createdAt", "parentId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
          : `INSERT INTO "asset" (id, value, type, "isRoot", "organizationId", verified, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)`;

        if (parentId) legacyParams.push(parentId);
        await prisma.$executeRawUnsafe(legacyQuery, ...legacyParams);
      } else if (dbError.code !== 'P2002' && !dbError.message?.includes('unique constraint')) {
        throw dbError;
      }
    }

    return NextResponse.json({ success: true, asset: { id: assetId, bucket: normalizedBucket } });
  } catch (error) {
    console.error("Asset insert error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const orgId = searchParams.get("orgId");

    if (!id || !orgId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const access = await getOrgMemberAccess(orgId, session.user.id);
    if (!access?.canManageAssets) {
      return NextResponse.json({ error: "Forbidden: You do not have asset management permission." }, { status: 403 });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "asset" WHERE id = $1 AND "organizationId" = $2`, id, orgId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Asset delete error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, id, openPorts, bucket } = await req.json();

    if (!orgId || !id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const access = await getOrgMemberAccess(orgId, session.user.id);
    if (!access?.canManageAssets) {
      return NextResponse.json({ error: "Forbidden: You do not have asset management permission." }, { status: 403 });
    }

    const hasOpenPortsUpdate = Array.isArray(openPorts);
    const hasBucketUpdate = typeof bucket === "string";

    if (!hasOpenPortsUpdate && !hasBucketUpdate) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const normalizedOpenPorts = hasOpenPortsUpdate ? normalizeAssetOpenPorts(openPorts) : null;
    const normalizedBucket = hasBucketUpdate ? normalizeAssetBucket(bucket) : null;
    try {
      if (hasOpenPortsUpdate && hasBucketUpdate) {
        await prisma.$executeRawUnsafe(
          `UPDATE "asset"
           SET "openPorts" = $1, bucket = $2
           WHERE id = $3 AND "organizationId" = $4`,
          JSON.stringify(normalizedOpenPorts),
          normalizedBucket,
          id,
          orgId
        );
      } else if (hasOpenPortsUpdate) {
        await prisma.$executeRawUnsafe(
          `UPDATE "asset"
           SET "openPorts" = $1
           WHERE id = $2 AND "organizationId" = $3`,
          JSON.stringify(normalizedOpenPorts),
          id,
          orgId
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "asset"
           SET bucket = $1
           WHERE id = $2 AND "organizationId" = $3`,
          normalizedBucket,
          id,
          orgId
        );
      }
    } catch (dbError: any) {
      const missingOpenPortsColumn =
        typeof dbError?.message === "string" &&
        dbError.message.includes(`column "openPorts" of relation "asset" does not exist`);

      if (missingOpenPortsColumn) {
        return NextResponse.json(
          {
            error: `The database schema is missing the asset open ports column. Please run Prisma schema sync on this database instance first.`,
            code: "MISSING_OPEN_PORTS_COLUMN",
          },
          { status: 409 }
        );
      }

      const missingBucketColumn =
        typeof dbError?.message === "string" &&
        dbError.message.includes(`column "bucket" of relation "asset" does not exist`);

      if (missingBucketColumn) {
        return NextResponse.json(
          {
            error: `The database schema is missing the asset bucket column. Please run Prisma schema sync on this database instance first.`,
            code: "MISSING_ASSET_BUCKET_COLUMN",
          },
          { status: 409 }
        );
      }

      throw dbError;
    }

    return NextResponse.json({
      success: true,
      asset: {
        id,
        ...(normalizedOpenPorts ? { openPorts: normalizedOpenPorts } : {}),
        ...(normalizedBucket ? { bucket: normalizedBucket } : {}),
      },
    });
  } catch (error) {
    console.error("Asset patch error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
