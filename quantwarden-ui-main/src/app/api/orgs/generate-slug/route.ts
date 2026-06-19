import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function generateCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET() {
  try {
    let code = generateCode();
    let attempts = 0;
    const maxAttempts = 10;

    // Retry if collision
    while (attempts < maxAttempts) {
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "organization" WHERE slug = $1 LIMIT 1`,
        code
      );
      if (rows.length === 0) {
        return NextResponse.json({ slug: code });
      }
      code = generateCode();
      attempts++;
    }

    return NextResponse.json(
      { error: "Failed to generate unique code. Please try again." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Generate slug error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
