import { prisma } from "@/lib/prisma";
import { createScanBatch, isCreateScanBatchFailure } from "@/lib/scan-batch-create";
import { getEnabledPortList, normalizePortDiscoveryConfig } from "@/lib/port-discovery";
import type { ScanBatchType, ScanBatchStatus, ScanEngine } from "@/lib/scan-activity-types";

export type ScanScheduleMode = "one_time" | "recurring";
export type ScanScheduleFrequency = "hourly" | "daily" | "weekly";
export type ScanScheduleRunStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

export interface ScanScheduleRecord {
  id: string;
  organizationId: string;
  createdByUserId: string;
  createdByName: string | null;
  createdByEmail: string | null;
  engine: ScanEngine;
  type: ScanBatchType;
  mode: ScanScheduleMode;
  frequency: ScanScheduleFrequency | null;
  interval: number | null;
  runAt: string;
  nextRunAt: string | null;
  assetIds: string[];
  configSnapshot: unknown;
  enabled: boolean;
  timezone: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScanScheduleRunRecord {
  id: string;
  scheduleId: string;
  organizationId: string;
  scheduleType: ScanBatchType;
  scheduleEngine: ScanEngine;
  status: ScanScheduleRunStatus;
  dueAt: string;
  queuedBatchId: string | null;
  batchStatus: ScanBatchStatus | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateScanScheduleInput {
  organizationId: string;
  createdByUserId: string;
  engine?: ScanEngine;
  type: ScanBatchType;
  mode: ScanScheduleMode;
  runAt: string;
  frequency?: ScanScheduleFrequency | null;
  interval?: number | null;
  assetIds: string[];
  configSnapshot?: unknown;
  timezone?: string | null;
}

export interface UpdateScanScheduleInput {
  scheduleId: string;
  organizationId: string;
  enabled?: boolean;
  engine?: ScanEngine;
  type?: ScanBatchType;
  mode?: ScanScheduleMode;
  runAt?: string;
  frequency?: ScanScheduleFrequency | null;
  interval?: number | null;
  assetIds?: string[];
  configSnapshot?: unknown;
  timezone?: string | null;
}

type ScheduleRow = {
  id: string;
  organizationId: string;
  createdByUserId: string;
  createdByName: string | null;
  createdByEmail: string | null;
  engine: string;
  type: string;
  mode: string;
  frequency: string | null;
  interval: number | null;
  runAt: Date;
  nextRunAt: Date | null;
  assetIds: string;
  configSnapshot: string | null;
  enabled: boolean;
  timezone: string | null;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ScheduleRunRow = {
  id: string;
  scheduleId: string;
  organizationId: string;
  scheduleType: string;
  scheduleEngine: string;
  status: string;
  dueAt: Date;
  queuedBatchId: string | null;
  batchStatus: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

const VALID_TYPES = new Set<ScanBatchType>(["single", "group", "full"]);
const VALID_ENGINES = new Set<ScanEngine>(["openssl", "portDiscovery"]);
const VALID_MODES = new Set<ScanScheduleMode>(["one_time", "recurring"]);
const VALID_FREQUENCIES = new Set<ScanScheduleFrequency>(["hourly", "daily", "weekly"]);

function addInterval(date: Date, frequency: ScanScheduleFrequency, interval: number) {
  const next = new Date(date);
  if (frequency === "hourly") {
    next.setUTCHours(next.getUTCHours() + interval);
    return next;
  }
  if (frequency === "daily") {
    next.setUTCDate(next.getUTCDate() + interval);
    return next;
  }

  next.setUTCDate(next.getUTCDate() + interval * 7);
  return next;
}

function parseDateOrThrow(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid runAt timestamp.");
  }
  return date;
}

function normalizeInterval(value: number | null | undefined) {
  const parsed = Number(value ?? 1);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(52, Math.max(1, Math.trunc(parsed)));
}

function parseStoredJson<T>(value: string | null, fallback: T) {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function scheduleToRecord(row: ScheduleRow): ScanScheduleRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    createdByEmail: row.createdByEmail,
    engine: (VALID_ENGINES.has(row.engine as ScanEngine) ? row.engine : "openssl") as ScanEngine,
    type: (VALID_TYPES.has(row.type as ScanBatchType) ? row.type : "full") as ScanBatchType,
    mode: (VALID_MODES.has(row.mode as ScanScheduleMode) ? row.mode : "one_time") as ScanScheduleMode,
    frequency: VALID_FREQUENCIES.has(row.frequency as ScanScheduleFrequency)
      ? (row.frequency as ScanScheduleFrequency)
      : null,
    interval: row.interval ?? null,
    runAt: row.runAt.toISOString(),
    nextRunAt: row.nextRunAt ? row.nextRunAt.toISOString() : null,
    assetIds: parseStoredJson<string[]>(row.assetIds, []),
    configSnapshot: parseStoredJson<unknown>(row.configSnapshot, null),
    enabled: row.enabled,
    timezone: row.timezone,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function runToRecord(row: ScheduleRunRow): ScanScheduleRunRecord {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    organizationId: row.organizationId,
    scheduleType: (VALID_TYPES.has(row.scheduleType as ScanBatchType) ? row.scheduleType : "full") as ScanBatchType,
    scheduleEngine: (VALID_ENGINES.has(row.scheduleEngine as ScanEngine) ? row.scheduleEngine : "openssl") as ScanEngine,
    status: row.status as ScanScheduleRunStatus,
    dueAt: row.dueAt.toISOString(),
    queuedBatchId: row.queuedBatchId,
    batchStatus: row.batchStatus as ScanBatchStatus | null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

function computeNextRunAt(
  mode: ScanScheduleMode,
  runAt: Date,
  frequency: ScanScheduleFrequency | null,
  interval: number | null,
  reference: Date
) {
  if (mode === "one_time") {
    return runAt > reference ? runAt : null;
  }

  if (!frequency) {
    throw new Error("Recurring schedules require a frequency.");
  }

  const normalizedInterval = normalizeInterval(interval);
  let cursor = new Date(runAt);
  const maxIterations = 4096;
  let iterations = 0;

  while (cursor <= reference && iterations < maxIterations) {
    cursor = addInterval(cursor, frequency, normalizedInterval);
    iterations += 1;
  }

  if (iterations >= maxIterations) {
    throw new Error("Could not compute the next recurring run.");
  }

  return cursor;
}

function validateCommonInput(input: {
  engine?: ScanEngine;
  type: ScanBatchType;
  mode: ScanScheduleMode;
  frequency?: ScanScheduleFrequency | null;
  interval?: number | null;
  assetIds: string[];
  runAt: string;
  configSnapshot?: unknown;
}) {
  const engine = input.engine && VALID_ENGINES.has(input.engine) ? input.engine : "openssl";
  if (!VALID_TYPES.has(input.type)) {
    throw new Error("Invalid scan batch type.");
  }
  if (!VALID_MODES.has(input.mode)) {
    throw new Error("Invalid schedule mode.");
  }

  const assetIds = Array.from(new Set(input.assetIds.filter(Boolean)));
  if (assetIds.length === 0) {
    throw new Error("At least one asset is required.");
  }
  if (input.type === "single" && assetIds.length !== 1) {
    throw new Error("Single schedules require exactly one asset.");
  }
  if (input.type === "group" && assetIds.length < 2) {
    throw new Error("Group schedules require at least two assets.");
  }

  const runAt = parseDateOrThrow(input.runAt);

  // Reject scheduling in the past (with 2-minute grace window for clock skew)
  if (input.mode === "one_time" && runAt.getTime() < Date.now() - 120_000) {
    throw new Error("Cannot schedule a one-time scan in the past.");
  }
  const frequency =
    input.mode === "recurring" && input.frequency && VALID_FREQUENCIES.has(input.frequency)
      ? input.frequency
      : null;

  if (input.mode === "recurring" && !frequency) {
    throw new Error("Recurring schedules require a supported frequency.");
  }

  const interval = input.mode === "recurring" ? normalizeInterval(input.interval) : null;
  const configSnapshot = engine === "portDiscovery"
    ? normalizePortDiscoveryConfig(input.configSnapshot)
    : null;

  if (engine === "portDiscovery" && configSnapshot && getEnabledPortList(configSnapshot.entries).length === 0) {
    throw new Error("Select at least one enabled port before scheduling port discovery.");
  }

  return {
    engine,
    type: input.type,
    mode: input.mode,
    frequency,
    interval,
    assetIds,
    runAt,
    configSnapshot,
  };
}

export async function ensureScanSchedulingTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "org_scan_schedule" (
      id TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
      "createdByUserId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      engine TEXT NOT NULL,
      type TEXT NOT NULL,
      mode TEXT NOT NULL,
      frequency TEXT,
      interval INTEGER,
      "runAt" TIMESTAMPTZ NOT NULL,
      "nextRunAt" TIMESTAMPTZ,
      "assetIds" TEXT NOT NULL,
      "configSnapshot" TEXT,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      timezone TEXT,
      "lastRunAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "org_scan_schedule_run" (
      id TEXT PRIMARY KEY,
      "scheduleId" TEXT NOT NULL REFERENCES "org_scan_schedule"(id) ON DELETE CASCADE,
      "organizationId" TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      "dueAt" TIMESTAMPTZ NOT NULL,
      "queuedBatchId" TEXT REFERENCES "asset_scan_batch"(id) ON DELETE SET NULL,
      error TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "startedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS "org_scan_schedule_org_enabled_next_idx"
      ON "org_scan_schedule" ("organizationId", enabled, "nextRunAt");
    CREATE INDEX IF NOT EXISTS "org_scan_schedule_creator_idx"
      ON "org_scan_schedule" ("createdByUserId");
    CREATE INDEX IF NOT EXISTS "org_scan_schedule_run_org_status_due_idx"
      ON "org_scan_schedule_run" ("organizationId", status, "dueAt");
    CREATE INDEX IF NOT EXISTS "org_scan_schedule_run_schedule_due_idx"
      ON "org_scan_schedule_run" ("scheduleId", "dueAt");
    CREATE UNIQUE INDEX IF NOT EXISTS "org_scan_schedule_run_schedule_due_unique_idx"
      ON "org_scan_schedule_run" ("scheduleId", "dueAt");
  `);

  // Add source column to asset_scan_batch if it doesn't exist yet.
  // This is idempotent and safe across all environments.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "asset_scan_batch"
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  `);
}

export async function listScanSchedulesForOrganization(organizationId: string) {
  await ensureScanSchedulingTables();

  const rows = await prisma.$queryRawUnsafe<ScheduleRow[]>(
    `SELECT
        s.id,
        s."organizationId" as "organizationId",
        s."createdByUserId" as "createdByUserId",
        u.name as "createdByName",
        u.email as "createdByEmail",
        s.engine,
        s.type,
        s.mode,
        s.frequency,
        s.interval,
        s."runAt" as "runAt",
        s."nextRunAt" as "nextRunAt",
        s."assetIds" as "assetIds",
        s."configSnapshot" as "configSnapshot",
        s.enabled,
        s.timezone,
        s."lastRunAt" as "lastRunAt",
        s."createdAt" as "createdAt",
        s."updatedAt" as "updatedAt"
      FROM "org_scan_schedule" s
      INNER JOIN "user" u ON u.id = s."createdByUserId"
      WHERE s."organizationId" = $1
      ORDER BY s.enabled DESC, COALESCE(s."nextRunAt", s."runAt") ASC, s."createdAt" DESC`,
    organizationId
  );

  return rows.map(scheduleToRecord);
}

export async function listScanScheduleRunsForOrganization(organizationId: string, limit = 25) {
  await ensureScanSchedulingTables();

  const rows = await prisma.$queryRawUnsafe<ScheduleRunRow[]>(
    `SELECT
        r.id,
        r."scheduleId" as "scheduleId",
        r."organizationId" as "organizationId",
        s.type as "scheduleType",
        s.engine as "scheduleEngine",
        r.status,
        r."dueAt" as "dueAt",
        r."queuedBatchId" as "queuedBatchId",
        b.status as "batchStatus",
        r.error,
        r."createdAt" as "createdAt",
        r."startedAt" as "startedAt",
        r."completedAt" as "completedAt"
      FROM "org_scan_schedule_run" r
      INNER JOIN "org_scan_schedule" s ON s.id = r."scheduleId"
      LEFT JOIN "asset_scan_batch" b ON b.id = r."queuedBatchId"
      WHERE r."organizationId" = $1
      ORDER BY r."dueAt" DESC, r."createdAt" DESC
      LIMIT $2`,
    organizationId,
    limit
  );

  return rows.map(runToRecord);
}

export async function createScanSchedule(input: CreateScanScheduleInput) {
  await ensureScanSchedulingTables();

  const normalized = validateCommonInput(input);
  const now = new Date();
  const nextRunAt = computeNextRunAt(
    normalized.mode,
    normalized.runAt,
    normalized.frequency,
    normalized.interval,
    new Date(now.getTime() - 1000)
  );

  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "org_scan_schedule"
      (id, "organizationId", "createdByUserId", engine, type, mode, frequency, interval, "runAt", "nextRunAt", "assetIds", "configSnapshot", enabled, timezone, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, $13, $14, $14)`,
    id,
    input.organizationId,
    input.createdByUserId,
    normalized.engine,
    normalized.type,
    normalized.mode,
    normalized.frequency,
    normalized.interval,
    normalized.runAt,
    nextRunAt,
    JSON.stringify(normalized.assetIds),
    normalized.configSnapshot ? JSON.stringify(normalized.configSnapshot) : null,
    input.timezone || null,
    now
  );

  const schedules = await listScanSchedulesForOrganization(input.organizationId);
  return schedules.find((schedule) => schedule.id === id) || null;
}

export async function updateScanSchedule(input: UpdateScanScheduleInput) {
  await ensureScanSchedulingTables();

  const currentRows = await prisma.$queryRawUnsafe<ScheduleRow[]>(
    `SELECT
        s.id,
        s."organizationId" as "organizationId",
        s."createdByUserId" as "createdByUserId",
        NULL::text as "createdByName",
        NULL::text as "createdByEmail",
        s.engine,
        s.type,
        s.mode,
        s.frequency,
        s.interval,
        s."runAt" as "runAt",
        s."nextRunAt" as "nextRunAt",
        s."assetIds" as "assetIds",
        s."configSnapshot" as "configSnapshot",
        s.enabled,
        s.timezone,
        s."lastRunAt" as "lastRunAt",
        s."createdAt" as "createdAt",
        s."updatedAt" as "updatedAt"
      FROM "org_scan_schedule" s
      WHERE s.id = $1
        AND s."organizationId" = $2
      LIMIT 1`,
    input.scheduleId,
    input.organizationId
  );

  const current = currentRows[0];
  if (!current) {
    throw new Error("Schedule not found.");
  }

  const normalized = validateCommonInput({
    engine: input.engine ?? (current.engine as ScanEngine),
    type: input.type ?? (current.type as ScanBatchType),
    mode: input.mode ?? (current.mode as ScanScheduleMode),
    runAt: input.runAt ?? current.runAt.toISOString(),
    frequency:
      input.frequency !== undefined
        ? input.frequency
        : (current.frequency as ScanScheduleFrequency | null),
    interval: input.interval !== undefined ? input.interval : current.interval,
    assetIds: input.assetIds ?? parseStoredJson<string[]>(current.assetIds, []),
    configSnapshot:
      input.configSnapshot !== undefined
        ? input.configSnapshot
        : parseStoredJson<unknown>(current.configSnapshot, null),
  });

  const enabled = input.enabled ?? current.enabled;
  const now = new Date();
  const reference = current.lastRunAt ?? new Date(now.getTime() - 1000);
  const nextRunAt = enabled
    ? computeNextRunAt(normalized.mode, normalized.runAt, normalized.frequency, normalized.interval, reference)
    : null;

  await prisma.$executeRawUnsafe(
    `UPDATE "org_scan_schedule"
     SET engine = $3,
         type = $4,
         mode = $5,
         frequency = $6,
         interval = $7,
         "runAt" = $8,
         "nextRunAt" = $9,
         "assetIds" = $10,
         "configSnapshot" = $11,
         enabled = $12,
         timezone = $13,
         "updatedAt" = $14
     WHERE id = $1
       AND "organizationId" = $2`,
    input.scheduleId,
    input.organizationId,
    normalized.engine,
    normalized.type,
    normalized.mode,
    normalized.frequency,
    normalized.interval,
    normalized.runAt,
    nextRunAt,
    JSON.stringify(normalized.assetIds),
    normalized.configSnapshot ? JSON.stringify(normalized.configSnapshot) : null,
    enabled,
    input.timezone !== undefined ? input.timezone : current.timezone,
    now
  );

  const schedules = await listScanSchedulesForOrganization(input.organizationId);
  return schedules.find((schedule) => schedule.id === input.scheduleId) || null;
}

export async function deleteScanSchedule(scheduleId: string, organizationId: string) {
  await ensureScanSchedulingTables();

  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM "org_scan_schedule"
     WHERE id = $1
       AND "organizationId" = $2`,
    scheduleId,
    organizationId
  );

  return result > 0;
}

export async function cancelPendingScheduleRun(runId: string, organizationId: string) {
  await ensureScanSchedulingTables();

  const now = new Date();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "org_scan_schedule_run"
     SET status = 'cancelled',
         error = COALESCE(error, 'Scheduled scan cancelled by user.'),
         "completedAt" = COALESCE("completedAt", $3)
     WHERE id = $1
       AND "organizationId" = $2
       AND status = 'pending'
     RETURNING id`,
    runId,
    organizationId,
    now
  );

  return rows[0] ?? null;
}

export async function enqueueDueScheduleRuns(now = new Date()) {
  await ensureScanSchedulingTables();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, "org-scan-schedule");

    const dueRows = await tx.$queryRawUnsafe<ScheduleRow[]>(
      `SELECT
          s.id,
          s."organizationId" as "organizationId",
          s."createdByUserId" as "createdByUserId",
          NULL::text as "createdByName",
          NULL::text as "createdByEmail",
          s.engine,
          s.type,
          s.mode,
          s.frequency,
          s.interval,
          s."runAt" as "runAt",
          s."nextRunAt" as "nextRunAt",
          s."assetIds" as "assetIds",
          s."configSnapshot" as "configSnapshot",
          s.enabled,
          s.timezone,
          s."lastRunAt" as "lastRunAt",
          s."createdAt" as "createdAt",
          s."updatedAt" as "updatedAt"
       FROM "org_scan_schedule" s
       WHERE s.enabled = TRUE
         AND s."nextRunAt" IS NOT NULL
         AND s."nextRunAt" <= $1
         AND NOT EXISTS (
           SELECT 1
           FROM "org_scan_schedule_run" r
           WHERE r."scheduleId" = s.id
             AND r.status IN ('pending', 'queued', 'running')
         )
       ORDER BY s."nextRunAt" ASC
       LIMIT 50`,
      now
    );

    for (const schedule of dueRows) {
      if (!schedule.nextRunAt) continue;

      const dueAt = new Date(schedule.nextRunAt);
      const nextRunAt =
        schedule.mode === "one_time"
          ? null
          : computeNextRunAt(
              schedule.mode as ScanScheduleMode,
              schedule.runAt,
              schedule.frequency as ScanScheduleFrequency | null,
              schedule.interval,
              now
            );

      await tx.$executeRawUnsafe(
        `INSERT INTO "org_scan_schedule_run"
          (id, "scheduleId", "organizationId", status, "dueAt", "createdAt")
         VALUES ($1, $2, $3, 'pending', $4, $5)
         ON CONFLICT ("scheduleId", "dueAt") DO NOTHING`,
        crypto.randomUUID(),
        schedule.id,
        schedule.organizationId,
        dueAt,
        now
      );

      await tx.$executeRawUnsafe(
        `UPDATE "org_scan_schedule"
         SET "lastRunAt" = $2,
             "nextRunAt" = $3,
             enabled = $4,
             "updatedAt" = $5
         WHERE id = $1`,
        schedule.id,
        dueAt,
        nextRunAt,
        Boolean(nextRunAt),
        now
      );
    }
  });
}

export async function materializePendingScheduleRuns(limit = 10) {
  await ensureScanSchedulingTables();

  const pendingRuns = await prisma.$queryRawUnsafe<Array<{
    runId: string;
    scheduleId: string;
    organizationId: string;
    createdByUserId: string;
    engine: string;
    type: string;
    assetIds: string;
    configSnapshot: string | null;
  }>>(
    `SELECT
        r.id as "runId",
        s.id as "scheduleId",
        s."organizationId" as "organizationId",
        s."createdByUserId" as "createdByUserId",
        s.engine,
        s.type,
        s."assetIds" as "assetIds",
        s."configSnapshot" as "configSnapshot"
      FROM "org_scan_schedule_run" r
      INNER JOIN "org_scan_schedule" s ON s.id = r."scheduleId"
      WHERE r.status = 'pending'
      ORDER BY r."dueAt" ASC, r."createdAt" ASC
      LIMIT $1`,
    limit
  );

  for (const run of pendingRuns) {
    const batchResult = await createScanBatch({
      orgId: run.organizationId,
      initiatedByUserId: run.createdByUserId,
      engine: (VALID_ENGINES.has(run.engine as ScanEngine) ? run.engine : "openssl") as ScanEngine,
      type: (VALID_TYPES.has(run.type as ScanBatchType) ? run.type : "full") as ScanBatchType,
      assetIds: parseStoredJson<string[]>(run.assetIds, []),
      configSnapshot: parseStoredJson<unknown>(run.configSnapshot, null),
    });

    if (isCreateScanBatchFailure(batchResult)) {
      if (batchResult.status === 409) {
        continue;
      }

      await prisma.$executeRawUnsafe(
        `UPDATE "org_scan_schedule_run"
         SET status = 'failed',
             error = $2,
             "completedAt" = COALESCE("completedAt", $3)
         WHERE id = $1`,
        run.runId,
        batchResult.error,
        new Date()
      );
      continue;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "org_scan_schedule_run"
       SET status = 'queued',
           "queuedBatchId" = $2,
           "startedAt" = COALESCE("startedAt", $3)
       WHERE id = $1`,
      run.runId,
      batchResult.batchId,
      new Date()
    );
  }
}

export async function syncScheduleRunStatuses() {
  await ensureScanSchedulingTables();

  const rows = await prisma.$queryRawUnsafe<Array<{
    runId: string;
    batchStatus: string;
    batchStartedAt: Date | null;
    batchCompletedAt: Date | null;
  }>>(
    `SELECT
        r.id as "runId",
        b.status as "batchStatus",
        b."startedAt" as "batchStartedAt",
        b."completedAt" as "batchCompletedAt"
      FROM "org_scan_schedule_run" r
      INNER JOIN "asset_scan_batch" b ON b.id = r."queuedBatchId"
      WHERE r.status IN ('queued', 'running')
        AND r."queuedBatchId" IS NOT NULL`
  );

  for (const row of rows) {
    if (row.batchStatus === "queued") {
      continue;
    }

    if (row.batchStatus === "running") {
      await prisma.$executeRawUnsafe(
        `UPDATE "org_scan_schedule_run"
         SET status = 'running',
             "startedAt" = COALESCE("startedAt", $2)
         WHERE id = $1`,
        row.runId,
        row.batchStartedAt || new Date()
      );
      continue;
    }

    if (row.batchStatus === "completed" || row.batchStatus === "failed" || row.batchStatus === "cancelled") {
      await prisma.$executeRawUnsafe(
        `UPDATE "org_scan_schedule_run"
         SET status = $2,
             "startedAt" = COALESCE("startedAt", $3),
             "completedAt" = COALESCE("completedAt", $4)
         WHERE id = $1`,
        row.runId,
        row.batchStatus,
        row.batchStartedAt || new Date(),
        row.batchCompletedAt || new Date()
      );
    }
  }
}

export async function runSchedulerMaintenanceCycle(now = new Date()) {
  await enqueueDueScheduleRuns(now);
  await materializePendingScheduleRuns();
  await syncScheduleRunStatuses();
}
