"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileCheck,
  FileText,
  Mail,
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat,
  ScanSearch,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReportingPdfBuilder from "./ReportingPdfBuilder";

interface OrgReportingProps {
  org: any;
  canConfigure: boolean;
}

type ReportingTabKey = "sharePdf" | "periodicScans" | "scheduleScan" | "autoEmails";
type PdfSectionKey = "overallScore" | "tierStats" | "tierAssetLists" | "pqcSupportLists";
type FrequencyOption = "daily" | "every-3-days" | "every-4-days" | "weekly" | "monthly";
type TimeWindowOption = "early-morning" | "morning" | "afternoon" | "evening";
type PortModeOption = "all" | "only-selected" | "exclude-selected";

type PdfSectionState = Record<PdfSectionKey, boolean>;

type ReportTypeDraft = {
  id: string;
  title: string;
  heading: string;
  cadence: FrequencyOption;
  recipients: string[];
  sections: PdfSectionState;
};

const reportingTabs: Array<{
  key: ReportingTabKey;
  label: string;
  icon: typeof FileText;
  helper: string;
}> = [
  {
    key: "sharePdf",
    label: "Share PDF",
    icon: FileText,
    helper: "Compose an executive-ready report and choose exactly what goes into the export.",
  },
  {
    key: "periodicScans",
    label: "Periodic Scans",
    icon: Repeat,
    helper: "Keep discovery and TLS checks running on a predictable rhythm without manual follow-up.",
  },
  {
    key: "scheduleScan",
    label: "Schedule Scan",
    icon: CalendarClock,
    helper: "Book a one-time future scan when you need a refresh before a milestone or review.",
  },
  {
    key: "autoEmails",
    label: "Auto Emails",
    icon: Mail,
    helper: "Set up reusable report types and stakeholder delivery lists in one place.",
  },
];

const pdfSectionMeta: Array<{
  key: PdfSectionKey;
  label: string;
  helper: string;
}> = [
  {
    key: "overallScore",
    label: "Overall score",
    helper: "Headline PQC posture score with a concise summary suitable for leadership review.",
  },
  {
    key: "tierStats",
    label: "PQC rating by tier",
    helper: "Counts of assets in Tier A, B, C, and D so readers see the distribution quickly.",
  },
  {
    key: "tierAssetLists",
    label: "Tier-wise asset lists",
    helper: "Organize assets by their current PQC tier so teams can work through them in order.",
  },
  {
    key: "pqcSupportLists",
    label: "PQC supported vs not supported",
    helper: "Separate assets that already negotiate PQC-compatible posture from those that still do not.",
  },
];

const frequencyOptions: Array<{ value: FrequencyOption; label: string; helper: string }> = [
  { value: "daily", label: "Daily", helper: "Smallest allowed interval." },
  { value: "every-3-days", label: "Every 3 days", helper: "Balanced freshness with lighter load." },
  { value: "every-4-days", label: "Every 4 days", helper: "A calmer recurring rhythm for stable estates." },
  { value: "weekly", label: "Weekly", helper: "Good default for broad recurring visibility." },
  { value: "monthly", label: "Monthly", helper: "Useful for formal reporting cycles." },
];

const timeWindowOptions: Array<{ value: TimeWindowOption; label: string }> = [
  { value: "early-morning", label: "Early morning" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

const portModeOptions: Array<{ value: PortModeOption; label: string }> = [
  { value: "all", label: "All discovered ports" },
  { value: "only-selected", label: "Only selected ports" },
  { value: "exclude-selected", label: "Exclude selected ports" },
];

const cadenceLabelMap: Record<FrequencyOption, string> = {
  daily: "Daily",
  "every-3-days": "Every 3 days",
  "every-4-days": "Every 4 days",
  weekly: "Weekly",
  monthly: "Monthly",
};

const timeWindowLabelMap: Record<TimeWindowOption, string> = {
  "early-morning": "Early morning",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

const defaultPdfSections: PdfSectionState = {
  overallScore: true,
  tierStats: true,
  tierAssetLists: true,
  pqcSupportLists: false,
};

function formatMockNextRun(daysFromNow: number, timeWindow: TimeWindowOption) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return `${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })} · ${timeWindowLabelMap[timeWindow]}`;
}

function formatOneTimeRun(dateValue: string, timeWindow: TimeWindowOption) {
  if (!dateValue) return `Pick a date · ${timeWindowLabelMap[timeWindow]}`;

  const date = new Date(`${dateValue}T09:00:00`);
  if (Number.isNaN(date.getTime())) return `Pick a date · ${timeWindowLabelMap[timeWindow]}`;

  return `${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} · ${timeWindowLabelMap[timeWindow]}`;
}

function ChipField({
  label,
  placeholder,
  values,
  onAdd,
  onRemove,
  disabled,
  helper,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  disabled?: boolean;
  helper: string;
}) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const normalized = draft.trim().replace(/,$/, "");
    if (!normalized) return;
    onAdd(normalized);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <FieldLabel label={label} helper={helper} />
      <div className="rounded-3xl border border-white/50 bg-white/80 p-3 shadow-sm ring-1 ring-amber-500/10">
        <div className="flex flex-wrap gap-2">
          {values.length === 0 ? (
            <span className="rounded-full border border-dashed border-[#8a5d33]/20 bg-[#fff7e6] px-3 py-1.5 text-xs font-semibold text-[#8a5d33]/70">
              No entries added yet
            </span>
          ) : (
            values.map((value) => (
              <span
                key={value}
                className="inline-flex items-center gap-2 rounded-full bg-[#8B0000]/8 px-3 py-1.5 text-xs font-bold text-[#8B0000]"
              >
                {value}
                <button
                  type="button"
                  onClick={() => onRemove(value)}
                  disabled={disabled}
                  className="rounded-full text-[#8B0000]/70 transition hover:text-[#730000] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))
          )}
        </div>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commitDraft();
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="mt-3 h-11 w-full rounded-2xl border border-[#8a5d33]/10 bg-[#fffdf8] px-4 text-sm font-semibold text-[#3d200a] outline-none transition placeholder:text-[#8a5d33]/45 focus:border-[#8B0000]/25 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </div>
  );
}

function FieldLabel({ label, helper }: { label: string; helper?: string }) {
  return (
    <div>
      <p className="text-sm font-bold text-[#7a1f1f]">{label}</p>
      {helper ? <p className="mt-1 text-sm font-medium text-[#8a5d33]/75">{helper}</p> : null}
    </div>
  );
}

function ShellCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/40 bg-white/45 p-5 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </section>
  );
}

function InfoPill({ label, value, tone = "warm" }: { label: string; value: string; tone?: "warm" | "red" | "green" | "blue" }) {
  const toneClass =
    tone === "red"
      ? "border-[#8B0000]/12 bg-[#8B0000]/8 text-[#8B0000]"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "blue"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-amber-500/15 bg-[#fff7e6] text-[#8a5d33]";

  return (
    <div className={cn("rounded-full border px-4 py-2", toneClass)}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function ToggleCard({
  title,
  helper,
  active,
  onToggle,
  disabled,
}: {
  title: string;
  helper: string;
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "rounded-3xl border p-4 text-left transition",
        active
          ? "border-[#8B0000]/15 bg-[#8B0000] text-white shadow-sm"
          : "border-[#8a5d33]/10 bg-white/70 text-[#3d200a] hover:bg-white/90",
        disabled ? "cursor-not-allowed opacity-70" : ""
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black">{title}</p>
          <p className={cn("mt-1 text-sm font-medium", active ? "text-white/78" : "text-[#8a5d33]/75")}>{helper}</p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition",
            active ? "bg-white/18" : "bg-[#8a5d33]/12"
          )}
        >
          <span
            className={cn(
              "h-4 w-4 rounded-full bg-white shadow-sm transition",
              active ? "translate-x-5" : "translate-x-0"
            )}
          />
        </span>
      </div>
    </button>
  );
}

function TabButton({
  active,
  label,
  helper,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  helper: string;
  onClick: () => void;
  icon: typeof FileText;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={helper}
      aria-label={`${label}. ${helper}`}
      className={cn(
        "group relative z-10 min-w-[220px] flex-1 rounded-[26px] border p-4 text-left transition hover:z-30 focus-visible:z-30",
        active
          ? "border-[#8B0000]/15 bg-[#8B0000] text-white shadow-sm"
          : "border-[#8a5d33]/10 bg-white/70 text-[#3d200a] hover:bg-white"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-xs font-black uppercase tracking-[0.18em]", active ? "text-white/72" : "text-[#8a5d33]/70")}>
            Reporting
          </p>
          <p className="mt-2 truncate text-lg font-black">{label}</p>
        </div>
        <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", active ? "bg-white/16" : "bg-[#8B0000]/8")}>
          <Icon className={cn("h-5 w-5", active ? "text-white" : "text-[#8B0000]")} />
        </span>
      </div>
      <span
        className={cn(
          "pointer-events-none absolute left-4 right-4 top-[calc(100%+0.6rem)] z-[80] rounded-2xl border border-[#5f1212] bg-[#6f1616] px-3 py-2 text-xs font-semibold leading-5 text-white opacity-0 shadow-[0_18px_40px_rgba(70,10,10,0.35)] transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        )}
      >
        {helper}
      </span>
    </button>
  );
}

export default function OrgReporting({ org, canConfigure }: OrgReportingProps) {
  const [activeTab, setActiveTab] = useState<ReportingTabKey>("sharePdf");

  const [periodicEnabled, setPeriodicEnabled] = useState(true);
  const [periodicFrequency, setPeriodicFrequency] = useState<FrequencyOption>("weekly");
  const [periodicTimeWindow, setPeriodicTimeWindow] = useState<TimeWindowOption>("morning");
  const [periodicPortScan, setPeriodicPortScan] = useState(true);
  const [periodicOpensslScan, setPeriodicOpensslScan] = useState(true);
  const [periodicPortMode, setPeriodicPortMode] = useState<PortModeOption>("all");
  const [periodicPorts, setPeriodicPorts] = useState<string[]>(["443", "8443"]);

  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeWindow, setScheduledTimeWindow] = useState<TimeWindowOption>("afternoon");
  const [scheduledPortScan, setScheduledPortScan] = useState(true);
  const [scheduledOpensslScan, setScheduledOpensslScan] = useState(true);
  const [scheduledPortMode, setScheduledPortMode] = useState<PortModeOption>("only-selected");
  const [scheduledPorts, setScheduledPorts] = useState<string[]>(["443"]);
  const [scheduledNote, setScheduledNote] = useState("Use this before vendor review and certificate posture sign-off.");

  const [selectedReportTypeId, setSelectedReportTypeId] = useState("weekly-leadership");
  const [reportTypes, setReportTypes] = useState<ReportTypeDraft[]>([
    {
      id: "weekly-leadership",
      title: "Weekly leadership digest",
      heading: org.name || "Organization Report",
      cadence: "weekly",
      recipients: ["ciso@example.com", "security-leads@example.com"],
      sections: {
        overallScore: true,
        tierStats: true,
        tierAssetLists: false,
        pqcSupportLists: true,
      },
    },
    {
      id: "monthly-ops",
      title: "Monthly operations deep dive",
      heading: `${org.name || "Organization"} Technical Report`,
      cadence: "monthly",
      recipients: ["soc@example.com", "platform@example.com", "infra@example.com"],
      sections: {
        overallScore: true,
        tierStats: true,
        tierAssetLists: true,
        pqcSupportLists: true,
      },
    },
  ]);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone";

  const selectedReportType = useMemo(
    () => reportTypes.find((item) => item.id === selectedReportTypeId) || reportTypes[0],
    [reportTypes, selectedReportTypeId]
  );

  const nextPeriodicRun = periodicEnabled
    ? formatMockNextRun(
        periodicFrequency === "daily"
          ? 1
          : periodicFrequency === "every-3-days"
            ? 3
            : periodicFrequency === "every-4-days"
              ? 4
              : periodicFrequency === "weekly"
                ? 7
                : 30,
        periodicTimeWindow
      )
    : "Paused";

  const nextEmailRun = selectedReportType
    ? formatMockNextRun(
        selectedReportType.cadence === "daily"
          ? 1
          : selectedReportType.cadence === "every-3-days"
            ? 3
            : selectedReportType.cadence === "every-4-days"
              ? 4
              : selectedReportType.cadence === "weekly"
                ? 7
                : 30,
        "morning"
      )
    : "Not configured";

  const updateSelectedReportType = (updater: (reportType: ReportTypeDraft) => ReportTypeDraft) => {
    setReportTypes((current) =>
      current.map((reportType) => (reportType.id === selectedReportTypeId ? updater(reportType) : reportType))
    );
  };

  const addUniqueValue = (values: string[], nextValue: string) => {
    const normalized = nextValue.trim();
    if (!normalized || values.includes(normalized)) return values;
    return [...values, normalized];
  };

  return (
    <div className="flex flex-col space-y-5 pb-10 animate-in fade-in duration-300">
      <ShellCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8B0000]/10 text-[#8B0000]">
                <FileCheck className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#3d200a]">Reporting</h1>
                <p className="mt-1 text-sm font-semibold text-[#8a5d33]/75">
                  Build stakeholder-friendly reports, set scan rhythms, and prepare delivery flows without leaving the organization workspace.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InfoPill label="Org heading" value={org.name || "Organization"} />
            <InfoPill label="Next recurring scan" value={nextPeriodicRun} tone={periodicEnabled ? "green" : "red"} />
            <InfoPill label="Next email" value={nextEmailRun} tone="blue" />
          </div>
        </div>

        {!canConfigure ? (
          <div className="mt-5 rounded-3xl border border-amber-500/20 bg-[#fff7e6] p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#8B0000]" />
              <div>
                <p className="text-sm font-black text-[#3d200a]">Read-only for your role</p>
                <p className="mt-1 text-sm font-medium text-[#8a5d33]">
                  You can review the proposed reporting setup here. Organization admins will be able to change schedules, recipients, and report templates.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </ShellCard>

      <ShellCard className="relative z-20 overflow-visible p-3">
        <div className="flex flex-wrap gap-3">
          {reportingTabs.map((tab) => (
            <TabButton
              key={tab.key}
              active={activeTab === tab.key}
              label={tab.label}
              helper={tab.helper}
              icon={tab.icon}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
      </ShellCard>

      {activeTab === "sharePdf" ? (
        <ReportingPdfBuilder org={org} canConfigure={canConfigure} />
      ) : null}

      {activeTab === "periodicScans" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <ShellCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Periodic Scans</p>
                <h2 className="mt-2 text-xl font-black text-[#3d200a]">Keep technical coverage fresh without chasing the calendar</h2>
                <p className="mt-2 text-sm font-medium text-[#8a5d33]/75">
                  Pick a cadence, choose a softer time window, and decide how much of the port surface should be revisited automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPeriodicEnabled((current) => !current)}
                disabled={!canConfigure}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition",
                  periodicEnabled ? "bg-[#8B0000] text-white" : "bg-white/80 text-[#8B0000]",
                  !canConfigure ? "cursor-not-allowed opacity-60" : ""
                )}
              >
                {periodicEnabled ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                {periodicEnabled ? "Pause automation" : "Resume automation"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="Frequency" helper="Choose how often the recurring scan should run." />
                <select
                  value={periodicFrequency}
                  onChange={(event) => setPeriodicFrequency(event.target.value as FrequencyOption)}
                  disabled={!canConfigure}
                  className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-bold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {frequencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <FieldLabel label="Preferred start window" helper={`Shown in ${timezone} to keep planning understandable.`} />
                <select
                  value={periodicTimeWindow}
                  onChange={(event) => setPeriodicTimeWindow(event.target.value as TimeWindowOption)}
                  disabled={!canConfigure}
                  className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-bold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {timeWindowOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6">
              <FieldLabel
                label="Included engines"
                helper="Users can choose whether recurring jobs run port discovery, OpenSSL analysis, or both."
              />
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <ToggleCard
                  title="Port scan"
                  helper="Revisit the reachable port surface and keep the TLS target list current."
                  active={periodicPortScan}
                  disabled={!canConfigure}
                  onToggle={() => setPeriodicPortScan((current) => !current)}
                />
                <ToggleCard
                  title="OpenSSL scan"
                  helper="Refresh certificate posture and cryptographic findings on the selected cadence."
                  active={periodicOpensslScan}
                  disabled={!canConfigure}
                  onToggle={() => setPeriodicOpensslScan((current) => !current)}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
              <div className="space-y-2">
                <FieldLabel label="Port targeting" helper="Only applies when port scan is included." />
                <select
                  value={periodicPortMode}
                  onChange={(event) => setPeriodicPortMode(event.target.value as PortModeOption)}
                  disabled={!canConfigure || !periodicPortScan}
                  className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-bold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {portModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <ChipField
                label={periodicPortMode === "exclude-selected" ? "Excluded ports" : "Selected ports"}
                helper="Use simple values like 443 or 8443. This remains local-only until scheduling persistence is added."
                placeholder="Type a port and press Enter"
                values={periodicPorts}
                disabled={!canConfigure || !periodicPortScan || periodicPortMode === "all"}
                onAdd={(value) => setPeriodicPorts((current) => addUniqueValue(current, value))}
                onRemove={(value) => setPeriodicPorts((current) => current.filter((item) => item !== value))}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canConfigure}
                className="inline-flex items-center gap-2 rounded-full bg-[#8B0000] px-5 py-3 text-sm font-black text-white transition hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Save schedule
              </button>
              <button
                type="button"
                disabled={!canConfigure}
                className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/15 bg-white/80 px-5 py-3 text-sm font-black text-[#8B0000] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Review automation
              </button>
            </div>
          </ShellCard>

          <ShellCard className="h-fit">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Schedule Summary</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl border border-[#8B0000]/12 bg-[#fff7e6] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Status</p>
                <p className="mt-2 text-xl font-black text-[#3d200a]">{periodicEnabled ? "Enabled" : "Paused"}</p>
                <p className="mt-1 text-sm font-medium text-[#8a5d33]">
                  {periodicEnabled
                    ? "The recurring automation summary is ready for backend persistence."
                    : "Paused schedules stay visible so users know what will resume later."}
                </p>
              </div>

              <div className="grid gap-3">
                <InfoPill label="Next run" value={nextPeriodicRun} tone={periodicEnabled ? "green" : "red"} />
                <InfoPill label="Last run" value="Yesterday · Evening" />
                <InfoPill
                  label="Engines"
                  value={[periodicPortScan ? "Port" : null, periodicOpensslScan ? "OpenSSL" : null].filter(Boolean).join(" + ") || "None"}
                  tone="blue"
                />
              </div>

              <div className="rounded-3xl border border-[#8a5d33]/10 bg-white/70 p-4">
                <p className="text-sm font-black text-[#3d200a]">Port scope</p>
                <p className="mt-2 text-sm font-semibold text-[#8a5d33]">
                  {periodicPortMode === "all"
                    ? "All discovered ports will be revisited."
                    : periodicPortMode === "only-selected"
                      ? `Only selected ports: ${periodicPorts.join(", ") || "none yet"}`
                      : `Excluded ports: ${periodicPorts.join(", ") || "none yet"}`}
                </p>
              </div>
            </div>
          </ShellCard>
        </div>
      ) : null}

      {activeTab === "scheduleScan" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <ShellCard>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Schedule Scan</p>
            <h2 className="mt-2 text-xl font-black text-[#3d200a]">Book a one-time future scan without touching the recurring schedule</h2>
            <p className="mt-2 text-sm font-medium text-[#8a5d33]/75">
              This flow is intentionally calmer than the asset scanning screen so users can prepare a future run without feeling rushed.
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel label="Planned date" helper="Choose the date you want this one-time job to start around." />
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  disabled={!canConfigure}
                  className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-bold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel label="Time window" helper={`A friendly target window in ${timezone}.`} />
                <select
                  value={scheduledTimeWindow}
                  onChange={(event) => setScheduledTimeWindow(event.target.value as TimeWindowOption)}
                  disabled={!canConfigure}
                  className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-bold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {timeWindowOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6">
              <FieldLabel label="Scan scope" helper="Pick the engines needed for this one-off checkpoint." />
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <ToggleCard
                  title="Port scan"
                  helper="Refresh reachability and open-port coverage before the run."
                  active={scheduledPortScan}
                  disabled={!canConfigure}
                  onToggle={() => setScheduledPortScan((current) => !current)}
                />
                <ToggleCard
                  title="OpenSSL scan"
                  helper="Recalculate TLS posture and PQC observations for the scheduled window."
                  active={scheduledOpensslScan}
                  disabled={!canConfigure}
                  onToggle={() => setScheduledOpensslScan((current) => !current)}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
              <div className="space-y-2">
                <FieldLabel label="Port targeting" helper="Use the same targeting language as recurring scans." />
                <select
                  value={scheduledPortMode}
                  onChange={(event) => setScheduledPortMode(event.target.value as PortModeOption)}
                  disabled={!canConfigure || !scheduledPortScan}
                  className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-bold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {portModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <ChipField
                label={scheduledPortMode === "exclude-selected" ? "Excluded ports" : "Selected ports"}
                helper="Leave this light. The goal is to help operators schedule intent, not fill a giant form."
                placeholder="Type a port and press Enter"
                values={scheduledPorts}
                disabled={!canConfigure || !scheduledPortScan || scheduledPortMode === "all"}
                onAdd={(value) => setScheduledPorts((current) => addUniqueValue(current, value))}
                onRemove={(value) => setScheduledPorts((current) => current.filter((item) => item !== value))}
              />
            </div>

            <div className="mt-6 space-y-2">
              <FieldLabel label="Internal note" helper="Helpful context for operators reviewing the upcoming run." />
              <textarea
                value={scheduledNote}
                onChange={(event) => setScheduledNote(event.target.value)}
                disabled={!canConfigure}
                rows={4}
                className="w-full rounded-3xl border border-white/60 bg-white/80 px-4 py-3 text-sm font-semibold text-[#3d200a] outline-none transition placeholder:text-[#8a5d33]/45 focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canConfigure}
                className="inline-flex items-center gap-2 rounded-full bg-[#8B0000] px-5 py-3 text-sm font-black text-white transition hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ScanSearch className="h-4 w-4" />
                Schedule one-time scan
              </button>
            </div>
          </ShellCard>

          <ShellCard className="h-fit">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Upcoming Run</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl border border-[#8B0000]/12 bg-[#fff7e6] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Scheduled for</p>
                <p className="mt-2 text-xl font-black text-[#3d200a]">{formatOneTimeRun(scheduledDate, scheduledTimeWindow)}</p>
              </div>

              <div className="rounded-3xl border border-[#8a5d33]/10 bg-white/70 p-4">
                <p className="text-sm font-black text-[#3d200a]">Scope summary</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {scheduledPortScan ? (
                    <span className="rounded-full bg-[#8B0000]/8 px-3 py-1.5 text-xs font-bold text-[#8B0000]">Port scan</span>
                  ) : null}
                  {scheduledOpensslScan ? (
                    <span className="rounded-full bg-[#8B0000]/8 px-3 py-1.5 text-xs font-bold text-[#8B0000]">OpenSSL scan</span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-medium text-[#8a5d33]">
                  {scheduledPortMode === "all"
                    ? "All discovered ports"
                    : scheduledPortMode === "only-selected"
                      ? `Selected ports: ${scheduledPorts.join(", ") || "none yet"}`
                      : `Excluded ports: ${scheduledPorts.join(", ") || "none yet"}`}
                </p>
              </div>

              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-blue-700">
                <p className="text-sm font-black">Conflict note</p>
                <p className="mt-1 text-sm font-medium">
                  If a periodic run is already planned nearby, the future backend can merge or warn before scheduling. The UI keeps that expectation visible now.
                </p>
              </div>
            </div>
          </ShellCard>
        </div>
      ) : null}

      {activeTab === "autoEmails" ? (
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
          <ShellCard className="h-fit">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Report types</p>
                <h2 className="mt-2 text-xl font-black text-[#3d200a]">Reusable delivery templates</h2>
              </div>
              <button
                type="button"
                disabled={!canConfigure}
                onClick={() => {
                  const id = `report-type-${Date.now()}`;
                  setReportTypes((current) => [
                    ...current,
                    {
                      id,
                      title: "New stakeholder report",
                      heading: org.name || "Organization Report",
                      cadence: "weekly",
                      recipients: [],
                      sections: { ...defaultPdfSections },
                    },
                  ]);
                  setSelectedReportTypeId(id);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/15 bg-white/80 px-4 py-2 text-sm font-black text-[#8B0000] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Create
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {reportTypes.map((reportType) => {
                const selected = reportType.id === selectedReportTypeId;
                return (
                  <button
                    key={reportType.id}
                    type="button"
                    onClick={() => setSelectedReportTypeId(reportType.id)}
                    className={cn(
                      "w-full rounded-3xl border p-4 text-left transition",
                      selected
                        ? "border-[#8B0000]/15 bg-[#8B0000] text-white shadow-sm"
                        : "border-[#8a5d33]/10 bg-white/75 text-[#3d200a] hover:bg-white"
                    )}
                  >
                    <p className="text-sm font-black">{reportType.title}</p>
                    <div className={cn("mt-3 flex flex-wrap gap-2 text-xs font-bold", selected ? "text-white/78" : "text-[#8a5d33]/75")}>
                      <span>{cadenceLabelMap[reportType.cadence]}</span>
                      <span>·</span>
                      <span>{reportType.recipients.length} recipients</span>
                    </div>
                    <p className={cn("mt-2 text-sm font-medium", selected ? "text-white/78" : "text-[#8a5d33]/75")}>
                      Next send {formatMockNextRun(reportType.cadence === "daily" ? 1 : reportType.cadence === "every-3-days" ? 3 : reportType.cadence === "every-4-days" ? 4 : reportType.cadence === "weekly" ? 7 : 30, "morning")}
                    </p>
                  </button>
                );
              })}
            </div>
          </ShellCard>

          <ShellCard>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Auto Emails</p>
            <h2 className="mt-2 text-xl font-black text-[#3d200a]">Tune who receives what, and how often</h2>
            <p className="mt-2 text-sm font-medium text-[#8a5d33]/75">
              Report types let teams separate leadership summaries from technical deep dives without rebuilding recipient lists each time.
            </p>

            {selectedReportType ? (
              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <FieldLabel label="Report type title" helper="Short and easy to recognize when multiple report flows exist." />
                  <input
                    value={selectedReportType.title}
                    onChange={(event) =>
                      updateSelectedReportType((reportType) => ({
                        ...reportType,
                        title: event.target.value,
                      }))
                    }
                    disabled={!canConfigure}
                    className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-semibold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel label="Email report heading" helper="Defaults to the org name, but can be tailored per stakeholder audience." />
                  <input
                    value={selectedReportType.heading}
                    onChange={(event) =>
                      updateSelectedReportType((reportType) => ({
                        ...reportType,
                        heading: event.target.value,
                      }))
                    }
                    disabled={!canConfigure}
                    className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-semibold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <FieldLabel label="Cadence" helper="Uses the same interval language as scan scheduling." />
                    <select
                      value={selectedReportType.cadence}
                      onChange={(event) =>
                        updateSelectedReportType((reportType) => ({
                          ...reportType,
                          cadence: event.target.value as FrequencyOption,
                        }))
                      }
                      disabled={!canConfigure}
                      className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-bold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {frequencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <ChipField
                    label="Stakeholder emails"
                    helper="Recipients are managed per report type so different audiences get different levels of detail."
                    placeholder="Type an email and press Enter"
                    values={selectedReportType.recipients}
                    disabled={!canConfigure}
                    onAdd={(value) =>
                      updateSelectedReportType((reportType) => ({
                        ...reportType,
                        recipients: addUniqueValue(reportType.recipients, value),
                      }))
                    }
                    onRemove={(value) =>
                      updateSelectedReportType((reportType) => ({
                        ...reportType,
                        recipients: reportType.recipients.filter((item) => item !== value),
                      }))
                    }
                  />
                </div>

                <div>
                  <FieldLabel label="PDF contents" helper="Choose the same report sections that will be attached for this audience." />
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {pdfSectionMeta.map((section) => (
                      <ToggleCard
                        key={section.key}
                        title={section.label}
                        helper={section.helper}
                        active={selectedReportType.sections[section.key]}
                        disabled={!canConfigure}
                        onToggle={() =>
                          updateSelectedReportType((reportType) => ({
                            ...reportType,
                            sections: {
                              ...reportType.sections,
                              [section.key]: !reportType.sections[section.key],
                            },
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </ShellCard>

          <ShellCard className="h-fit">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Delivery Summary</p>
            {selectedReportType ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-3xl border border-[#8B0000]/12 bg-[#fff7e6] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Next email</p>
                  <p className="mt-2 text-xl font-black text-[#3d200a]">
                    {formatMockNextRun(
                      selectedReportType.cadence === "daily"
                        ? 1
                        : selectedReportType.cadence === "every-3-days"
                          ? 3
                          : selectedReportType.cadence === "every-4-days"
                            ? 4
                            : selectedReportType.cadence === "weekly"
                              ? 7
                              : 30,
                      "morning"
                    )}
                  </p>
                </div>

                <div className="grid gap-3">
                  <InfoPill label="Cadence" value={cadenceLabelMap[selectedReportType.cadence]} tone="blue" />
                  <InfoPill label="Recipients" value={`${selectedReportType.recipients.length}`} />
                  <InfoPill
                    label="Included sections"
                    value={`${Object.values(selectedReportType.sections).filter(Boolean).length}`}
                    tone="green"
                  />
                </div>

                <div className="rounded-3xl border border-[#8a5d33]/10 bg-white/70 p-4">
                  <p className="text-sm font-black text-[#3d200a]">Audience attachment preview</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pdfSectionMeta
                      .filter((section) => selectedReportType.sections[section.key])
                      .map((section) => (
                        <span
                          key={section.key}
                          className="rounded-full bg-[#8B0000]/8 px-3 py-1.5 text-xs font-bold text-[#8B0000]"
                        >
                          {section.label}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-blue-700">
                  <p className="text-sm font-black">Delivery expectation</p>
                  <p className="mt-1 text-sm font-medium">
                    Stakeholders will eventually receive the generated PDF automatically. For now, this UI keeps the intended cadence, audience, and content decisions visible.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!canConfigure}
                    className="inline-flex items-center gap-2 rounded-full bg-[#8B0000] px-5 py-3 text-sm font-black text-white transition hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    Save email setup
                  </button>
                  {reportTypes.length > 1 ? (
                    <button
                      type="button"
                      disabled={!canConfigure}
                      onClick={() => {
                        const remaining = reportTypes.filter((reportType) => reportType.id !== selectedReportType.id);
                        setReportTypes(remaining);
                        if (remaining[0]) setSelectedReportTypeId(remaining[0].id);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/15 bg-white/80 px-5 py-3 text-sm font-black text-[#8B0000] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete type
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </ShellCard>
        </div>
      ) : null}
    </div>
  );
}
