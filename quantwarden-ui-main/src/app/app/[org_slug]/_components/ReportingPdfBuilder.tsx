"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REPORT_SECTIONS,
  REPORT_ACTION_TIER_ORDER,
  REPORT_SCORING_PILLARS,
  getTierMeta,
  getTierStatus,
  getToneMeta,
  OrganizationReportPayload,
  REPORT_SECTION_META,
  REPORT_TIER_BANDS,
  REPORT_TIER_ORDER,
  type ReportAssetEntry,
  type ReportImmediateAttentionBucket,
  type ReportSectionKey,
  type ReportTierBucket,
} from "@/lib/reporting";

const REPORT_PAGE_WIDTH = 794;
const REPORT_PAGE_HEIGHT = 1123;
const PREVIEW_SCALE = 0.26;

interface ReportingPdfBuilderProps {
  org: {
    id: string;
    name: string;
    slug: string;
  };
  canConfigure: boolean;
}

function normalizeCaptureColors(root: HTMLElement) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) return;

  const normalizeColor = (value: string) => {
    if (!value) return value;
    context.fillStyle = "#000000";
    context.fillStyle = value;
    return context.fillStyle;
  };

  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

  for (const node of nodes) {
    const computed = window.getComputedStyle(node);
    node.style.color = normalizeColor(computed.color);
    node.style.backgroundColor = normalizeColor(computed.backgroundColor);
    node.style.borderTopColor = normalizeColor(computed.borderTopColor);
    node.style.borderRightColor = normalizeColor(computed.borderRightColor);
    node.style.borderBottomColor = normalizeColor(computed.borderBottomColor);
    node.style.borderLeftColor = normalizeColor(computed.borderLeftColor);
    node.style.outlineColor = normalizeColor(computed.outlineColor);
    node.style.textDecorationColor = normalizeColor(computed.textDecorationColor);
    node.style.caretColor = normalizeColor(computed.caretColor);

    if (computed.boxShadow.includes("oklch")) {
      node.style.boxShadow = "none";
    }
    if (computed.textShadow.includes("oklch")) {
      node.style.textShadow = "none";
    }
    if (computed.backgroundImage.includes("oklch")) {
      node.style.backgroundImage = "none";
    }
  }
}

function inlineCaptureStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const targetElement = target as HTMLElement;
  const styleTarget = (target as HTMLElement | SVGElement).style;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  const normalizeColor = (value: string) => {
    if (!context || !value) return value;
    context.fillStyle = "#000000";
    context.fillStyle = value;
    return context.fillStyle;
  };

  const sanitizePropertyValue = (property: string, value: string) => {
    if (!value.includes("oklch")) return value;

    const lowerProperty = property.toLowerCase();
    if (
      lowerProperty === "color" ||
      lowerProperty.endsWith("-color") ||
      ["fill", "stroke", "stop-color", "flood-color", "lighting-color"].includes(lowerProperty)
    ) {
      return normalizeColor(value);
    }

    if (
      lowerProperty.includes("shadow") ||
      lowerProperty === "background-image" ||
      lowerProperty === "background" ||
      lowerProperty === "outline" ||
      lowerProperty.startsWith("border-image")
    ) {
      return lowerProperty.includes("shadow") ? "none" : "initial";
    }

    if (lowerProperty.startsWith("border")) {
      return value.replace(/oklch\([^)]+\)/g, normalizeColor("rgba(0,0,0,0)"));
    }

    return value;
  };

  styleTarget.cssText = "";
  for (const property of Array.from(computed)) {
    const value = computed.getPropertyValue(property);
    const priority = computed.getPropertyPriority(property);
    const sanitizedValue = sanitizePropertyValue(property, value);
    styleTarget.setProperty(property, sanitizedValue, priority);
  }

  targetElement.removeAttribute("class");

  if (target instanceof SVGElement) {
    const svgComputed = window.getComputedStyle(source);
    const fill = svgComputed.getPropertyValue("fill");
    const stroke = svgComputed.getPropertyValue("stroke");
    if (fill) styleTarget.setProperty("fill", sanitizePropertyValue("fill", fill));
    if (stroke) styleTarget.setProperty("stroke", sanitizePropertyValue("stroke", stroke));
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  for (let index = 0; index < sourceChildren.length; index += 1) {
    const sourceChild = sourceChildren[index];
    const targetChild = targetChildren[index];
    if (sourceChild && targetChild) {
      inlineCaptureStyles(sourceChild, targetChild);
    }
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatIstDateTime(value: string) {
  const date = new Date(value);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${formatted} IST`;
}

function formatFilenameDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function scoreColor(score: number) {
  if (score >= 90) return "text-emerald-700";
  if (score >= 75) return "text-blue-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

function buildTierExplorerHref(orgSlug: string, tier: string) {
  return `/app/${orgSlug}/explore?pqcTier=${tier}`;
}

function buildSupportExplorerHref(orgSlug: string, supported: boolean) {
  return `/app/${orgSlug}/explore?pqcSupported=${supported ? "true" : "false"}`;
}

function ReportToggleCard({
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

function ProgressMeter({ score, status }: { score: number; status: string }) {
  const pointerAngle = Math.max(-90, Math.min(90, -90 + (score / 100) * 180));
  const tierMeta = getTierMeta(score >= 90 ? "A" : score >= 75 ? "B" : score >= 50 ? "C" : "D");

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-32 w-52">
        <svg className="h-full w-full overflow-visible drop-shadow-sm" viewBox="0 0 200 110">
          <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#ef4444" strokeWidth="22" strokeLinecap="round" />
          <path d="M 100 20 A 80 80 0 0 1 156.56 43.43" fill="none" stroke="#f59e0b" strokeWidth="22" />
          <path d="M 156.56 43.43 A 80 80 0 0 1 176.08 75.27" fill="none" stroke="#3b82f6" strokeWidth="22" />
          <path d="M 176.08 75.27 A 80 80 0 0 1 180 100" fill="none" stroke="#10b981" strokeWidth="22" strokeLinecap="round" />
          <g transform={`translate(100, 100) rotate(${pointerAngle})`}>
            <path d="M -4 0 L 0 -72 L 4 0 Z" fill="#3d200a" />
            <circle cx="0" cy="0" r="8" fill="#3d200a" />
            <circle cx="0" cy="0" r="3" fill="#ffffff" />
          </g>
        </svg>
      </div>
      <div className="-mt-1 text-center">
        <p className="text-[2.4rem] font-black leading-none text-[#3d200a]">{score}</p>
        <p className={cn("mt-1 text-[12px] font-semibold", tierMeta.textClass)}>{status}</p>
      </div>
    </div>
  );
}

function ReportPageShell({
  orgName,
  generatedAt,
  eyebrow,
  title,
  subtitle,
  pageNumber,
  totalPages,
  children,
}: {
  orgName: string;
  generatedAt: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  pageNumber: number;
  totalPages: number;
  children: ReactNode;
}) {
  return (
    <section
      data-report-page="true"
      className="overflow-hidden rounded-[18px] border border-[#e3d1b5] bg-[#fffdf8] text-[#3d200a] shadow-[0_12px_32px_rgba(85,40,12,0.1)]"
      style={{ width: REPORT_PAGE_WIDTH, height: REPORT_PAGE_HEIGHT }}
    >
      <div className="flex h-full flex-col px-10 pb-8 pt-8">
        <header className="flex items-center justify-between gap-6 border-b border-[#8a5d33]/10 pb-4">
          <p className="text-[15px] font-black tracking-tight text-[#8B0000]">QuantWarden</p>
          <p className="text-sm font-semibold text-[#8a5d33]">{orgName}</p>
        </header>
        <div className="flex-1 pt-5">
          <div className="mb-5">
            <p className="text-[12px] font-semibold text-[#8a5d33]/75">{eyebrow}</p>
            <h3 className="mt-2 text-[28px] font-black tracking-tight text-[#3d200a]">{title}</h3>
            {subtitle ? <p className="mt-2 max-w-[35rem] text-sm font-medium leading-6 text-[#8a5d33]">{subtitle}</p> : null}
          </div>
          {children}
        </div>
        <footer className="mt-5 flex items-center justify-between border-t border-[#8a5d33]/10 pt-4 text-[11px] font-semibold text-[#8a5d33]/60">
          <span>{`Pg ${pageNumber} / ${totalPages}`}</span>
          <span>{formatIstDateTime(generatedAt)}</span>
        </footer>
      </div>
    </section>
  );
}

function ReportSectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-[#e3d1b5] bg-white p-5">
      <div>
        <p className="text-[17px] font-bold text-[#3d200a]">{title}</p>
        {description ? <p className="mt-1 text-sm leading-6 text-[#8a5d33]">{description}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryTable({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode; tone?: string; helper?: string }>;
}) {
  return (
    <div className="divide-y divide-[#8a5d33]/10">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[220px_minmax(0,1fr)] gap-4 py-3 first:pt-0 last:pb-0">
          <div>
            <p className="text-sm font-semibold text-[#3d200a]">{row.label}</p>
            {row.helper ? <p className="mt-1 text-xs leading-5 text-[#8a5d33]/75">{row.helper}</p> : null}
          </div>
          <div className={cn("text-right text-sm font-semibold text-[#3d200a]", row.tone)}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function NarrativeList({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${index}-${item}`} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
          <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[#8B0000]" />
          <p className="text-sm leading-7 text-[#3d200a]">{item}</p>
        </div>
      ))}
    </div>
  );
}

function ExplorerLinkLine({
  href,
  label = "Open the full filtered list in Asset Explorer",
}: {
  href: string;
  label?: string;
}) {
  return (
    <div className="border-t border-[#8a5d33]/10 pt-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a5d33]/70">{label}</p>
      <a href={href} className="mt-2 block break-all text-sm font-semibold text-[#8B0000] underline decoration-[#8B0000]/30 underline-offset-4">
        {href}
      </a>
    </div>
  );
}

function CompactMetricRows({
  rows,
}: {
  rows: Array<{ label: string; helper?: string; value: number; tone: "emerald" | "blue" | "amber" | "red" }>;
}) {
  return (
    <div className="divide-y divide-[#8a5d33]/10">
      {rows.map((row) => {
        const tone = getToneMeta(row.tone);
        return (
          <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_100px] gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone.accent }} />
                <p className="text-sm font-semibold text-[#3d200a]">{row.label}</p>
              </div>
              {row.helper ? <p className="mt-1 pl-[18px] text-xs leading-5 text-[#8a5d33]/75">{row.helper}</p> : null}
            </div>
            <p className={cn("text-right text-[28px] font-black leading-none", tone.textClass)}>{row.value}</p>
          </div>
        );
      })}
    </div>
  );
}

function CompactAssetTable({
  assets,
  emptyLabel,
}: {
  assets: ReportAssetEntry[];
  emptyLabel: string;
}) {
  return assets.length === 0 ? (
    <div className="rounded-[10px] border border-dashed border-[#8a5d33]/15 px-4 py-5 text-sm font-semibold text-[#8a5d33]/75">
      {emptyLabel}
    </div>
  ) : (
    <div>
      <div className="grid grid-cols-[minmax(0,1.35fr)_1fr_72px_58px] gap-3 border-b border-[#8a5d33]/10 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a5d33]/70">
        <span>Asset</span>
        <span>Key exchange</span>
        <span className="text-right">Score</span>
        <span className="text-right">Tier</span>
      </div>
      <div className="divide-y divide-[#8a5d33]/10">
        {assets.map((asset) => (
          <div key={asset.id} className="grid grid-cols-[minmax(0,1.35fr)_1fr_72px_58px] gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#3d200a]">{asset.value}</p>
              <p className="mt-1 text-xs text-[#8a5d33]/75">{asset.primaryEncryption || "Encryption not captured"}</p>
            </div>
            <p className="text-xs leading-5 text-[#8a5d33]">{asset.primaryKeyExchange || "Not captured"}</p>
            <p className={cn("text-right text-lg font-black", scoreColor(asset.averageScore))}>{asset.averageScore}</p>
            <p className="text-right text-sm font-semibold text-[#8a5d33]">{asset.tier}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  helper,
  value,
  tone,
}: {
  label: string;
  helper: string;
  value: number;
  tone: "emerald" | "blue" | "amber" | "red";
}) {
  const toneMeta = getToneMeta(tone);
  return (
    <div className={cn("rounded-[12px] border p-4", toneMeta.borderClass, toneMeta.bgClass)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#3d200a]">{label}</p>
          <p className="mt-2 text-xs font-medium leading-5 text-[#8a5d33]/80">{helper}</p>
        </div>
        <p className={cn("shrink-0 text-3xl font-black", toneMeta.textClass)}>{value}</p>
      </div>
    </div>
  );
}

function HorizontalBars({
  title,
  rows,
}: {
  title?: string;
  rows: Array<{ label: string; value: number; color: string }>;
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div>
      {title ? <p className="text-base font-semibold text-[#3d200a]">{title}</p> : null}
      <div className={cn("space-y-4", title ? "mt-5" : "")}>
        {rows.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#8a5d33]/15 bg-[#fffaf1] px-4 py-5 text-sm font-semibold text-[#8a5d33]/75">
            No data captured yet.
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-black text-[#3d200a]">{row.label}</p>
                <p className="text-sm font-black text-[#8B0000]">{row.value}</p>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#f7ead7]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(10, Math.round((row.value / maxValue) * 100))}%`,
                    background: row.color,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SplitBar({
  title,
  helper,
  leftLabel,
  leftValue,
  leftColor,
  rightLabel,
  rightValue,
  rightColor,
}: {
  title?: string;
  helper?: string;
  leftLabel: string;
  leftValue: number;
  leftColor: string;
  rightLabel: string;
  rightValue: number;
  rightColor: string;
}) {
  const total = leftValue + rightValue;
  const leftPercent = total > 0 ? (leftValue / total) * 100 : 0;
  const rightPercent = total > 0 ? 100 - leftPercent : 0;

  return (
    <div>
      {title || helper ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            {title ? <p className="text-base font-semibold text-[#3d200a]">{title}</p> : null}
            {helper ? <p className="mt-2 text-sm font-semibold text-[#8a5d33]">{helper}</p> : null}
          </div>
        </div>
      ) : null}
      <div className={cn("overflow-hidden rounded-full bg-[#f7ead7]", title || helper ? "mt-5" : "")}>
        <div className="flex h-6">
          <div style={{ width: `${leftPercent}%`, background: leftColor }} />
          <div style={{ width: `${rightPercent}%`, background: rightColor }} />
        </div>
      </div>
      <div className="mt-4 divide-y divide-[#8a5d33]/10">
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] gap-4 py-3 first:pt-0">
          <p className="text-sm font-semibold text-emerald-700">{leftLabel}</p>
          <p className="text-right text-lg font-black text-emerald-700">{leftValue}</p>
          <p className="text-right text-sm font-medium text-[#8a5d33]/70">{Math.round(leftPercent)}%</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] gap-4 py-3 last:pb-0">
          <p className="text-sm font-semibold text-red-700">{rightLabel}</p>
          <p className="text-right text-lg font-black text-red-700">{rightValue}</p>
          <p className="text-right text-sm font-medium text-[#8a5d33]/70">{Math.round(rightPercent)}%</p>
        </div>
      </div>
    </div>
  );
}

function TierDistributionGraphic({ buckets }: { buckets: ReportTierBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div>
      <div className="overflow-hidden rounded-full bg-[#f7ead7]">
        <div className="flex h-6 w-full">
          {buckets.map((bucket) => {
            const meta = getTierMeta(bucket.tier);
            const width = total > 0 ? Math.max((bucket.count / total) * 100, bucket.count > 0 ? 8 : 0) : 0;
            return <div key={bucket.tier} style={{ width: `${width}%`, background: meta.accent }} />;
          })}
        </div>
      </div>
      <div className="mt-4 divide-y divide-[#8a5d33]/10">
        {buckets.map((bucket) => {
          const meta = getTierMeta(bucket.tier);
          return (
            <div key={bucket.tier} className="grid grid-cols-[92px_minmax(0,1fr)_68px_68px] items-center gap-4 py-3 first:pt-0 last:pb-0">
              <p className={cn("text-sm font-black", meta.textClass)}>{bucket.label}</p>
              <p className="text-sm text-[#8a5d33]">{bucket.status}</p>
              <p className={cn("text-right text-lg font-black", meta.textClass)}>{bucket.count}</p>
              <p className="text-right text-sm font-medium text-[#8a5d33]/70">{bucket.percent}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniAssetList({
  title,
  assets,
  tone,
  emptyLabel,
}: {
  title: string;
  assets: ReportAssetEntry[];
  tone: "emerald" | "red";
  emptyLabel: string;
}) {
  const meta = getToneMeta(tone);

  return (
    <div className={cn("rounded-[12px] border p-5", meta.borderClass, meta.bgClass)}>
      <p className={cn("text-base font-semibold", meta.textClass)}>{title}</p>
      <div className="mt-4 space-y-3">
        {assets.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#8a5d33]/15 bg-white/65 px-4 py-5 text-sm font-semibold text-[#8a5d33]/75">
            {emptyLabel}
          </div>
        ) : (
          assets.map((asset) => (
            <div key={asset.id} className="rounded-[10px] border border-white/70 bg-white/85 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#3d200a]">{asset.value}</p>
                  <p className="mt-1 text-xs font-semibold text-[#8a5d33]/75">{asset.primaryKeyExchange || "No key exchange detail"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("text-lg font-black", scoreColor(asset.averageScore))}>{asset.averageScore}</p>
                  <p className="text-[11px] font-medium text-[#8a5d33]/60">{asset.tier}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AttentionColumns({ buckets }: { buckets: ReportImmediateAttentionBucket[] }) {
  return (
    <div className="grid flex-1 grid-cols-2 gap-4">
      {buckets.map((bucket) => {
        const toneMeta = getToneMeta(bucket.tone);
        return (
          <div key={bucket.key} className={cn("flex min-h-0 flex-col rounded-[12px] border p-5", toneMeta.borderClass, toneMeta.bgClass, bucket.key === "tls" ? "col-span-2" : "")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={cn("text-base font-semibold", toneMeta.textClass)}>{bucket.label}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#8a5d33]">{bucket.description}</p>
              </div>
              <p className={cn("text-3xl font-black", toneMeta.textClass)}>{bucket.count}</p>
            </div>
            <div className="mt-5 space-y-3">
              {bucket.assets.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[#8a5d33]/15 bg-white/70 px-4 py-5 text-sm font-semibold text-[#8a5d33]/75">
                  No issues surfaced in this bucket.
                </div>
              ) : (
                bucket.assets.map((asset) => (
                  <div key={`${bucket.key}-${asset.id}-${asset.issue}`} className="rounded-[10px] border border-white/70 bg-white/82 px-4 py-3">
                    <p className="text-sm font-black text-[#3d200a]">{asset.name}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#8a5d33]/80">{asset.issue}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssetTierTable({
  bucket,
  chunk,
  chunkIndex,
  totalChunks,
}: {
  bucket: ReportTierBucket;
  chunk: ReportAssetEntry[];
  chunkIndex: number;
  totalChunks: number;
}) {
  const tierMeta = getTierMeta(bucket.tier);

  return (
    <div className="flex h-full flex-col">
      <div className={cn("rounded-[12px] border p-5", tierMeta.borderClass, tierMeta.bgClass)}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={cn("text-base font-semibold", tierMeta.textClass)}>{bucket.label}</p>
            <h4 className="mt-2 text-2xl font-black text-[#3d200a]">{bucket.status} asset rollup</h4>
            <p className="mt-2 text-sm font-semibold text-[#8a5d33]">
              Page {chunkIndex + 1} of {totalChunks} for this tier, ordered by current posture score.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn("text-4xl font-black", tierMeta.textClass)}>{bucket.count}</p>
            <p className="text-[11px] font-medium text-[#8a5d33]/60">Assets</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex-1 rounded-[12px] border border-[#e3d1b5] bg-white p-4">
        <div className="grid grid-cols-[minmax(0,1.8fr)_96px_1.2fr_1.15fr_88px] gap-3 border-b border-[#8a5d33]/10 px-3 pb-3 text-[11px] font-semibold text-[#8a5d33]/75">
          <span>Asset</span>
          <span className="text-right">Score</span>
          <span>Key exchange</span>
          <span>Encryption</span>
          <span className="text-right">Ports</span>
        </div>
        <div className="divide-y divide-[#8a5d33]/10">
          {chunk.map((asset) => (
            <div key={asset.id} className="grid grid-cols-[minmax(0,1.8fr)_96px_1.2fr_1.15fr_88px] gap-3 px-3 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#3d200a]">{asset.value}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f7ead7]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(8, asset.averageScore)}%`,
                      background: tierMeta.accent,
                    }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className={cn("text-xl font-black", scoreColor(asset.averageScore))}>{asset.averageScore}</p>
                <p className="text-[11px] font-medium text-[#8a5d33]/60">{asset.tier}</p>
              </div>
              <p className="text-xs font-semibold leading-5 text-[#8a5d33]">{asset.primaryKeyExchange || "Not captured"}</p>
              <p className="text-xs font-semibold leading-5 text-[#8a5d33]">{asset.primaryEncryption || "Not captured"}</p>
              <div className="text-right">
                <p className="text-lg font-black text-[#3d200a]">{asset.portCount}</p>
                <p className="text-[11px] font-medium text-[#8a5d33]/60">
                  {asset.supportsPqc ? "PQC" : "Classical"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyStateCard({ orgName }: { orgName: string }) {
  return (
    <div className="rounded-[28px] border border-amber-500/15 bg-[#fff8eb] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#8B0000]" />
        <div>
          <p className="text-sm font-black text-[#3d200a]">No scored PQC assets yet</p>
          <p className="mt-2 text-sm font-medium leading-6 text-[#8a5d33]">
            {orgName} does not have enough completed OpenSSL results yet to build the full posture report. The PDF can still be generated, but it will describe current coverage and the lack of scored assets.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReportingPdfBuilder({ org, canConfigure }: ReportingPdfBuilderProps) {
  const [data, setData] = useState<OrganizationReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pdfHeading, setPdfHeading] = useState(org.name || "Organization Report");
  const [pdfSubtitle, setPdfSubtitle] = useState(
    "Executive and technical summary of current TLS and post-quantum readiness posture."
  );
  const [sections, setSections] = useState<Record<ReportSectionKey, boolean>>(DEFAULT_REPORT_SECTIONS);
  const exportRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/orgs/reporting?orgId=${org.id}`);
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to fetch reporting data");
        }
        if (!cancelled) {
          setData(result);
        }
      } catch (fetchError: any) {
        if (!cancelled) {
          setError(fetchError.message || "Failed to fetch reporting data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchReportData();
    return () => {
      cancelled = true;
    };
  }, [org.id]);

  const enabledSections = useMemo(
    () => REPORT_SECTION_META.filter((section) => sections[section.key]),
    [sections]
  );

  const pageDescriptors = useMemo(() => {
    if (!data) return [];

    const descriptors: Array<{
      key: string;
      eyebrow: string;
      title: string;
      subtitle?: string;
      content: ReactNode;
    }> = [];

    const topTlsRows = data.overview.tlsVersionMix.slice(0, 5).map((row) => ({
      label: row.name,
      value: row.value,
      color:
        row.name === "TLSv1.3"
          ? "#10b981"
          : row.name === "TLSv1.2"
            ? "#3b82f6"
            : row.name === "TLSv1.1"
              ? "#f59e0b"
            : "#ef4444",
    }));

    const executiveSummaryRows = [
      { label: "Organization", value: data.organization.name },
      { label: "Generated", value: formatDateTime(data.generatedAt) },
      { label: "Scored assets", value: data.coverage.totalAssetsScored, tone: "text-blue-700" },
      { label: "Scored ports", value: data.coverage.totalPortsScored, tone: "text-amber-700" },
      { label: "Reachable TLS endpoints", value: data.coverage.reachableTlsEndpoints, tone: "text-emerald-700" },
      { label: "Current PQC tier", value: data.pqc.tier === "Pending" ? "Pending" : `Tier ${data.pqc.tier}` },
      { label: "Current posture", value: data.pqc.status },
      { label: "Average score", value: `${data.pqc.averageScore}/100`, tone: scoreColor(data.pqc.averageScore) },
    ];

    if (sections.executiveSummary) {
      const includedLabels = enabledSections.map((section) => section.label);
      descriptors.push({
        key: "executive-summary",
        eyebrow: "Quantum Readiness Report",
        title: pdfHeading || org.name,
        subtitle: pdfSubtitle,
        content: (
          <div className="space-y-5">
            <ReportSectionBlock title="Report context" description="Current coverage and posture headline for the organization.">
              <SummaryTable rows={executiveSummaryRows} />
            </ReportSectionBlock>

            <ReportSectionBlock title="Organization PQC posture" description="Current average score across the latest scored TLS ports.">
              <div className="flex flex-col items-center justify-center py-2">
                <ProgressMeter score={data.pqc.averageScore} status={data.pqc.status} />
                <p className="mt-2 text-sm leading-6 text-[#8a5d33]">
                  {data.pqc.tier === "Pending"
                    ? "The organization does not yet have enough valid scored ports to assign a stable readiness tier."
                    : `The current posture is assessed as ${getTierStatus(data.pqc.tier)}. This is a current-state indicator based on the most recent scored scan results.`}
                </p>
              </div>
            </ReportSectionBlock>

            <ReportSectionBlock title="Key findings" description="The most important current observations from the latest scan set.">
              <NarrativeList items={data.summaryHighlights} />
            </ReportSectionBlock>

            <ReportSectionBlock title="Sections included in this report">
              <p className="text-sm leading-7 text-[#3d200a]">{includedLabels.join(" • ")}</p>
            </ReportSectionBlock>

            {data.coverage.totalAssetsScored === 0 ? <EmptyStateCard orgName={org.name} /> : null}
          </div>
        ),
      });
    }

    if (sections.securityOverview) {
      descriptors.push({
        key: "security-overview",
        eyebrow: "Security Overview",
        title: "TLS and certificate posture from current organization scans",
        subtitle: "A simple scan-derived summary of coverage, protocol versions, and certificate risk concentration.",
        content: (
          <div className="space-y-5">
            <ReportSectionBlock title="Overview metrics">
              <CompactMetricRows rows={data.overview.metrics} />
            </ReportSectionBlock>

            <ReportSectionBlock title="Latest TLS version mix" description="Observed distribution of latest protocol versions across current scanned endpoints.">
              <HorizontalBars rows={topTlsRows} />
            </ReportSectionBlock>

            <ReportSectionBlock title="Certificate health" description="Current certificate risk concentration based on expiration and validation status.">
              <HorizontalBars
                rows={data.overview.certificateHealth.map((row) => ({
                  label: row.label,
                  value: row.value,
                  color: getToneMeta(row.tone).accent,
                }))}
              />
            </ReportSectionBlock>

            <ReportSectionBlock title="Operational indicators">
              <SummaryTable
                rows={[
                  { label: "Weak ciphers", value: data.overview.weakCipherCount, tone: "text-amber-700" },
                  { label: "Self-signed certificates", value: data.overview.selfSignedCount, tone: "text-red-700" },
                  { label: "Endpoints without TLS 1.3", value: data.overview.tlsDowngradeVulnerable, tone: "text-blue-700" },
                  { label: "Total assets in scope", value: data.coverage.totalAssets },
                ]}
              />
            </ReportSectionBlock>
          </div>
        ),
      });
    }

    if (sections.pqcPosture) {
      descriptors.push({
        key: "pqc-posture",
        eyebrow: "PQC Posture",
        title: "Organization readiness score",
        subtitle: "The score blends key exchange, symmetric encryption, protocol version, and certificate authentication posture across the latest scored ports.",
        content: (
          <div className="space-y-5">
            <ReportSectionBlock title="Current rating" description="Current readiness posture derived from the latest scored PQC scan set.">
              <div className="flex flex-col items-center justify-center py-2">
                <ProgressMeter score={data.pqc.averageScore} status={data.pqc.status} />
              </div>
            </ReportSectionBlock>

            <ReportSectionBlock title="Score interpretation">
              <SummaryTable
                rows={[
                  { label: "Tier", value: data.pqc.tier === "Pending" ? "Pending" : `Tier ${data.pqc.tier}` },
                  { label: "Meaning", value: data.pqc.status },
                  { label: "Scored assets", value: data.coverage.totalAssetsScored, tone: "text-blue-700" },
                  { label: "Scored ports", value: data.coverage.totalPortsScored, tone: "text-amber-700" },
                  { label: "PQC supported assets", value: data.pqcSupport[0]?.count || 0, tone: "text-emerald-700" },
                  { label: "Negotiated ML-KEM", value: data.pqcSupport[0]?.negotiatedCount || 0, tone: "text-blue-700" },
                  { label: "Assets needing uplift", value: data.pqcSupport[1]?.count || 0, tone: "text-red-700" },
                ]}
              />
            </ReportSectionBlock>

            <ReportSectionBlock title="Interpretation note">
              <p className="text-sm leading-7 text-[#3d200a]">
                This score is an organizational summary rather than a control attestation. It reflects currently observed endpoint behavior and certificate posture on the latest successful scan set. Detailed tier distribution and asset-level follow-up appear in later sections.
              </p>
            </ReportSectionBlock>
          </div>
        ),
      });
    }

    if (sections.tierMethodology) {
      descriptors.push({
        key: "tier-methodology",
        eyebrow: "Tier rules and meanings",
        title: "How the PQC tiers are interpreted in this report",
        subtitle: "This brief explains the score bands, the meaning of each tier, and the evaluation pillars behind the organization posture score.",
        content: (
          <div className="space-y-5">
            <ReportSectionBlock title="Tier score bands">
              <div className="mt-4 divide-y divide-[#8a5d33]/10">
                {REPORT_TIER_BANDS.map((band) => {
                  const meta = getTierMeta(band.tier);
                  return (
                    <div key={band.tier} className="grid grid-cols-[78px_92px_150px_minmax(0,1fr)] gap-4 py-3 first:pt-0 last:pb-0">
                      <p className={cn("text-sm font-black", meta.textClass)}>{`Tier ${band.tier}`}</p>
                      <p className="text-sm font-semibold text-[#8a5d33]">{band.scoreRange}</p>
                      <p className="text-sm font-semibold text-[#3d200a]">{band.meaning}</p>
                      <p className="text-sm leading-6 text-[#8a5d33]">{band.guidance}</p>
                    </div>
                  );
                })}
              </div>
            </ReportSectionBlock>

            <ReportSectionBlock title="Scoring pillars">
              <div className="mt-4 divide-y divide-[#8a5d33]/10">
                {REPORT_SCORING_PILLARS.map((pillar) => (
                  <div key={pillar.label} className="grid grid-cols-[220px_92px_minmax(0,1fr)] gap-4 py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold text-[#3d200a]">{pillar.label}</p>
                    <p className="text-sm font-black text-[#8B0000]">{pillar.weight}</p>
                    <p className="text-sm leading-6 text-[#8a5d33]">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </ReportSectionBlock>

            <ReportSectionBlock title="Practical reading note">
              <p className="mt-4 text-sm leading-7 text-[#8a5d33]">
                Tier distribution pages show where the estate currently sits. Assets by tier pages show what to work on next. Supported posture indicates ML-KEM-capable groups are present, while negotiated posture indicates they are actually being used in the observed handshake path.
              </p>
            </ReportSectionBlock>
          </div>
        ),
      });
    }

    if (sections.tierDistribution) {
      descriptors.push({
        key: "tier-distribution",
        eyebrow: "Tier Distribution",
        title: "PQC score distribution across scored assets",
        subtitle: "Asset counts and coverage split by readiness tier so teams can see where remediation pressure is concentrated.",
        content: (
          <div className="space-y-5">
            <ReportSectionBlock title="Distribution overview" description="Tier mix across all currently scored assets.">
              <TierDistributionGraphic buckets={data.tierDistribution} />
            </ReportSectionBlock>

            <ReportSectionBlock title="Tier summary">
              <div className="mt-4 divide-y divide-[#8a5d33]/10">
                {REPORT_TIER_ORDER.map((tier) => {
                  const bucket = data.tierDistribution.find((entry) => entry.tier === tier);
                  const meta = getTierMeta(tier);
                  return (
                    <div key={tier} className="grid grid-cols-[88px_150px_1fr_72px_72px] items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <p className={cn("text-sm font-black", meta.textClass)}>{`Tier ${tier}`}</p>
                      <p className="text-sm font-semibold text-[#3d200a]">{getTierStatus(tier)}</p>
                      <div className="h-3 overflow-hidden rounded-full bg-[#f7ead7]">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(8, bucket?.percent || 0)}%`, background: meta.accent }} />
                      </div>
                      <p className="text-right text-lg font-black text-[#3d200a]">{bucket?.count || 0}</p>
                      <p className="text-right text-sm font-medium text-[#8a5d33]/70">{bucket?.percent || 0}%</p>
                    </div>
                  );
                })}
              </div>
            </ReportSectionBlock>

            <ReportSectionBlock title="Coverage note">
              <p className="mt-4 text-sm leading-7 text-[#8a5d33]">
                Distribution percentages are based on scored assets only. Assets without valid current OpenSSL posture data are excluded from the PQC tier mix until they are rescanned. Detailed follow-up is listed separately in the assets by tier pages.
              </p>
            </ReportSectionBlock>
          </div>
        ),
      });
    }

    if (sections.pqcSupport) {
      descriptors.push({
        key: "pqc-support-summary",
        eyebrow: "PQC Support Split",
        title: "Supported versus unsupported ML-KEM posture",
        subtitle: "A current-state split of scored assets that already expose ML-KEM-compatible groups versus those that still do not.",
        content: (
          <div className="space-y-5">
            <ReportSectionBlock title="Support split">
              <SplitBar
                helper="Current scored asset mix across supported and unsupported posture."
                leftLabel={data.pqcSupport[0]?.label || "Supported"}
                leftValue={data.pqcSupport[0]?.count || 0}
                leftColor="#10b981"
                rightLabel={data.pqcSupport[1]?.label || "Unsupported"}
                rightValue={data.pqcSupport[1]?.count || 0}
                rightColor="#ef4444"
              />
            </ReportSectionBlock>

            <ReportSectionBlock title="Support interpretation">
              <div className="mt-4 divide-y divide-[#8a5d33]/10">
                {data.pqcSupport.map((bucket) => {
                  const tone = bucket.key === "supported" ? getToneMeta("emerald") : getToneMeta("red");
                  return (
                    <div key={bucket.key} className="grid grid-cols-[170px_minmax(0,1fr)_76px_70px] gap-4 py-3 first:pt-0 last:pb-0">
                      <p className={cn("text-sm font-semibold", tone.textClass)}>{bucket.label}</p>
                      <p className="text-sm leading-6 text-[#8a5d33]">
                        {bucket.description}
                        {bucket.key === "supported" ? ` ${bucket.negotiatedCount} of these assets actively negotiated ML-KEM on the latest scans.` : ""}
                      </p>
                      <p className={cn("text-right text-xl font-black", tone.textClass)}>{bucket.count}</p>
                      <p className="text-right text-sm font-medium text-[#8a5d33]/70">{bucket.percent}%</p>
                    </div>
                  );
                })}
              </div>
            </ReportSectionBlock>
          </div>
        ),
      });

      descriptors.push({
        key: "pqc-support-examples",
        eyebrow: "PQC Support Split",
        title: "Representative assets for ML-KEM support posture",
        subtitle: "Top 5 examples from each support state. Use the listed explorer filters to review the complete asset sets.",
        content: (
          <div className="space-y-5">
            <ReportSectionBlock title="Top 5 supported examples">
              <CompactAssetTable
                assets={data.pqcSupport[0]?.assets.slice(0, 5) || []}
                emptyLabel="No scored assets currently advertise ML-KEM support."
              />
              <div className="mt-4">
                <ExplorerLinkLine href={buildSupportExplorerHref(data.organization.slug, true)} />
              </div>
            </ReportSectionBlock>

            <ReportSectionBlock title="Top 5 unsupported examples">
              <CompactAssetTable
                assets={data.pqcSupport[1]?.assets.slice(0, 5) || []}
                emptyLabel="No unsupported scored assets are currently present."
              />
              <div className="mt-4">
                <ExplorerLinkLine href={buildSupportExplorerHref(data.organization.slug, false)} />
              </div>
            </ReportSectionBlock>
          </div>
        ),
      });
    }

    if (sections.immediateAttention) {
      descriptors.push({
        key: "immediate-attention",
        eyebrow: "Immediate Attention",
        title: "Current issues surfaced from the latest scan set",
        subtitle: "Prioritized groups of DNS, certificate, and TLS issues that should be addressed first.",
        content: (
          <div className="space-y-5">
            <ReportSectionBlock title="Issue summary">
              <div className="mt-4 divide-y divide-[#8a5d33]/10">
                {data.immediateAttention.map((bucket) => {
                  const toneMeta = getToneMeta(bucket.tone);
                  return (
                    <div key={bucket.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className={cn("text-sm font-semibold", toneMeta.textClass)}>{bucket.label}</p>
                        <p className="text-sm text-[#8a5d33]">{bucket.description}</p>
                      </div>
                      <p className={cn("text-2xl font-black", toneMeta.textClass)}>{bucket.count}</p>
                    </div>
                  );
                })}
              </div>
            </ReportSectionBlock>

            <ReportSectionBlock title="Representative issues" description="Examples from the highest-priority findings in the current scan set.">
              <div className="space-y-5">
                {data.immediateAttention.map((bucket) => {
                  const toneMeta = getToneMeta(bucket.tone);
                  return (
                    <div key={bucket.key} className="border-b border-[#8a5d33]/10 pb-4 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className={cn("text-sm font-semibold", toneMeta.textClass)}>{bucket.label}</p>
                          <p className="mt-1 text-xs leading-5 text-[#8a5d33]/75">{bucket.description}</p>
                        </div>
                        <p className={cn("text-xl font-black", toneMeta.textClass)}>{bucket.count}</p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {bucket.assets.slice(0, 3).length === 0 ? (
                          <p className="text-sm text-[#8a5d33]/75">No issues surfaced in this category.</p>
                        ) : (
                          bucket.assets.slice(0, 3).map((asset) => (
                            <div key={`${bucket.key}-${asset.id}-${asset.issue}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 py-1">
                              <p className="truncate text-sm font-semibold text-[#3d200a]">{asset.name}</p>
                              <p className="text-sm leading-6 text-[#8a5d33]">{asset.issue}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ReportSectionBlock>
          </div>
        ),
      });
    }

    if (sections.tierAssets) {
      const actionableBuckets = data.tierDistribution
        .filter((bucket) => bucket.count > 0)
        .sort((left, right) => REPORT_ACTION_TIER_ORDER.indexOf(left.tier) - REPORT_ACTION_TIER_ORDER.indexOf(right.tier));

      actionableBuckets.forEach((bucket) => {
        descriptors.push({
          key: `tier-assets-${bucket.tier}`,
          eyebrow: "Assets By Tier",
          title: `${bucket.label} assets`,
          subtitle: `Top 5 current examples in ${bucket.label}. Use the explorer filter below for the complete list.`,
          content: (
            <div className="space-y-5">
              <ReportSectionBlock title="Tier snapshot">
                <SummaryTable
                  rows={[
                    { label: "Tier", value: `Tier ${bucket.tier}` },
                    { label: "Meaning", value: bucket.status },
                    { label: "Assets in this tier", value: bucket.count, tone: getTierMeta(bucket.tier).textClass },
                    { label: "Share of scored assets", value: `${bucket.percent}%` },
                  ]}
                />
              </ReportSectionBlock>

              <ReportSectionBlock title="Top 5 assets in this tier">
                <CompactAssetTable
                  assets={bucket.assets.slice(0, 5)}
                  emptyLabel="No assets are currently present in this tier."
                />
              </ReportSectionBlock>

              <ReportSectionBlock title="Asset Explorer filter">
                <ExplorerLinkLine href={buildTierExplorerHref(data.organization.slug, bucket.tier)} />
              </ReportSectionBlock>
            </div>
          ),
        });
      });
    }

    return descriptors;
  }, [data, enabledSections, org.name, pdfHeading, pdfSubtitle, sections]);

  const previewPages = pageDescriptors.slice(0, 2);

  const handleDownload = async () => {
    const exportRoot = exportRootRef.current;
    if (!exportRoot || pageDescriptors.length === 0) return;

    setGenerating(true);
    setError(null);
    try {
      const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      await Promise.allSettled([
        document.fonts?.ready ?? Promise.resolve(),
        new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined))),
        new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined))),
      ]);

      const pageNodes = Array.from(exportRoot.querySelectorAll<HTMLElement>('[data-report-page="true"]'));
      if (pageNodes.length === 0) {
        throw new Error("No report pages were available to export.");
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let index = 0; index < pageNodes.length; index += 1) {
        const pageNode = pageNodes[index];
        const captureHost = document.createElement("div");
        captureHost.setAttribute("data-report-capture", "true");
        captureHost.style.position = "fixed";
        captureHost.style.left = "0";
        captureHost.style.top = "0";
        captureHost.style.width = `${REPORT_PAGE_WIDTH}px`;
        captureHost.style.height = `${REPORT_PAGE_HEIGHT}px`;
        captureHost.style.padding = "0";
        captureHost.style.margin = "0";
        captureHost.style.opacity = "0.01";
        captureHost.style.pointerEvents = "none";
        captureHost.style.overflow = "hidden";
        captureHost.style.zIndex = "-1";
        captureHost.style.background = "#fffdf8";

        const captureNode = pageNode.cloneNode(true) as HTMLElement;
        captureNode.style.width = `${REPORT_PAGE_WIDTH}px`;
        captureNode.style.height = `${REPORT_PAGE_HEIGHT}px`;
        captureNode.style.transform = "none";
        captureNode.style.margin = "0";
        inlineCaptureStyles(pageNode, captureNode);

        captureHost.appendChild(captureNode);
        document.body.appendChild(captureHost);

        await Promise.allSettled([
          new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined))),
          new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined))),
        ]);

        normalizeCaptureColors(captureNode);

        let canvas: HTMLCanvasElement;
        try {
          canvas = await toCanvas(captureNode, {
            cacheBust: true,
            backgroundColor: "#fffdf8",
            pixelRatio: 2,
            width: REPORT_PAGE_WIDTH,
            height: REPORT_PAGE_HEIGHT,
            canvasWidth: REPORT_PAGE_WIDTH * 2,
            canvasHeight: REPORT_PAGE_HEIGHT * 2,
            skipAutoScale: true,
          });
        } finally {
          captureHost.remove();
        }

        const imageData = canvas.toDataURL("image/png", 1);
        if (index > 0) {
          pdf.addPage();
        }
        pdf.addImage(imageData, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
      }

      const filenameBase = (data?.organization.slug || org.slug || "organization-report").replace(/\s+/g, "-").toLowerCase();
      const datePart = formatFilenameDate(data?.generatedAt || new Date().toISOString());
      pdf.save(`${filenameBase}-quantum-readiness-report-${datePart}.pdf`);
    } catch (downloadError: any) {
      console.error("PDF generation failed:", downloadError);
      const message =
        typeof downloadError?.message === "string" && downloadError.message.trim()
          ? downloadError.message
          : "The PDF renderer could not capture the report pages.";
      setError(`PDF generation failed: ${message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_340px]">
      <section className="rounded-[28px] border border-white/40 bg-white/45 p-5 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Share PDF</p>
            <h2 className="mt-2 text-xl font-black text-[#3d200a]">Generate a real report from current overview and PQC posture data</h2>
            <p className="mt-2 text-sm font-medium text-[#8a5d33]/75">
              The PDF now uses live organization scan data, dashboard-style visuals, and an export-ready layout instead of placeholder content.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {!canConfigure ? (
          <div className="mt-5 rounded-3xl border border-amber-500/20 bg-[#fff7e6] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#8B0000]" />
              <div>
                <p className="text-sm font-black text-[#3d200a]">Read-only report configuration</p>
                <p className="mt-1 text-sm font-medium text-[#8a5d33]">
                  You can still review the live preview and download the generated PDF. Title and section controls stay locked for non-admin roles.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 lg:col-span-2">
            <p className="text-sm font-bold text-[#7a1f1f]">Report heading</p>
            <input
              value={pdfHeading}
              onChange={(event) => setPdfHeading(event.target.value)}
              disabled={!canConfigure}
              className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-semibold text-[#3d200a] outline-none transition placeholder:text-[#8a5d33]/45 focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <p className="text-sm font-bold text-[#7a1f1f]">Subtitle</p>
            <textarea
              value={pdfSubtitle}
              onChange={(event) => setPdfSubtitle(event.target.value)}
              disabled={!canConfigure}
              rows={3}
              className="w-full rounded-3xl border border-white/60 bg-white/80 px-4 py-3 text-sm font-semibold text-[#3d200a] outline-none transition placeholder:text-[#8a5d33]/45 focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-bold text-[#7a1f1f]">Include in the PDF</p>
          <p className="mt-1 text-sm font-medium text-[#8a5d33]/75">
            These sections control both the preview and the generated multi-page PDF.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {REPORT_SECTION_META.map((section) => (
              <ReportToggleCard
                key={section.key}
                title={section.label}
                helper={section.helper}
                active={sections[section.key]}
                disabled={!canConfigure}
                onToggle={() =>
                  setSections((current) => ({
                    ...current,
                    [section.key]: !current[section.key],
                  }))
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[28px] border border-[#8a5d33]/10 bg-[#fffaf1] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a5d33]/70">Report metadata</p>
            {loading ? (
              <div className="mt-4 flex items-center gap-3 text-sm font-semibold text-[#8a5d33]">
                <Loader2 className="h-4 w-4 animate-spin text-[#8B0000]" />
                Loading live report data...
              </div>
            ) : data ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/70 bg-white/85 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a5d33]/70">Generated</p>
                  <p className="mt-2 text-sm font-black text-[#3d200a]">{formatDateTime(data.generatedAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/85 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a5d33]/70">Estimated pages</p>
                  <p className="mt-2 text-sm font-black text-[#3d200a]">{pageDescriptors.length}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/85 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a5d33]/70">Scored assets</p>
                  <p className="mt-2 text-sm font-black text-[#3d200a]">{data.coverage.totalAssetsScored}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/85 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a5d33]/70">Scored ports</p>
                  <p className="mt-2 text-sm font-black text-[#3d200a]">{data.coverage.totalPortsScored}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-[#8B0000]/12 bg-[#8B0000] p-5 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/72">Export actions</p>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={loading || generating || pageDescriptors.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#8B0000] transition hover:bg-[#fff1dd] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {generating ? "Generating PDF..." : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  fetch(`/api/orgs/reporting?orgId=${org.id}`)
                    .then(async (response) => {
                      const result = await response.json();
                      if (!response.ok) throw new Error(result.error || "Failed to refresh reporting data");
                      setData(result);
                    })
                    .catch((refreshError: any) => setError(refreshError.message || "Failed to refresh reporting data"))
                    .finally(() => setLoading(false));
                }}
                disabled={loading || generating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/16 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                Refresh live data
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/40 bg-[#7a1f1f] p-5 text-white shadow-sm ring-1 ring-amber-500/10 xl:justify-self-end xl:w-[340px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white/72">PDF preview</p>
            <p className="mt-2 text-sm font-medium text-white/78">Actual pages that will be rendered into the downloaded PDF.</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 flex min-h-[18rem] items-center justify-center rounded-[28px] border border-white/12 bg-white/8">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-white" />
              <p className="mt-3 text-sm font-semibold text-white/78">Rendering report preview...</p>
            </div>
          </div>
        ) : pageDescriptors.length === 0 ? (
          <div className="mt-5 rounded-[28px] border border-white/12 bg-white/8 p-6 text-sm font-semibold text-white/78">
            No preview pages are selected.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {previewPages.map((descriptor, index) => (
              <div key={`preview-${descriptor.key}`} className="rounded-[28px] border border-white/12 bg-white/7 p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-white/72" />
                    <p className="text-sm font-black text-white">{descriptor.title}</p>
                  </div>
                  <p className="text-xs font-black text-white/62">
                    {index + 1} / {pageDescriptors.length}
                  </p>
                </div>
                <div
                  className="overflow-hidden rounded-[24px] shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                  style={{
                    width: REPORT_PAGE_WIDTH * PREVIEW_SCALE,
                    height: REPORT_PAGE_HEIGHT * PREVIEW_SCALE,
                  }}
                >
                  <div
                    style={{
                      width: REPORT_PAGE_WIDTH,
                      height: REPORT_PAGE_HEIGHT,
                      transform: `scale(${PREVIEW_SCALE})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <ReportPageShell
                      orgName={data?.organization.name || org.name}
                      generatedAt={data?.generatedAt || new Date().toISOString()}
                      eyebrow={descriptor.eyebrow}
                      title={descriptor.title}
                      subtitle={descriptor.subtitle}
                      pageNumber={index + 1}
                      totalPages={pageDescriptors.length}
                    >
                      {descriptor.content}
                    </ReportPageShell>
                  </div>
                </div>
              </div>
            ))}

            {pageDescriptors.length > previewPages.length ? (
              <div className="rounded-[28px] border border-white/12 bg-white/8 p-4">
                <div className="flex items-center gap-2 text-white/78">
                  <ChevronRight className="h-4 w-4" />
                  <p className="text-sm font-semibold">
                    {pageDescriptors.length - previewPages.length} additional page{pageDescriptors.length - previewPages.length > 1 ? "s" : ""} will be included in the exported PDF.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-200vw] top-0 z-[-1] opacity-100"
      >
        <div ref={exportRootRef} className="space-y-6 p-6">
          {pageDescriptors.map((descriptor, index) => (
            <ReportPageShell
              orgName={data?.organization.name || org.name}
              generatedAt={data?.generatedAt || new Date().toISOString()}
              key={`export-${descriptor.key}`}
              eyebrow={descriptor.eyebrow}
              title={descriptor.title}
              subtitle={descriptor.subtitle}
              pageNumber={index + 1}
              totalPages={pageDescriptors.length}
            >
              {descriptor.content}
            </ReportPageShell>
          ))}
        </div>
      </div>
    </div>
  );
}
