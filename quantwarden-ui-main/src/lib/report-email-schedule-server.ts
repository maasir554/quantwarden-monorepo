import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { DEFAULT_REPORT_SECTIONS, type ReportSectionKey } from "@/lib/reporting";

export type ReportEmailFrequency = "daily" | "weekly" | "monthly";

export interface ReportEmailScheduleRecord {
  id: string;
  organizationId: string;
  title: string;
  heading: string;
  frequency: ReportEmailFrequency;
  interval: number;
  runAt: string;
  nextRunAt: string | null;
  recipients: string[];
  sections: Record<ReportSectionKey, boolean>;
  enabled: boolean;
  timezone: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

type ScheduleRow = {
  id: string;
  organizationId: string;
  title: string;
  heading: string;
  frequency: string;
  interval: number;
  runAt: Date;
  nextRunAt: Date | null;
  recipients: string;
  sections: string;
  enabled: boolean;
  timezone: string | null;
  lastRunAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PendingRun = {
  runId: string;
  scheduleId: string;
  organizationId: string;
  title: string;
  heading: string;
  recipients: string;
  sections: string;
  dueAt: Date;
  organizationName: string;
  organizationSlug: string;
};

const VALID_FREQUENCIES = new Set<ReportEmailFrequency>(["daily", "weekly", "monthly"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeSections(value: unknown) {
  const input = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return (Object.keys(DEFAULT_REPORT_SECTIONS) as ReportSectionKey[]).reduce<Record<ReportSectionKey, boolean>>(
    (result, key) => {
      result[key] = typeof input[key] === "boolean" ? Boolean(input[key]) : DEFAULT_REPORT_SECTIONS[key];
      return result;
    },
    { ...DEFAULT_REPORT_SECTIONS }
  );
}

function normalizeRecipients(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item).trim().toLowerCase()).filter((item) => EMAIL_PATTERN.test(item)))).slice(0, 50);
}

function normalizeInterval(value: unknown) {
  const parsed = Number(value || 1);
  return Math.min(365, Math.max(1, Number.isFinite(parsed) ? Math.trunc(parsed) : 1));
}

function parseRunAt(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) throw new Error("Choose a valid delivery time.");
  return date;
}

function addInterval(date: Date, frequency: ReportEmailFrequency, interval: number) {
  const next = new Date(date);
  if (frequency === "daily") next.setUTCDate(next.getUTCDate() + interval);
  if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + interval * 7);
  if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + interval);
  return next;
}

function nextOccurrence(runAt: Date, frequency: ReportEmailFrequency, interval: number, reference: Date) {
  let cursor = new Date(runAt);
  let guard = 0;
  while (cursor <= reference && guard < 4096) {
    cursor = addInterval(cursor, frequency, interval);
    guard += 1;
  }
  if (guard >= 4096) throw new Error("Could not calculate the next email delivery.");
  return cursor;
}

function toRecord(row: ScheduleRow): ReportEmailScheduleRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    heading: row.heading,
    frequency: VALID_FREQUENCIES.has(row.frequency as ReportEmailFrequency) ? row.frequency as ReportEmailFrequency : "weekly",
    interval: row.interval,
    runAt: row.runAt.toISOString(),
    nextRunAt: row.nextRunAt?.toISOString() || null,
    recipients: parseJson<string[]>(row.recipients, []),
    sections: normalizeSections(parseJson(row.sections, DEFAULT_REPORT_SECTIONS)),
    enabled: row.enabled,
    timezone: row.timezone,
    lastRunAt: row.lastRunAt?.toISOString() || null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function ensureReportEmailSchedulingTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "org_report_email_schedule" (
      id TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
      "createdByUserId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      heading TEXT NOT NULL,
      frequency TEXT NOT NULL,
      interval INTEGER NOT NULL DEFAULT 1,
      "runAt" TIMESTAMPTZ NOT NULL,
      "nextRunAt" TIMESTAMPTZ,
      recipients TEXT NOT NULL DEFAULT '[]',
      sections TEXT NOT NULL DEFAULT '{}',
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      timezone TEXT,
      "lastRunAt" TIMESTAMPTZ,
      "lastError" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "org_report_email_run" (
      id TEXT PRIMARY KEY,
      "scheduleId" TEXT NOT NULL REFERENCES "org_report_email_schedule"(id) ON DELETE CASCADE,
      "organizationId" TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      "dueAt" TIMESTAMPTZ NOT NULL,
      error TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "startedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "org_report_email_run_schedule_due_idx"
      ON "org_report_email_run" ("scheduleId", "dueAt");
    CREATE INDEX IF NOT EXISTS "org_report_email_schedule_due_idx"
      ON "org_report_email_schedule" (enabled, "nextRunAt");
    CREATE INDEX IF NOT EXISTS "org_report_email_run_status_idx"
      ON "org_report_email_run" (status, "dueAt");
  `);
}

export async function listReportEmailSchedules(organizationId: string) {
  await ensureReportEmailSchedulingTables();
  const rows = await prisma.$queryRawUnsafe<ScheduleRow[]>(
    `SELECT id, "organizationId" as "organizationId", title, heading, frequency, interval,
            "runAt" as "runAt", "nextRunAt" as "nextRunAt", recipients, sections, enabled,
            timezone, "lastRunAt" as "lastRunAt", "lastError" as "lastError",
            "createdAt" as "createdAt", "updatedAt" as "updatedAt"
       FROM "org_report_email_schedule"
      WHERE "organizationId" = $1
      ORDER BY "createdAt" ASC`,
    organizationId
  );
  return rows.map(toRecord);
}

export async function createReportEmailSchedule(input: {
  organizationId: string;
  createdByUserId: string;
  title: unknown;
  heading: unknown;
  frequency: unknown;
  interval: unknown;
  runAt: unknown;
  recipients: unknown;
  sections: unknown;
  enabled: unknown;
  timezone: unknown;
}) {
  await ensureReportEmailSchedulingTables();
  const frequency = VALID_FREQUENCIES.has(input.frequency as ReportEmailFrequency) ? input.frequency as ReportEmailFrequency : null;
  if (!frequency) throw new Error("Choose a supported email frequency.");
  const interval = normalizeInterval(input.interval);
  const runAt = parseRunAt(input.runAt);
  const recipients = normalizeRecipients(input.recipients);
  const enabled = input.enabled === true;
  if (enabled && recipients.length === 0) throw new Error("Add at least one valid recipient before enabling email delivery.");
  const sections = normalizeSections(input.sections);
  if (enabled && !Object.values(sections).some(Boolean)) throw new Error("Select at least one PDF section before enabling email delivery.");
  const title = String(input.title || "Scheduled security report").trim().slice(0, 120);
  const heading = String(input.heading || title).trim().slice(0, 140);
  const now = new Date();
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "org_report_email_schedule"
      (id, "organizationId", "createdByUserId", title, heading, frequency, interval, "runAt", "nextRunAt", recipients, sections, enabled, timezone, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
    id, input.organizationId, input.createdByUserId, title, heading, frequency, interval, runAt,
    enabled ? nextOccurrence(runAt, frequency, interval, new Date(now.getTime() - 1000)) : null,
    JSON.stringify(recipients), JSON.stringify(sections), enabled,
    typeof input.timezone === "string" ? input.timezone.slice(0, 100) : null, now
  );
  return (await listReportEmailSchedules(input.organizationId)).find((item) => item.id === id) || null;
}

export async function updateReportEmailSchedule(input: {
  scheduleId: string;
  organizationId: string;
  title?: unknown;
  heading?: unknown;
  frequency?: unknown;
  interval?: unknown;
  runAt?: unknown;
  recipients?: unknown;
  sections?: unknown;
  enabled?: unknown;
  timezone?: unknown;
}) {
  const current = (await listReportEmailSchedules(input.organizationId)).find((item) => item.id === input.scheduleId);
  if (!current) throw new Error("Email schedule not found.");
  const frequency = input.frequency === undefined ? current.frequency : input.frequency as ReportEmailFrequency;
  if (!VALID_FREQUENCIES.has(frequency)) throw new Error("Choose a supported email frequency.");
  const interval = input.interval === undefined ? current.interval : normalizeInterval(input.interval);
  const runAt = input.runAt === undefined ? new Date(current.runAt) : parseRunAt(input.runAt);
  const recipients = input.recipients === undefined ? current.recipients : normalizeRecipients(input.recipients);
  const enabled = input.enabled === undefined ? current.enabled : input.enabled === true;
  if (enabled && recipients.length === 0) throw new Error("Add at least one valid recipient before enabling email delivery.");
  const sections = input.sections === undefined ? current.sections : normalizeSections(input.sections);
  if (enabled && !Object.values(sections).some(Boolean)) throw new Error("Select at least one PDF section before enabling email delivery.");
  const now = new Date();
  const scheduleChanged = input.frequency !== undefined || input.interval !== undefined || input.runAt !== undefined;
  const nextRunAt = enabled
    ? (!current.enabled || scheduleChanged
        ? nextOccurrence(runAt, frequency, interval, new Date(now.getTime() - 1000))
        : current.nextRunAt ? new Date(current.nextRunAt) : nextOccurrence(runAt, frequency, interval, now))
    : null;
  await prisma.$executeRawUnsafe(
    `UPDATE "org_report_email_schedule"
        SET title=$3, heading=$4, frequency=$5, interval=$6, "runAt"=$7, "nextRunAt"=$8,
            recipients=$9, sections=$10, enabled=$11, timezone=$12, "updatedAt"=$13
      WHERE id=$1 AND "organizationId"=$2`,
    input.scheduleId, input.organizationId,
    String(input.title ?? current.title).trim().slice(0, 120),
    String(input.heading ?? current.heading).trim().slice(0, 140),
    frequency, interval, runAt, nextRunAt, JSON.stringify(recipients),
    JSON.stringify(sections), enabled,
    input.timezone === undefined ? current.timezone : String(input.timezone || "").slice(0, 100), now
  );
  return (await listReportEmailSchedules(input.organizationId)).find((item) => item.id === input.scheduleId) || null;
}

export async function deleteReportEmailSchedule(scheduleId: string, organizationId: string) {
  await ensureReportEmailSchedulingTables();
  return (await prisma.$executeRawUnsafe(
    `DELETE FROM "org_report_email_schedule" WHERE id=$1 AND "organizationId"=$2`,
    scheduleId, organizationId
  )) > 0;
}

async function enqueueDueReportEmails(now: Date) {
  await ensureReportEmailSchedulingTables();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, "org-report-email-schedule");
    const rows = await tx.$queryRawUnsafe<ScheduleRow[]>(
      `SELECT id, "organizationId" as "organizationId", title, heading, frequency, interval,
              "runAt" as "runAt", "nextRunAt" as "nextRunAt", recipients, sections, enabled,
              timezone, "lastRunAt" as "lastRunAt", "lastError" as "lastError",
              "createdAt" as "createdAt", "updatedAt" as "updatedAt"
         FROM "org_report_email_schedule"
        WHERE enabled=TRUE AND "nextRunAt" IS NOT NULL AND "nextRunAt" <= $1
        ORDER BY "nextRunAt" ASC LIMIT 25`,
      now
    );
    for (const row of rows) {
      if (!row.nextRunAt) continue;
      await tx.$executeRawUnsafe(
        `INSERT INTO "org_report_email_run" (id,"scheduleId","organizationId",status,"dueAt","createdAt")
         VALUES ($1,$2,$3,'pending',$4,$5) ON CONFLICT ("scheduleId","dueAt") DO NOTHING`,
        crypto.randomUUID(), row.id, row.organizationId, row.nextRunAt, now
      );
      await tx.$executeRawUnsafe(
        `UPDATE "org_report_email_schedule" SET "nextRunAt"=$2,"updatedAt"=$3 WHERE id=$1`,
        row.id, nextOccurrence(row.runAt, row.frequency as ReportEmailFrequency, row.interval, row.nextRunAt), now
      );
    }
  });
}

async function claimPendingReportEmails(limit = 5) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<PendingRun[]>(
      `SELECT r.id as "runId", s.id as "scheduleId", s."organizationId" as "organizationId",
              s.title, s.heading, s.recipients, s.sections, r."dueAt" as "dueAt",
              o.name as "organizationName", o.slug as "organizationSlug"
         FROM "org_report_email_run" r
         JOIN "org_report_email_schedule" s ON s.id=r."scheduleId"
         JOIN "organization" o ON o.id=s."organizationId"
        WHERE r.status='pending' AND s.enabled=TRUE
        ORDER BY r."dueAt" ASC LIMIT $1
        FOR UPDATE OF r SKIP LOCKED`,
      limit
    );
    for (const row of rows) {
      await tx.$executeRawUnsafe(
        `UPDATE "org_report_email_run" SET status='running',"startedAt"=NOW() WHERE id=$1`,
        row.runId
      );
    }
    return rows;
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char);
}

async function deliverReportEmail(run: PendingRun) {
  const recipients = parseJson<string[]>(run.recipients, []);
  if (recipients.length === 0) throw new Error("No recipients are configured.");
  const internalUrl = (process.env.REPORTING_INTERNAL_URL || "http://quantwarden-ui:3000").replace(/\/$/, "");
  const secret = process.env.SCAN_WORKER_WAKE_SECRET || "";
  if (!secret) throw new Error("Internal reporting authentication is not configured.");
  const sections = normalizeSections(parseJson(run.sections, DEFAULT_REPORT_SECTIONS));
  const response = await fetch(`${internalUrl}/api/orgs/reporting`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ orgId: run.organizationId, heading: run.heading, sections }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(detail?.error || `Report generation failed with HTTP ${response.status}.`);
  }
  const pdf = Buffer.from(await response.arrayBuffer());
  const date = new Date().toISOString().slice(0, 10);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "").replace(/\/$/, "");
  const reportLink = appUrl ? `${appUrl}/app/${encodeURIComponent(run.organizationSlug)}/reporting` : "";
  await sendEmail({
    to: recipients.join(", "),
    subject: `${run.organizationName}: ${run.title}`,
    html: `<div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><h2 style="margin:0 0 12px;color:#8B0000">${escapeHtml(run.heading)}</h2><p>Your scheduled QuantWarden security posture report is attached.</p>${reportLink ? `<p><a href="${escapeHtml(reportLink)}" style="color:#8B0000">Open reporting dashboard</a></p>` : ""}<p style="font-size:12px;color:#64748b">Generated automatically on ${date}.</p></div>`,
    attachments: [{ filename: `${run.organizationSlug}-security-posture-${date}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
}

export async function runReportEmailMaintenanceCycle(now = new Date()) {
  await enqueueDueReportEmails(now);
  const runs = await claimPendingReportEmails();
  for (const run of runs) {
    try {
      await deliverReportEmail(run);
      await prisma.$executeRawUnsafe(
        `UPDATE "org_report_email_run" SET status='completed',"completedAt"=NOW() WHERE id=$1`,
        run.runId
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "org_report_email_schedule" SET "lastRunAt"=NOW(),"lastError"=NULL,"updatedAt"=NOW() WHERE id=$1`,
        run.scheduleId
      );
    } catch (error: any) {
      const message = String(error?.message || error || "Email delivery failed.").slice(0, 1000);
      await prisma.$executeRawUnsafe(
        `UPDATE "org_report_email_run" SET status='failed',error=$2,"completedAt"=NOW() WHERE id=$1`,
        run.runId, message
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "org_report_email_schedule" SET "lastRunAt"=NOW(),"lastError"=$2,"updatedAt"=NOW() WHERE id=$1`,
        run.scheduleId, message
      );
    }
  }
}
