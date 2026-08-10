"use client";

import { useMemo, useState } from "react";
import { Check, Download, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REPORT_SECTIONS,
  REPORT_SECTION_META,
  type ReportSectionKey,
} from "@/lib/reporting";

interface ReportingPdfBuilderProps {
  org: {
    id: string;
    name: string;
    slug: string;
  };
  canConfigure: boolean;
}

type ReportPreset = "executive" | "standard" | "complete";

const PRESETS: Array<{
  key: ReportPreset;
  label: string;
  helper: string;
  sections: ReportSectionKey[];
}> = [
  {
    key: "executive",
    label: "Executive",
    helper: "Concise leadership summary",
    sections: ["executiveSummary", "securityOverview", "pqcPosture", "immediateAttention"],
  },
  {
    key: "standard",
    label: "Standard",
    helper: "Balanced posture report",
    sections: Object.entries(DEFAULT_REPORT_SECTIONS)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key as ReportSectionKey),
  },
  {
    key: "complete",
    label: "Complete",
    helper: "All evidence and methodology",
    sections: REPORT_SECTION_META.map((section) => section.key),
  },
];

function sectionsForPreset(keys: ReportSectionKey[]) {
  return REPORT_SECTION_META.reduce<Record<ReportSectionKey, boolean>>(
    (result, section) => {
      result[section.key] = keys.includes(section.key);
      return result;
    },
    { ...DEFAULT_REPORT_SECTIONS }
  );
}

function filenameFromDisposition(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

export default function ReportingPdfBuilder({ org, canConfigure }: ReportingPdfBuilderProps) {
  const [heading, setHeading] = useState(`${org.name} Security Posture Report`);
  const [subtitle, setSubtitle] = useState("TLS and post-quantum readiness assessment");
  const [sections, setSections] = useState<Record<ReportSectionKey, boolean>>(DEFAULT_REPORT_SECTIONS);
  const [preset, setPreset] = useState<ReportPreset | null>("standard");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = useMemo(() => Object.values(sections).filter(Boolean).length, [sections]);

  const selectPreset = (nextPreset: ReportPreset) => {
    if (!canConfigure) return;
    const selection = PRESETS.find((item) => item.key === nextPreset);
    if (!selection) return;
    setPreset(nextPreset);
    setSections(sectionsForPreset(selection.sections));
  };

  const toggleSection = (key: ReportSectionKey) => {
    if (!canConfigure) return;
    setPreset(null);
    setSections((current) => ({ ...current, [key]: !current[key] }));
  };

  const downloadReport = async () => {
    if (selectedCount === 0 || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/orgs/reporting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, heading, subtitle, sections }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "The server could not generate the report.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filenameFromDisposition(
        response.headers.get("Content-Disposition"),
        `${org.slug}-security-posture.pdf`
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError: any) {
      setError(downloadError?.message || "The server could not generate the report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-full">
      <section className="overflow-hidden bg-white/15">
        <div className="border-b border-white/40 bg-white/10 px-5 py-4 sm:px-6">
          <h2 className="text-xl font-black text-[#3d200a]">Configure and generate PDF</h2>
          <p className="mt-1 text-sm font-medium leading-6 text-[#6f5a48]">
            Choose the report depth and content. Fresh scan data is compiled on the server when you generate it.
          </p>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {!canConfigure ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#8B0000]" />
              <p className="text-sm font-semibold text-[#7a4b20]">
                Your role can download the standard report. Report wording and section settings are managed by organization administrators.
              </p>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-black text-[#3d200a]">1. Choose report depth</p>
            <div className="mt-2 inline-flex w-full rounded-xl border border-white/30 bg-white/25 p-1 sm:w-auto">
              {PRESETS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={!canConfigure}
                  onClick={() => selectPreset(item.key)}
                  className={cn(
                    "flex-1 rounded-lg px-4 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-40",
                    preset === item.key
                      ? "bg-white/70 text-[#3d200a] shadow-sm backdrop-blur-sm"
                      : "text-[#6f5a48] hover:text-[#3d200a]"
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold">{item.label}</span>
                    {preset === item.key ? <Check className="h-4 w-4 text-[#8B0000]" /> : null}
                  </span>
                  <span className="mt-0.5 hidden text-xs font-medium text-[#7b6a5d] sm:block">{item.helper}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-black text-[#3d200a]">2. Set report identity</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-[#7a1f1f]">Title</span>
                <input
                  value={heading}
                  onChange={(event) => setHeading(event.target.value)}
                  maxLength={140}
                  disabled={!canConfigure}
                  className="h-10 rounded-lg border border-white/55 bg-white/60 px-3 text-sm font-semibold text-[#3d200a] outline-none backdrop-blur-sm focus:border-[#8B0000]/35 focus:ring-2 focus:ring-[#8B0000]/10 disabled:opacity-60"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-[#7a1f1f]">Subtitle</span>
                <input
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  maxLength={360}
                  disabled={!canConfigure}
                  className="h-10 rounded-lg border border-white/55 bg-white/60 px-3 text-sm font-semibold text-[#3d200a] outline-none backdrop-blur-sm focus:border-[#8B0000]/35 focus:ring-2 focus:ring-[#8B0000]/10 disabled:opacity-60"
                />
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-black text-[#3d200a]">3. Confirm sections</p>
              <span className="text-xs font-bold text-[#8a5d33]/70">{selectedCount} of {REPORT_SECTION_META.length} selected</span>
            </div>
            <div className="mt-2 grid overflow-hidden rounded-xl border border-white/45 bg-white/20 sm:grid-cols-2">
              {REPORT_SECTION_META.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={!canConfigure}
                  onClick={() => toggleSection(item.key)}
                  className="flex w-full items-center gap-3 border-b border-[#8a5d33]/10 px-3.5 py-2.5 text-left transition hover:bg-[#f8f6f2] disabled:cursor-not-allowed sm:odd:border-r"
                >
                  <span
                    className={cn(
                      "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border",
                      sections[item.key]
                        ? "border-[#8B0000] bg-[#8B0000] text-white"
                        : "border-[#8a5d33]/25 bg-white text-transparent"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold text-[#3d200a]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-white/40 bg-white/20 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-medium text-[#6f5a48]">
            Generated from fresh organization data using server-side LaTeX.
          </p>
          <button
            type="button"
            onClick={downloadReport}
            disabled={generating || selectedCount === 0}
            className="inline-flex min-w-44 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#8B0000] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating ? "Compiling report..." : "Generate PDF"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
      ) : null}
    </div>
  );
}
