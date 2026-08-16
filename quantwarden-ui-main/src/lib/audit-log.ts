import { prisma } from "@/lib/prisma";

export const AUDIT_CATEGORIES = [
  "authentication",
  "organization",
  "scan",
  "team",
  "configuration",
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
export type AuditStatus = "success" | "failure";

type AuditRequest = Request | { headers: Headers } | null | undefined;

export type AuditEvent = {
  category: AuditCategory;
  action: string;
  message: string;
  status?: AuditStatus;
  actorUserId?: string | null;
  actorEmail?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  request?: AuditRequest;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type OrganizationAuditEvent = Omit<AuditEvent, "organizationId" | "organizationName"> & {
  organizationId: string;
};

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function getAuditRequestContext(request?: AuditRequest) {
  const headers = request?.headers;
  if (!headers) return { ipAddress: null, userAgent: null };
  return {
    ipAddress:
      firstForwardedValue(headers.get("x-forwarded-for")) ||
      headers.get("x-real-ip") ||
      headers.get("cf-connecting-ip") ||
      null,
    userAgent: headers.get("user-agent")?.slice(0, 500) || null,
  };
}

export async function writeAuditLog(event: AuditEvent) {
  try {
    const requestContext = getAuditRequestContext(event.request);
    const data = {
      category: event.category,
      action: event.action.slice(0, 120),
      status: event.status || "success",
      message: event.message.slice(0, 1000),
      actorUserId: event.actorUserId || null,
      actorEmail: event.actorEmail?.slice(0, 320) || null,
      organizationId: event.organizationId || null,
      organizationName: event.organizationName?.slice(0, 200) || null,
      targetType: event.targetType?.slice(0, 100) || null,
      targetId: event.targetId?.slice(0, 200) || null,
      dedupeKey: event.dedupeKey?.slice(0, 240) || null,
      ipAddress: event.ipAddress || requestContext.ipAddress,
      userAgent: event.userAgent || requestContext.userAgent,
      metadata: event.metadata,
    };
    if (data.dedupeKey) {
      await prisma.auditLog.upsert({ where: { dedupeKey: data.dedupeKey }, create: data, update: {} });
    } else {
      await prisma.auditLog.create({ data });
    }
  } catch (error) {
    // Audit logging must never break the user action it observes.
    console.error("Audit log write failed:", error);
  }
}

export async function writeOrganizationAuditLog(event: OrganizationAuditEvent) {
  const organization = await prisma.organization.findUnique({
    where: { id: event.organizationId },
    select: { name: true },
  }).catch(() => null);
  return writeAuditLog({
    ...event,
    organizationName: organization?.name || null,
  });
}
