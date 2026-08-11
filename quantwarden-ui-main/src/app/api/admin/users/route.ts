import { NextRequest, NextResponse } from "next/server";
import { validatePassword } from "@/lib/guest-auth";
import { prisma } from "@/lib/prisma";
import { getSuperAdminAuth, isSuperAdminEmail } from "@/lib/super-admin";
import { auth } from "@/lib/auth";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function credentialAccount(userId: string) {
  return prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true, password: true },
  });
}

export async function GET() {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        accounts: {
          where: { providerId: "credential" },
          select: { password: true },
        },
        _count: { select: { members: true } },
      },
    });

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        hasPassword: user.accounts.some((account) => Boolean(account.password)),
        organizationCount: user._count.members,
        superAdmin: isSuperAdminEmail(user.email),
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin users GET error:", error);
    return NextResponse.json({ error: "Could not load users." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = normalizeEmail(body.email);
    const passwordCheck = validatePassword(body.password);

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Name must be between 2 and 80 characters." }, { status: 400 });
    }
    if (!validEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!passwordCheck.ok) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
    }
    if (body.password !== body.confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
    }

    const ctx = await auth.$context;
    const passwordHash = await ctx.password.hash(passwordCheck.value);
    const userId = crypto.randomUUID();

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: userId,
          name,
          email,
          emailVerified: true,
        },
        select: { id: true, name: true, email: true, emailVerified: true, createdAt: true },
      });
      await tx.account.create({
        data: {
          id: crypto.randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: passwordHash,
        },
      });
      return created;
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    console.error("Admin users POST error:", error);
    return NextResponse.json({ error: "Could not create user." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = normalizeEmail(body.email);

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (name.length < 2 || name.length > 80 || !validEmail(email)) {
      return NextResponse.json({ error: "A valid name and email are required." }, { status: 400 });
    }
    if (isSuperAdminEmail(existing.email) && email !== existing.email.toLowerCase()) {
      return NextResponse.json({ error: "A configured super-admin email cannot be changed here." }, { status: 400 });
    }

    const duplicate = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (duplicate && duplicate.id !== userId) {
      return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
    }

    let passwordHash: string | null = null;
    if (body.password) {
      const passwordCheck = validatePassword(body.password);
      if (!passwordCheck.ok) return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
      if (body.password !== body.confirmPassword) {
        return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
      }
      const ctx = await auth.$context;
      passwordHash = await ctx.password.hash(passwordCheck.value);
    }

    const existingCredential = passwordHash ? await credentialAccount(userId) : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { name, email, emailVerified: true },
      });

      if (passwordHash) {
        if (existingCredential) {
          await tx.account.update({ where: { id: existingCredential.id }, data: { password: passwordHash } });
        } else {
          await tx.account.create({
            data: {
              id: crypto.randomUUID(),
              accountId: userId,
              providerId: "credential",
              userId,
              password: passwordHash,
            },
          });
        }
        await tx.session.deleteMany({ where: { userId, id: { not: admin.session.session.id } } });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin users PATCH error:", error);
    return NextResponse.json({ error: "Could not update user." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : "";
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (target.id === admin.session.user.id || isSuperAdminEmail(target.email)) {
      return NextResponse.json({ error: "The active super-admin account cannot be deleted." }, { status: 400 });
    }

    const [ownedOrganizations, scanBatches, scanSchedules] = await Promise.all([
      prisma.member.count({ where: { userId, role: "owner" } }),
      prisma.assetScanBatch.count({ where: { initiatedByUserId: userId } }),
      prisma.scanSchedule.count({ where: { createdByUserId: userId } }),
    ]);
    if (ownedOrganizations > 0) {
      return NextResponse.json(
        { error: "Transfer ownership of this user's organizations before deleting the account." },
        { status: 409 }
      );
    }
    if (scanBatches > 0 || scanSchedules > 0) {
      return NextResponse.json(
        { error: "This account has scan audit history. Disable it by resetting its password instead of deleting it." },
        { status: 409 }
      );
    }

    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin users DELETE error:", error);
    return NextResponse.json({ error: "Could not delete user." }, { status: 500 });
  }
}
