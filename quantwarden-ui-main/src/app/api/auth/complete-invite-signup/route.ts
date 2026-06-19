import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function buildToken() {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
}

function splitSetCookieHeader(setCookie: string) {
  if (!setCookie) return [];

  const result: string[] = [];
  let start = 0;
  let index = 0;

  while (index < setCookie.length) {
    if (setCookie[index] === ",") {
      let lookahead = index + 1;

      while (lookahead < setCookie.length && setCookie[lookahead] === " ") {
        lookahead++;
      }

      while (
        lookahead < setCookie.length &&
        setCookie[lookahead] !== "=" &&
        setCookie[lookahead] !== ";" &&
        setCookie[lookahead] !== ","
      ) {
        lookahead++;
      }

      if (lookahead < setCookie.length && setCookie[lookahead] === "=") {
        const part = setCookie.slice(start, index).trim();
        if (part) result.push(part);
        start = index + 1;

        while (start < setCookie.length && setCookie[start] === " ") {
          start++;
        }

        index = start;
        continue;
      }
    }

    index++;
  }

  const tail = setCookie.slice(start).trim();
  if (tail) result.push(tail);

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inviteId = typeof body.inviteId === "string" ? body.inviteId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!inviteId || !name) {
      return NextResponse.json(
        { error: "Invite ID and full name are required." },
        { status: 400 }
      );
    }

    const inviteRows = await prisma.$queryRawUnsafe<{
      id: string;
      email: string;
      status: string;
      expiresAt: Date;
    }[]>(
      `SELECT id, email, status, "expiresAt" FROM "invitation" WHERE id = $1 LIMIT 1`,
      inviteId
    );

    const invite = inviteRows[0];

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: `Invitation already ${invite.status}.` }, { status: 400 });
    }

    if (new Date(invite.expiresAt) <= new Date()) {
      await prisma.$executeRawUnsafe(
        `UPDATE "invitation" SET status = 'expired' WHERE id = $1`,
        inviteId
      );

      return NextResponse.json({ error: "Invitation has expired." }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: invite.email,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "This email already has an account. Please sign in to continue." },
        { status: 409 }
      );
    }

    const token = buildToken();
    const ctx = await auth.$context;

    await ctx.internalAdapter.createVerificationValue({
      identifier: token,
      value: JSON.stringify({
        email: invite.email.toLowerCase(),
        name,
        attempt: 0,
      }),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const baseUrl =
      process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin;

    const verifyUrl = new URL("/api/auth/magic-link/verify", baseUrl);
    verifyUrl.searchParams.set("token", token);
    verifyUrl.searchParams.set("callbackURL", `/app/invites/${inviteId}`);

    const authResponse = await auth.handler(
      new Request(verifyUrl.toString(), {
        method: "GET",
        headers: req.headers,
      })
    );

    const redirectTo = authResponse.headers.get("location") || `/app/invites/${inviteId}`;
    const nextResponse = NextResponse.json({ redirectTo });

    const authHeaders = authResponse.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = authHeaders.getSetCookie?.() || [];

    if (setCookies.length === 0) {
      const combinedSetCookie = authResponse.headers.get("set-cookie");
      if (combinedSetCookie) {
        for (const cookie of splitSetCookieHeader(combinedSetCookie)) {
          nextResponse.headers.append("set-cookie", cookie);
        }
      }
    } else {
      for (const cookie of setCookies) {
        nextResponse.headers.append("set-cookie", cookie);
      }
    }

    return nextResponse;
  } catch (error) {
    console.error("Complete invite signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
