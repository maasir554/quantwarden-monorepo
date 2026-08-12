"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  FileCheck,
  FileText,
  Loader2,
  Mail,
  Plus,
  Repeat,
  Save,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_REPORT_SECTIONS, REPORT_SECTION_META, type ReportSectionKey } from "@/lib/reporting";
import ReportingPdfBuilder from "./ReportingPdfBuilder";

interface OrgReportingProps {
  org: { id: string; name: string; slug: string };
  canConfigure: boolean;
}

type TabKey = "sharePdf" | "periodicScans" | "scheduleScan" | "autoEmails";
type Frequency = "daily" | "every-3-days" | "every-4-days" | "weekly" | "monthly";
type ScanEngine = "portDiscovery" | "openssl";

type ScanSchedule = {
  id: string;
  engine: ScanEngine;
  mode: "one_time" | "recurring";
  frequency: "daily" | "weekly" | "monthly" | null;
  interval: number | null;
  runAt: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  enabled: boolean;
  timezone: string | null;
};

type EmailSchedule = {
  id: string;
  title: string;
  heading: string;
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  runAt: string;
  nextRunAt: string | null;
  recipients: string[];
  sections: Record<ReportSectionKey, boolean>;
  enabled: boolean;
  timezone: string | null;
  lastRunAt: string | null;
  lastError: string | null;
};

type EmailDraft = Omit<EmailSchedule, "id"> & { id?: string };

const tabs: Array<{ key: TabKey; label: string; icon: typeof FileText }> = [
  { key: "sharePdf", label: "Share PDF", icon: FileText },
  { key: "periodicScans", label: "Periodic Scans", icon: Repeat },
  { key: "scheduleScan", label: "Schedule Scan", icon: CalendarClock },
  { key: "autoEmails", label: "Auto Emails", icon: Mail },
];

const frequencyOptions: Array<{ value: Frequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "every-3-days", label: "Every 3 days" },
  { value: "every-4-days", label: "Every 4 days" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const inputClass = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
const buttonPrimary = "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B0000] px-4 text-sm font-semibold text-white transition hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-50";
const buttonSecondary = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function frequencyToApi(value: Frequency) {
  if (value === "every-3-days") return { frequency: "daily", interval: 3 } as const;
  if (value === "every-4-days") return { frequency: "daily", interval: 4 } as const;
  return { frequency: value, interval: 1 } as const;
}

function frequencyFromApi(frequency: string | null, interval: number | null): Frequency {
  if (frequency === "daily" && interval === 3) return "every-3-days";
  if (frequency === "daily" && interval === 4) return "every-4-days";
  if (frequency === "monthly") return "monthly";
  if (frequency === "daily") return "daily";
  return "weekly";
}

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function localTimeValue(value: string | Date | null | undefined, fallback = "09:00") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function toIso(date: string, time: string) {
  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) throw new Error("Choose a valid date and time.");
  return value.toISOString();
}

function recurringAnchor(time: string) {
  const now = new Date();
  const candidate = new Date(`${localDateValue(now)}T${time}:00`);
  if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
  return candidate.toISOString();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {helper ? <span className="text-xs text-slate-500">{helper}</span> : null}
    </label>
  );
}

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("inline-flex h-6 w-11 items-center rounded-full p-1 transition", checked ? "bg-[#8B0000]" : "bg-slate-300", disabled && "opacity-50")}
    >
      <span className={cn("h-4 w-4 rounded-full bg-white shadow-sm transition", checked && "translate-x-5")} />
    </button>
  );
}

function EngineChoice({ title, helper, checked, onChange, disabled }: { title: string; helper: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={`${title} ${checked ? "enabled" : "disabled"}`} />
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function parsePortList(value: string) {
  return Array.from(new Set(value.split(/[\s,]+/).map(Number).filter((port) => Number.isInteger(port) && port >= 1 && port <= 65535)));
}

function portConfig(baseEntries: Array<{ port: number; title: string; enabled: boolean }>, mode: string, ports: number[]) {
  const selected = new Set(ports);
  const entries = baseEntries.map((entry) => ({
    ...entry,
    enabled: mode === "all" ? true : mode === "only-selected" ? selected.has(entry.port) : !selected.has(entry.port),
  }));
  for (const port of ports) {
    if (!entries.some((entry) => entry.port === port)) {
      entries.push({ port, title: `Custom port ${port}`, enabled: mode !== "exclude-selected" });
    }
  }
  return { entries, probeBatchSize: 5, probeTimeoutMs: 600 };
}

function EmailRecipients({ values, onChange, disabled }: { values: string[]; onChange: (values: string[]) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim().toLowerCase();
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setDraft("");
  };
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
            {value}
            <button type="button" disabled={disabled} onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Remove ${value}`} className="text-slate-400 hover:text-red-600">×</button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); } }}
        placeholder="name@example.com — press Enter"
        className="mt-1 h-9 w-full border-0 bg-transparent px-1 text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}

export default function OrgReporting({ org, canConfigure }: OrgReportingProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("sharePdf");
  const [assets, setAssets] = useState<Array<{ id: string }>>([]);
  const [scanSchedules, setScanSchedules] = useState<ScanSchedule[]>([]);
  const [emailSchedules, setEmailSchedules] = useState<EmailSchedule[]>([]);
  const [portEntries, setPortEntries] = useState<Array<{ port: number; title: string; enabled: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [periodicEnabled, setPeriodicEnabled] = useState(false);
  const [periodicFrequency, setPeriodicFrequency] = useState<Frequency>("weekly");
  const [periodicTime, setPeriodicTime] = useState("09:00");
  const [periodicPortScan, setPeriodicPortScan] = useState(true);
  const [periodicOpenSsl, setPeriodicOpenSsl] = useState(true);
  const [periodicPortMode, setPeriodicPortMode] = useState("all");
  const [periodicPorts, setPeriodicPorts] = useState("443, 8443");

  const [oneTimeDate, setOneTimeDate] = useState(localDateValue(new Date(Date.now() + 86_400_000)));
  const [oneTimeTime, setOneTimeTime] = useState("14:00");
  const [oneTimePortScan, setOneTimePortScan] = useState(true);
  const [oneTimeOpenSsl, setOneTimeOpenSsl] = useState(true);
  const [oneTimePortMode, setOneTimePortMode] = useState("all");
  const [oneTimePorts, setOneTimePorts] = useState("443");

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const emptyEmailDraft = useCallback((): EmailDraft => ({
    title: "Scheduled security posture report",
    heading: `${org.name} Security Posture Report`,
    frequency: "weekly",
    interval: 1,
    runAt: recurringAnchor("09:00"),
    recipients: [],
    sections: { ...DEFAULT_REPORT_SECTIONS },
    enabled: false,
    timezone,
    nextRunAt: null,
    lastRunAt: null,
    lastError: null,
  }), [org.name, timezone]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailDraft>(() => emptyEmailDraft());

  const recurringSchedules = useMemo(() => scanSchedules.filter((item) => item.mode === "recurring"), [scanSchedules]);
  const oneTimeSchedules = useMemo(() => scanSchedules.filter((item) => item.mode === "one_time"), [scanSchedules]);
  const nextScan = useMemo(() => scanSchedules.filter((item) => item.enabled && item.nextRunAt).sort((a, b) => String(a.nextRunAt).localeCompare(String(b.nextRunAt)))[0], [scanSchedules]);
  const nextEmail = useMemo(() => emailSchedules.filter((item) => item.enabled && item.nextRunAt).sort((a, b) => String(a.nextRunAt).localeCompare(String(b.nextRunAt)))[0], [emailSchedules]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRes, scansRes, emailsRes, portsRes] = await Promise.all([
        fetch(`/api/orgs/assets?orgId=${encodeURIComponent(org.id)}`),
        fetch(`/api/orgs/scans/schedules?orgId=${encodeURIComponent(org.id)}`),
        fetch(`/api/orgs/reporting/email-schedules?orgId=${encodeURIComponent(org.id)}`),
        fetch(`/api/orgs/port-discovery/config?orgId=${encodeURIComponent(org.id)}`),
      ]);
      const [assetsJson, scansJson, emailsJson, portsJson] = await Promise.all([assetsRes.json(), scansRes.json(), emailsRes.json(), portsRes.json()]);
      if (!assetsRes.ok || !scansRes.ok || !emailsRes.ok) throw new Error(assetsJson.error || scansJson.error || emailsJson.error || "Could not load reporting automation.");
      const loadedScans: ScanSchedule[] = scansJson.schedules || [];
      const loadedEmails: EmailSchedule[] = emailsJson.schedules || [];
      setAssets(assetsJson.assets || []);
      setScanSchedules(loadedScans);
      setEmailSchedules(loadedEmails);
      setPortEntries(portsJson.config?.entries || []);
      const firstRecurring = loadedScans.find((item) => item.mode === "recurring");
      if (firstRecurring) {
        setPeriodicEnabled(loadedScans.some((item) => item.mode === "recurring" && item.enabled));
        setPeriodicFrequency(frequencyFromApi(firstRecurring.frequency, firstRecurring.interval));
        setPeriodicTime(localTimeValue(firstRecurring.runAt));
        setPeriodicPortScan(loadedScans.some((item) => item.mode === "recurring" && item.engine === "portDiscovery"));
        setPeriodicOpenSsl(loadedScans.some((item) => item.mode === "recurring" && item.engine === "openssl"));
      }
      setSelectedEmailId((currentId) => {
        if (loadedEmails.length === 0) {
          setEmailDraft(emptyEmailDraft());
          return null;
        }
        const selected = loadedEmails.find((item) => item.id === currentId) || loadedEmails[0];
        setEmailDraft({ ...selected });
        return selected.id;
      });
    } catch (error: any) {
      setNotice({ tone: "error", text: error?.message || "Could not load reporting automation." });
    } finally {
      setLoading(false);
    }
  }, [emptyEmailDraft, org.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const request = async (url: string, method: string, body?: unknown) => {
    const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || "The operation failed.");
    return result;
  };

  const savePeriodic = async () => {
    if (!periodicPortScan && !periodicOpenSsl) return setNotice({ tone: "error", text: "Select at least one scan engine." });
    if (assets.length === 0) return setNotice({ tone: "error", text: "No organization assets are available to schedule." });
    setSaving(true); setNotice(null);
    try {
      const apiFrequency = frequencyToApi(periodicFrequency);
      const desired: ScanEngine[] = [periodicPortScan ? "portDiscovery" : null, periodicOpenSsl ? "openssl" : null].filter(Boolean) as ScanEngine[];
      for (const engine of desired) {
        const current = recurringSchedules.find((item) => item.engine === engine);
        const body = {
          orgId: org.id,
          engine,
          type: "full",
          mode: "recurring",
          runAt: recurringAnchor(periodicTime),
          ...apiFrequency,
          assetIds: assets.map((item) => item.id),
          configSnapshot: engine === "portDiscovery" ? portConfig(portEntries, periodicPortMode, parsePortList(periodicPorts)) : null,
          timezone,
          enabled: periodicEnabled,
        };
        if (current) await request(`/api/orgs/scans/schedules/${current.id}`, "PATCH", body);
        else if (periodicEnabled) await request("/api/orgs/scans/schedules", "POST", body);
      }
      for (const current of recurringSchedules.filter((item) => !desired.includes(item.engine))) {
        await request(`/api/orgs/scans/schedules/${current.id}?orgId=${encodeURIComponent(org.id)}`, "DELETE");
      }
      setNotice({ tone: "success", text: periodicEnabled ? "Periodic scan schedule saved." : "Periodic scans are disabled." });
      await refresh();
    } catch (error: any) {
      setNotice({ tone: "error", text: error?.message || "Could not save the periodic schedule." });
    } finally { setSaving(false); }
  };

  const scheduleOneTime = async () => {
    if (!oneTimePortScan && !oneTimeOpenSsl) return setNotice({ tone: "error", text: "Select at least one scan engine." });
    if (assets.length === 0) return setNotice({ tone: "error", text: "No organization assets are available to schedule." });
    setSaving(true); setNotice(null);
    try {
      const runAt = toIso(oneTimeDate, oneTimeTime);
      if (new Date(runAt) <= new Date()) throw new Error("Choose a future date and time.");
      const engines: ScanEngine[] = [oneTimePortScan ? "portDiscovery" : null, oneTimeOpenSsl ? "openssl" : null].filter(Boolean) as ScanEngine[];
      for (const engine of engines) {
        await request("/api/orgs/scans/schedules", "POST", {
          orgId: org.id, engine, type: "full", mode: "one_time", runAt,
          assetIds: assets.map((item) => item.id), timezone,
          configSnapshot: engine === "portDiscovery" ? portConfig(portEntries, oneTimePortMode, parsePortList(oneTimePorts)) : null,
        });
      }
      setNotice({ tone: "success", text: `One-time scan scheduled for ${formatDateTime(runAt)}.` });
      await refresh();
    } catch (error: any) {
      setNotice({ tone: "error", text: error?.message || "Could not schedule the scan." });
    } finally { setSaving(false); }
  };

  const deleteScanSchedule = async (id: string) => {
    setSaving(true);
    try {
      await request(`/api/orgs/scans/schedules/${id}?orgId=${encodeURIComponent(org.id)}`, "DELETE");
      setNotice({ tone: "success", text: "Scheduled scan removed." });
      await refresh();
    } catch (error: any) { setNotice({ tone: "error", text: error?.message || "Could not remove the schedule." }); }
    finally { setSaving(false); }
  };

  const saveEmail = async () => {
    setSaving(true); setNotice(null);
    try {
      if (emailDraft.enabled && emailDraft.recipients.length === 0) throw new Error("Add at least one recipient before enabling email delivery.");
      const body = { ...emailDraft, orgId: org.id };
      const result = selectedEmailId
        ? await request(`/api/orgs/reporting/email-schedules/${selectedEmailId}`, "PATCH", body)
        : await request("/api/orgs/reporting/email-schedules", "POST", body);
      setSelectedEmailId(result.schedule.id);
      setNotice({ tone: "success", text: emailDraft.enabled ? "Automatic email delivery saved and enabled." : "Email setup saved. Delivery remains disabled." });
      await refresh();
    } catch (error: any) { setNotice({ tone: "error", text: error?.message || "Could not save email delivery." }); }
    finally { setSaving(false); }
  };

  const selectEmail = (schedule: EmailSchedule) => { setSelectedEmailId(schedule.id); setEmailDraft({ ...schedule }); };
  const createEmail = () => { setSelectedEmailId(null); setEmailDraft(emptyEmailDraft()); setNotice(null); };
  const deleteEmail = async () => {
    if (!selectedEmailId) return;
    setSaving(true);
    try {
      await request(`/api/orgs/reporting/email-schedules/${selectedEmailId}?orgId=${encodeURIComponent(org.id)}`, "DELETE");
      setNotice({ tone: "success", text: "Email delivery schedule deleted." });
      setSelectedEmailId(null);
      await refresh();
    } catch (error: any) { setNotice({ tone: "error", text: error?.message || "Could not delete email delivery." }); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col space-y-4 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-start gap-3">
          <FileCheck className="mt-1 h-5 w-5 text-[#8B0000]" />
          <div>
            <h1 className="text-xl font-bold text-[#3d200a]">Reporting</h1>
            <p className="mt-1 text-sm text-slate-600">Generate reports and manage scheduled scans and delivery.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span>Next scan <strong className="ml-1 text-slate-800">{formatDateTime(nextScan?.nextRunAt)}</strong></span>
          <span>Next email <strong className="ml-1 text-slate-800">{formatDateTime(nextEmail?.nextRunAt)}</strong></span>
        </div>
      </header>

      {notice ? <div role="status" className={cn("rounded-lg border px-4 py-3 text-sm", notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>{notice.text}</div> : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white/25 shadow-sm">
        <nav className="overflow-x-auto border-b border-slate-200 px-3 pt-2" aria-label="Reporting sections">
          <div className="flex min-w-max gap-1" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button key={tab.key} type="button" role="tab" aria-selected={active} onClick={() => setActiveTab(tab.key)} className={cn("-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition", active ? "border-[#8B0000] text-[#8B0000]" : "border-transparent text-slate-600 hover:text-slate-900")}>
                  <Icon className="h-4 w-4" />{tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#8B0000]" /></div> : null}
        {!loading && activeTab === "sharePdf" ? <ReportingPdfBuilder org={org} canConfigure={canConfigure} /> : null}

        {!loading && activeTab === "periodicScans" ? (
          <div className="space-y-4 p-4 sm:p-5">
            <Panel title="Periodic scans" description="Run repeatable discovery and TLS checks at an exact local time.">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div><p className="text-sm font-semibold text-slate-900">Automation</p><p className="mt-1 text-xs text-slate-500">Disabled until you explicitly enable and save it.</p></div>
                <Switch checked={periodicEnabled} onChange={setPeriodicEnabled} disabled={!canConfigure} label="Periodic scan automation" />
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Frequency"><select value={periodicFrequency} onChange={(e) => setPeriodicFrequency(e.target.value as Frequency)} disabled={!canConfigure} className={inputClass}>{frequencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Start time" helper={`Exact time in ${timezone}.`}><input type="time" value={periodicTime} onChange={(e) => setPeriodicTime(e.target.value)} disabled={!canConfigure} className={inputClass} /></Field>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <EngineChoice title="Port discovery" helper="Refresh open-port coverage." checked={periodicPortScan} onChange={setPeriodicPortScan} disabled={!canConfigure} />
                <EngineChoice title="OpenSSL analysis" helper="Refresh certificates, TLS, and PQC findings." checked={periodicOpenSsl} onChange={setPeriodicOpenSsl} disabled={!canConfigure} />
              </div>
              {periodicPortScan ? <div className="mt-5 grid gap-4 sm:grid-cols-[220px_1fr]"><Field label="Port scope"><select value={periodicPortMode} onChange={(e) => setPeriodicPortMode(e.target.value)} className={inputClass}><option value="all">All configured ports</option><option value="only-selected">Only selected ports</option><option value="exclude-selected">Exclude selected ports</option></select></Field>{periodicPortMode !== "all" ? <Field label="Ports" helper="Comma-separated, 1–65535."><input value={periodicPorts} onChange={(e) => setPeriodicPorts(e.target.value)} className={inputClass} /></Field> : null}</div> : null}
              <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500">Next run: <strong className="text-slate-800">{formatDateTime(nextScan?.nextRunAt)}</strong></p>
                <button type="button" disabled={!canConfigure || saving} onClick={savePeriodic} className={buttonPrimary}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save schedule</button>
              </div>
            </Panel>
          </div>
        ) : null}

        {!loading && activeTab === "scheduleScan" ? (
          <div className="space-y-4 p-4 sm:p-5">
            <Panel title="Schedule a one-time scan" description="Create a real future scan without changing recurring automation.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date"><input type="date" min={localDateValue()} value={oneTimeDate} onChange={(e) => setOneTimeDate(e.target.value)} disabled={!canConfigure} className={inputClass} /></Field>
                <Field label="Start time" helper={`Exact time in ${timezone}.`}><input type="time" value={oneTimeTime} onChange={(e) => setOneTimeTime(e.target.value)} disabled={!canConfigure} className={inputClass} /></Field>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <EngineChoice title="Port discovery" helper="Refresh open-port coverage." checked={oneTimePortScan} onChange={setOneTimePortScan} disabled={!canConfigure} />
                <EngineChoice title="OpenSSL analysis" helper="Refresh certificates, TLS, and PQC findings." checked={oneTimeOpenSsl} onChange={setOneTimeOpenSsl} disabled={!canConfigure} />
              </div>
              {oneTimePortScan ? <div className="mt-5 grid gap-4 sm:grid-cols-[220px_1fr]"><Field label="Port scope"><select value={oneTimePortMode} onChange={(e) => setOneTimePortMode(e.target.value)} className={inputClass}><option value="all">All configured ports</option><option value="only-selected">Only selected ports</option><option value="exclude-selected">Exclude selected ports</option></select></Field>{oneTimePortMode !== "all" ? <Field label="Ports"><input value={oneTimePorts} onChange={(e) => setOneTimePorts(e.target.value)} className={inputClass} /></Field> : null}</div> : null}
              <div className="mt-5 flex justify-end border-t border-slate-200 pt-4"><button type="button" disabled={!canConfigure || saving} onClick={scheduleOneTime} className={buttonPrimary}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}Schedule scan</button></div>
            </Panel>
            {oneTimeSchedules.length > 0 ? <Panel title="Upcoming one-time scans"><div className="divide-y divide-slate-200">{oneTimeSchedules.map((schedule) => <div key={schedule.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium text-slate-900">{schedule.engine === "portDiscovery" ? "Port discovery" : "OpenSSL analysis"}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(schedule.nextRunAt || schedule.runAt)}</p></div><button type="button" onClick={() => deleteScanSchedule(schedule.id)} disabled={!canConfigure || saving} aria-label="Delete scheduled scan" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></div>)}</div></Panel> : null}
          </div>
        ) : null}

        {!loading && activeTab === "autoEmails" ? (
          <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[260px_minmax(0,1fr)]">
            <Panel title="Email schedules">
              <button type="button" onClick={createEmail} disabled={!canConfigure} className={cn(buttonSecondary, "w-full")}><Plus className="h-4 w-4" />New schedule</button>
              <div className="mt-3 divide-y divide-slate-200">
                {emailSchedules.length === 0 ? <p className="py-4 text-sm text-slate-500">No automatic emails configured.</p> : emailSchedules.map((schedule) => <button key={schedule.id} type="button" onClick={() => selectEmail(schedule)} className={cn("w-full py-3 text-left", selectedEmailId === schedule.id ? "text-[#8B0000]" : "text-slate-800")}><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{schedule.title}</span><span className={cn("h-2 w-2 rounded-full", schedule.enabled ? "bg-emerald-500" : "bg-slate-300")} /></span><span className="mt-1 block text-xs text-slate-500">{schedule.enabled ? formatDateTime(schedule.nextRunAt) : "Disabled"}</span></button>) }
              </div>
            </Panel>
            <Panel title={selectedEmailId ? "Edit automatic email" : "Create automatic email"} description="Delivery is opt-in and uses the same generated PDF as Share PDF.">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4"><div><p className="text-sm font-semibold text-slate-900">Automatic delivery</p><p className="mt-1 text-xs text-slate-500">Disabled by default.</p></div><Switch checked={emailDraft.enabled} onChange={(enabled) => setEmailDraft((current) => ({ ...current, enabled }))} disabled={!canConfigure} label="Automatic email delivery" /></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Schedule name"><input value={emailDraft.title} onChange={(e) => setEmailDraft((current) => ({ ...current, title: e.target.value }))} disabled={!canConfigure} className={inputClass} /></Field>
                <Field label="Report heading"><input value={emailDraft.heading} onChange={(e) => setEmailDraft((current) => ({ ...current, heading: e.target.value }))} disabled={!canConfigure} className={inputClass} /></Field>
                <Field label="Frequency" helper="Daily is the minimum allowed frequency."><select value={emailDraft.frequency} onChange={(e) => setEmailDraft((current) => ({ ...current, frequency: e.target.value as EmailDraft["frequency"] }))} disabled={!canConfigure} className={inputClass}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Field>
                <Field label="Delivery time" helper={`Exact time in ${timezone}.`}><input type="time" value={localTimeValue(emailDraft.runAt)} onChange={(e) => setEmailDraft((current) => ({ ...current, runAt: recurringAnchor(e.target.value) }))} disabled={!canConfigure} className={inputClass} /></Field>
              </div>
              <div className="mt-5"><Field label="Recipients" helper="At least one valid recipient is required before enabling."><EmailRecipients values={emailDraft.recipients} onChange={(recipients) => setEmailDraft((current) => ({ ...current, recipients }))} disabled={!canConfigure} /></Field></div>
              <div className="mt-5"><p className="text-sm font-semibold text-slate-800">PDF contents</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{REPORT_SECTION_META.map((section) => { const checked = emailDraft.sections[section.key]; return <button key={section.key} type="button" disabled={!canConfigure} onClick={() => setEmailDraft((current) => ({ ...current, sections: { ...current.sections, [section.key]: !checked } }))} className={cn("flex items-start gap-3 rounded-lg border p-3 text-left", checked ? "border-[#8B0000]/30 bg-[#8B0000]/5" : "border-slate-200 bg-white")}><span className={cn("mt-0.5 flex h-4 w-4 items-center justify-center rounded border", checked ? "border-[#8B0000] bg-[#8B0000] text-white" : "border-slate-300")}>{checked ? <Check className="h-3 w-3" /> : null}</span><span><span className="block text-sm font-medium text-slate-900">{section.label}</span><span className="mt-0.5 block text-xs text-slate-500">{section.helper}</span></span></button>; })}</div></div>
              {emailDraft.lastError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">Last delivery failed: {emailDraft.lastError}</div> : null}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><p className="text-xs text-slate-500">Next delivery: <strong className="text-slate-800">{emailDraft.enabled ? formatDateTime(emailDraft.nextRunAt) : "Disabled"}</strong></p><div className="flex gap-2">{selectedEmailId ? <button type="button" onClick={deleteEmail} disabled={!canConfigure || saving} className={buttonSecondary}><Trash2 className="h-4 w-4" />Delete</button> : null}<button type="button" onClick={saveEmail} disabled={!canConfigure || saving} className={buttonPrimary}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save email</button></div></div>
            </Panel>
          </div>
        ) : null}
      </section>
    </div>
  );
}
