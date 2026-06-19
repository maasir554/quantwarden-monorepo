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
