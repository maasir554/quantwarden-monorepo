function parseIntEnv(name: string, fallback: number, bounds: { min: number; max: number }) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(bounds.max, Math.max(bounds.min, parsed));
}

export interface WorkerConfig {
  activeExecutorTickMs: number;
  activeSchedulerTickMs: number;
  idleExecutorTickMs: number;
  idleSchedulerTickMs: number;
  activeGraceMs: number;
  activeOrgQueryLimit: number;
  controlPort: number;
  healthPort: number;
  wakeSecret: string;
  subfinderUrl: string;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    activeExecutorTickMs: parseIntEnv("SCAN_WORKER_ACTIVE_EXECUTOR_TICK_MS", 1500, { min: 250, max: 60000 }),
    activeSchedulerTickMs: parseIntEnv("SCAN_WORKER_ACTIVE_SCHEDULER_TICK_MS", 10000, { min: 1000, max: 300000 }),
    idleExecutorTickMs: parseIntEnv("SCAN_WORKER_IDLE_EXECUTOR_TICK_MS", 1800000, { min: 5000, max: 3600000 }),
    idleSchedulerTickMs: parseIntEnv("SCAN_WORKER_IDLE_SCHEDULER_TICK_MS", 1800000, { min: 5000, max: 3600000 }),
    activeGraceMs: parseIntEnv("SCAN_WORKER_ACTIVE_GRACE_MS", 60000, { min: 1000, max: 900000 }),
    activeOrgQueryLimit: parseIntEnv("SCAN_WORKER_ACTIVE_ORG_LIMIT", 100, { min: 1, max: 1000 }),
    controlPort: parseIntEnv("SCAN_WORKER_PORT", 8088, { min: 1, max: 65535 }),
    healthPort: parseIntEnv("SCAN_WORKER_HEALTH_PORT", 8089, { min: 1, max: 65535 }),
    wakeSecret: process.env.SCAN_WORKER_WAKE_SECRET || "",
    subfinderUrl: process.env.SUBFINDER_API_URL || "http://127.0.0.1:8085",
  };
}
