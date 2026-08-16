import { NextRequest, NextResponse } from "next/server";
import { AUDIT_CATEGORIES, type AuditCategory } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { getSuperAdminAuth } from "@/lib/super-admin";

const ORG_CATEGORIES: AuditCategory[] = ["organization", "scan", "team", "configuration"];

function filters(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") === "authentication" ? "authentication" : "organization";
  const organizationId = req.nextUrl.searchParams.get("organizationId")?.trim() || undefined;
  const category = req.nextUrl.searchParams.get("category")?.trim() || undefined;
  const query = req.nextUrl.searchParams.get("query")?.trim().slice(0, 100) || undefined;
  const take = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 100, 1), 500);
  const categories = mode === "authentication"
    ? ["authentication"]
    : category && AUDIT_CATEGORIES.includes(category as AuditCategory) && category !== "authentication"
      ? [category]
      : ORG_CATEGORIES;

  return { mode, organizationId, query, take, categories };
}

function logLine(log: {
  createdAt: Date;
  status: string;
  category: string;
  action: string;
  actorEmail: string | null;
  organizationName: string | null;
  ipAddress: string | null;
  message: string;
  metadata: unknown;
}) {
  const context = [
    `actor=${log.actorEmail || "system"}`,
    log.organizationName ? `organization=${JSON.stringify(log.organizationName)}` : null,
    log.ipAddress ? `ip=${log.ipAddress}` : null,
  ].filter(Boolean).join(" ");
  const metadata = log.metadata ? ` metadata=${JSON.stringify(log.metadata)}` : "";
  return `${log.createdAt.toISOString()} [${log.status.toUpperCase()}] [${log.category}] ${log.action} ${context} - ${log.message}${metadata}`;
}

function normalizePartialScanLog<Log extends {
  category: string;
  action: string;
  status: string;
  message: string;
  metadata: unknown;
}>(log: Log): Log {
  if (log.category !== "scan" || log.status !== "failure" || !log.metadata || typeof log.metadata !== "object") {
    return log;
  }

  const metadata = log.metadata as Record<string, unknown>;
  const completedAssets = Number(metadata.completedAssets || 0);
  const failedAssets = Number(metadata.failedAssets || 0);
  if (completedAssets <= 0 || failedAssets <= 0) return log;

  const engine = typeof metadata.engine === "string" ? metadata.engine : "Scan";
  return {
    ...log,
    action: "scan.batch_partial",
    status: "warning",
    message: `${engine} scan batch completed with issues: ${completedAssets} completed, ${failedAssets} unsuccessful.`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getSuperAdminAuth();
    if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
    const { mode, organizationId, query, take, categories } = filters(req);
    const where = {
      category: { in: categories },
      ...(organizationId ? { organizationId } : {}),
      ...(query ? {
        OR: [
          { message: { contains: query, mode: "insensitive" as const } },
          { action: { contains: query, mode: "insensitive" as const } },
          { actorEmail: { contains: query, mode: "insensitive" as const } },
          { organizationName: { contains: query, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const logs = (await prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take }))
      .map(normalizePartialScanLog);

    if (req.nextUrl.searchParams.get("format") === "txt") {
      const header = [
        "QuantWarden System Audit Log",
        `Scope: ${mode === "authentication" ? "Login and authentication activity" : "Organization activity"}`,
        `Generated: ${new Date().toISOString()}`,
        `Entries: ${logs.length}`,
        "",
      ].join("\n");
      return new NextResponse(`${header}${logs.map(logLine).join("\n")}\n`, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="quantwarden-audit-${mode}-${new Date().toISOString().slice(0, 10)}.log"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({ logs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin audit logs GET error:", error);
    return NextResponse.json({ error: "Could not load audit logs." }, { status: 500 });
  }
}
