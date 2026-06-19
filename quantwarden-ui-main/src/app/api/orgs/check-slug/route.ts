import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug");

    if (!slug || slug.length < 1) {
      return NextResponse.json({ available: false, error: "Slug is required." }, { status: 400 });
    }

    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "organization" WHERE slug = $1 LIMIT 1`,
      slug.toLowerCase()
    );

    return NextResponse.json({ available: rows.length === 0 });
  } catch (error) {
    console.error("Check slug error:", error);
    return NextResponse.json(
      { available: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}
