"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  Info,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Telescope,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface OrgOverviewProps {
  org: any;
  isAdmin: boolean;
}

type CountDatum = {
  name: string;
  value: number;
};

type PieDatum = {
  name: string;
  value: number;
};

type DonutDatum = {
  name: string;
  value: number;
};

type CertificateCommonNameDatum = {
  name: string;
  issuerName: string;
  serialNumber: string;
  instances: number;
  uniqueAssets: number;
};

function isPreferredOverviewCipher(cipher: string) {
  const normalized = cipher.toUpperCase();
  return (
    normalized.includes("CHACHA20_POLY1305") ||
    normalized.includes("AES_256") ||
    normalized.includes("AES-256") ||
    normalized.includes("AES256")
  );
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function RankedTable({
  rows,
  emptyLabel,
  rowHref,
  highlightName,
  scrollable = false,
  maxHeightClass = "max-h-[24rem]",
  totalOverride,
}: {
  rows: CountDatum[];
  emptyLabel: string;
  rowHref?: (name: string) => string;
  highlightName?: (name: string) => boolean;
  scrollable?: boolean;
  maxHeightClass?: string;
  totalOverride?: number;
}) {
  const total = useMemo(() => {
    if (typeof totalOverride === "number") {
      return totalOverride;
    }
    return rows.reduce((sum, row) => sum + row.value, 0);
  }, [rows, totalOverride]);

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-amber-500/20 bg-white/40 p-5 text-center">
        <p className="text-sm font-semibold text-[#8a5d33]/55">{emptyLabel}</p>
      </div>
    );
  }

  const renderedRows = rows.map((row, index) => {
    const percentValue = total > 0 ? Math.max(0, Math.min(100, Math.round((row.value / total) * 100))) : 0;
    const content = (
      <div
        className={`flex items-center justify-between gap-4 rounded-none border px-4 py-3 transition ${
          rowHref
            ? "border-[#8a5d33]/10 bg-white/55 hover:border-[#8B0000]/20 hover:bg-[#8B0000]/5"
            : "border-[#8a5d33]/10 bg-white/55"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/60 bg-white text-sm font-extrabold text-[#8B0000]">
            {index + 1}
          </span>
          <span
            className={`truncate text-sm font-bold ${
              highlightName?.(row.name) ? "font-extrabold text-emerald-700" : "text-[#3d200a]"
            }`}
          >
            {row.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-bold text-[#8a5d33]">{row.value}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-[#8a5d33]">
            {percentValue}%
          </span>
        </div>
      </div>
    );

    const wrappedContent = (
      <div className="relative overflow-hidden rounded-none">
        {content}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-cyan-500/10" />
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-1 bg-cyan-500"
          style={{ width: `${percentValue}%` }}
        />
      </div>
    );

    if (!rowHref) {
      return <div key={row.name}>{wrappedContent}</div>;
    }

    return (
      <Link key={row.name} href={rowHref(row.name)} className="block">
        {wrappedContent}
      </Link>
    );
  });

  if (!scrollable) {
    return <div className="space-y-2">{renderedRows}</div>;
  }

  return <ScrollableFadeList maxHeightClass={maxHeightClass} itemCount={rows.length}>{renderedRows}</ScrollableFadeList>;
}

function ScrollableFadeList({
  children,
  itemCount,
  maxHeightClass,
}: {
  children: React.ReactNode;
  itemCount: number;
  maxHeightClass: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateFades = () => {
      const { scrollTop, clientHeight, scrollHeight } = element;
      setShowTopFade(scrollTop > 6);
      setShowBottomFade(scrollTop + clientHeight < scrollHeight - 6);
    };

    updateFades();
    element.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);

    return () => {
      element.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, [itemCount]);

  const maskImage = showTopFade && showBottomFade
    ? "linear-gradient(to bottom, transparent 0, black 1.5rem, black calc(100% - 2rem), transparent 100%)"
    : showTopFade
      ? "linear-gradient(to bottom, transparent 0, black 1.5rem, black 100%)"
      : showBottomFade
        ? "linear-gradient(to bottom, black 0, black calc(100% - 2rem), transparent 100%)"
        : undefined;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className={cn("custom-scrollbar overflow-y-auto pr-1 overscroll-contain", maxHeightClass)}
        style={
          maskImage
            ? {
                maskImage,
                WebkitMaskImage: maskImage,
              }
            : undefined
        }
      >
        <div className="space-y-2 py-1">{children}</div>
      </div>
    </div>
  );
}

function PieStatusCard({
  data,
  rowHref,
  telescopeTooltip,
}: {
  data: PieDatum[];
  rowHref: (name: string) => string;
  telescopeTooltip: (name: string) => string;
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const colors: Record<string, string> = {
    Yes: "#16a34a",
    No: "#dc2626",
  };

  return (
    <div className="grid grid-cols-[124px_1fr] items-center gap-3">
      <div className="h-[124px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={0}
              outerRadius={52}
              paddingAngle={0}
              stroke="#fff7e6"
              strokeWidth={5}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={colors[entry.name] || "#94a3b8"} />
              ))}
            </Pie>
            <ChartTooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "10px",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                fontWeight: 700,
                fontSize: "11px",
                color: "#3d200a",
                padding: "6px 8px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="divide-y divide-[#8a5d33]/10">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors[entry.name] || "#94a3b8" }}
              />
              <span className="text-sm font-bold text-[#3d200a]">{entry.name}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">
                {formatPercent(entry.value, total)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-[#3d200a]">{entry.value}</span>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={rowHref(entry.name)}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#f6c338] to-[#e0a100] text-[#5b3416] shadow-sm transition hover:from-[#efb80d] hover:to-[#c88c00]"
                  >
                    <Telescope className="h-2.5 w-2.5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-[11px] font-semibold">
                  {telescopeTooltip(entry.name)}
                </TooltipContent>
              </UiTooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeySizeDonutCard({
  data,
  onSelect,
  rowHref,
  telescopeTooltip,
}: {
  data: CountDatum[];
  onSelect: (name: string) => void;
  rowHref: (name: string) => string;
  telescopeTooltip: (name: string) => string;
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const palette = ["#4f46e5", "#7c3aed", "#0891b2", "#2563eb", "#9333ea", "#0f766e"];

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/20">
        <p className="text-sm font-semibold text-[#8a5d33]/50">No certificate key size data captured yet.</p>
      </div>
    );
  }

  const chartData = data.map((entry, index) => ({
    ...entry,
    fill: palette[index % palette.length],
  }));

  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4">
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={72}
              paddingAngle={2}
              stroke="#fff7e6"
              strokeWidth={4}
              className="cursor-pointer"
              onClick={(entry: any) => {
                if (entry?.name) {
                  onSelect(entry.name);
                }
              }}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "12px",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                fontWeight: 700,
                fontSize: "11px",
                color: "#3d200a",
                padding: "6px 8px",
              }}
              formatter={(value: number, _name: string, payload: any) => [
                `${value} endpoints`,
                payload?.payload?.name || "Key size",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="divide-y divide-[#8a5d33]/10">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.fill }}
              />
              <Link
                href={rowHref(entry.name)}
                className="truncate text-xs font-bold text-[#4338ca] underline-offset-2 transition hover:text-[#312e81] hover:underline"
              >
                {entry.name}
              </Link>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">
                {formatPercent(entry.value, total)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-[#3d200a]">{entry.value}</span>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={rowHref(entry.name)}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#f6c338] to-[#e0a100] text-[#5b3416] shadow-sm transition hover:from-[#efb80d] hover:to-[#c88c00]"
                  >
                    <Telescope className="h-2.5 w-2.5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-[11px] font-semibold">
                  {telescopeTooltip(entry.name)}
                </TooltipContent>
              </UiTooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownDonutCard({
  data,
  emptyLabel,
  palette,
  rowHref,
  telescopeTooltip,
}: {
  data: DonutDatum[];
  emptyLabel: string;
  palette: string[];
  rowHref?: (name: string) => string;
  telescopeTooltip?: (name: string) => string;
}) {
  const router = useRouter();
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  if (data.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/20">
        <p className="text-sm font-semibold text-[#8a5d33]/50">{emptyLabel}</p>
      </div>
    );
  }

  const chartData = data.map((entry, index) => ({
    ...entry,
    fill: palette[index % palette.length],
  }));

  return (
    <div className="grid grid-cols-[152px_minmax(0,1fr)] items-center gap-3">
      <div className="h-[156px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={34}
              outerRadius={58}
              paddingAngle={2}
              stroke="#fff7e6"
              strokeWidth={2}
              className={rowHref ? "cursor-pointer" : undefined}
              onClick={(entry: any) => {
                if (rowHref && entry?.name) {
                  router.push(rowHref(entry.name));
                }
              }}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "12px",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                fontWeight: 700,
                fontSize: "11px",
                color: "#3d200a",
                padding: "6px 8px",
              }}
              formatter={(value: number, _name: string, payload: any) => [
                `${value}`,
                payload?.payload?.name || "Value",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="min-w-0 divide-y divide-[#8a5d33]/10">
        {chartData.map((entry) => {
          return (
            <div key={entry.name} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="inline-flex h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.fill }}
                />
                {rowHref ? (
                  <Link
                    href={rowHref(entry.name)}
                    title={entry.name}
                    className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#3d200a] underline-offset-2 transition hover:text-[#8B0000] hover:underline"
                  >
                    {entry.name}
                  </Link>
                ) : (
                  <span title={entry.name} className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#3d200a]">
                    {entry.name}
                  </span>
                )}
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em] text-[#8a5d33]/60">
                  {formatPercent(entry.value, total)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-[#3d200a]">{entry.value}</span>
                {rowHref && telescopeTooltip ? (
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={rowHref(entry.name)}
                        className="inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#f6c338] to-[#e0a100] text-[#5b3416] shadow-sm transition hover:from-[#efb80d] hover:to-[#c88c00]"
                      >
                        <Telescope className="h-2.5 w-2.5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-[11px] font-semibold">
                      {telescopeTooltip(entry.name)}
                    </TooltipContent>
                  </UiTooltip>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition ${
        active
          ? "bg-[#8B0000] text-white shadow-sm"
          : "border border-[#8a5d33]/15 bg-white/65 text-[#8a5d33] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function OverviewBarChart({
  data,
  emptyLabel,
  color,
  labelColor,
  yAxisWidth,
  onSelect,
}: {
  data: CountDatum[];
  emptyLabel: string;
  color: string;
  labelColor: string;
  yAxisWidth: number;
  onSelect: (name: string) => void;
}) {
  return (
    <div style={{ height: Math.max(170, (data.length || 1) * 44 + 20) }}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d49a38" strokeOpacity={0.5} horizontal={false} />
            <XAxis type="number" stroke="#8a5d33" fontSize={11} tickLine={false} axisLine={false} fontWeight={600} />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              width={yAxisWidth}
              tick={(props: any) => {
                const { x, y, payload } = props;
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill={labelColor}
                    style={{ cursor: "pointer" }}
                    onClick={() => onSelect(payload.value)}
                    onMouseEnter={(event) => {
                      (event.target as SVGTextElement).style.textDecoration = "underline";
                    }}
                    onMouseLeave={(event) => {
                      (event.target as SVGTextElement).style.textDecoration = "none";
                    }}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <ChartTooltip
              cursor={{ fill: "rgba(139,0,0,0.05)" }}
              contentStyle={{
                background: "#ffffff",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                fontWeight: 700,
                color: "#3d200a",
              }}
              formatter={(value: number) => [value, "Endpoints"]}
            />
            <Bar
              dataKey="value"
              radius={[0, 8, 8, 0]}
              barSize={24}
              fill={color}
              className="cursor-pointer"
              onClick={(entry: any) => {
                if (entry?.name) {
                  onSelect(entry.name);
                }
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/20">
          <p className="text-sm font-semibold text-[#8a5d33]/50">{emptyLabel}</p>
        </div>
      )}
    </div>
  );
}

function TopCertificateCommonNamesCard({
  rows,
}: {
  rows: CertificateCommonNameDatum[];
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/20">
        <p className="text-sm font-semibold text-[#8a5d33]/50">No repeated certificate common names were captured yet.</p>
      </div>
    );
  }

  const maxInstances = Math.max(...rows.map((row) => row.instances), 1);
  const maxUniqueAssets = Math.max(...rows.map((row) => row.uniqueAssets), 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-500/15 bg-white/55">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(200px,1fr)_minmax(200px,1fr)] border-b border-amber-500/10 bg-amber-50/50 text-[10px] font-black uppercase tracking-[0.15em] text-[#8a5d33]/60">
        <div className="px-4 py-3">Certificate</div>
        <div className="px-4 py-3 text-center">Instances</div>
        <div className="px-4 py-3 text-center">Assets</div>
      </div>

      <div className="divide-y divide-amber-500/8">
        {rows.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-[minmax(0,1.5fr)_minmax(200px,1fr)_minmax(200px,1fr)] items-center gap-0"
          >
            <div className="px-4 py-3">
              <p className="truncate text-sm font-bold text-[#3d200a]" title={row.name}>
                {row.name}
              </p>
              <p
                className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a5d33]/55"
                title={`${row.issuerName} • ${row.serialNumber}`}
              >
                {row.issuerName} • {row.serialNumber}
              </p>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-6 flex-1 overflow-hidden bg-amber-100">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
                    style={{ width: `${(row.instances / maxInstances) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-black text-[#3d200a]">{row.instances}</span>
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-6 flex-1 overflow-hidden bg-emerald-100">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                    style={{ width: `${(row.uniqueAssets / maxUniqueAssets) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-black text-[#3d200a]">{row.uniqueAssets}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrgOverview({ org, isAdmin }: OrgOverviewProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tls13CipherTab, setTls13CipherTab] = useState<"negotiated" | "accepted">("accepted");
  const [tls12CipherTab, setTls12CipherTab] = useState<"negotiated" | "accepted">("accepted");
  const [kyberTab, setKyberTab] = useState<"supported" | "negotiated">("supported");
  const [immediateAttentionTab, setImmediateAttentionTab] = useState<"dns" | "cert" | "tls">("dns");

  useEffect(() => {
    let mounted = true;

    const fetchOverview = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orgs/overview?orgId=${org.id}`);
        if (!res.ok) throw new Error("Failed to fetch overview");
        const json = await res.json();
        if (mounted) setData(json);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOverview();
    return () => {
      mounted = false;
    };
  }, [org.id]);

  const immediateAttentionGroups = {
    dns: data?.immediateAttention?.dnsExpired || [],
    cert: data?.immediateAttention?.certExpired || [],
    tls: data?.immediateAttention?.noTlsWeakTls || [],
  };

  useEffect(() => {
    if (!data) return;

    const tabOrder: Array<"dns" | "cert" | "tls"> = ["dns", "cert", "tls"];
    const hasRowsForCurrentTab = immediateAttentionGroups[immediateAttentionTab]?.length > 0;

    if (hasRowsForCurrentTab) return;

    const firstAvailableTab = tabOrder.find((tab) => immediateAttentionGroups[tab]?.length > 0);
    if (firstAvailableTab && firstAvailableTab !== immediateAttentionTab) {
      setImmediateAttentionTab(firstAvailableTab);
    }
  }, [data, immediateAttentionGroups, immediateAttentionTab]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-amber-600" />
        <p className="text-sm font-semibold text-[#8a5d33]/70 font-mono">Compiling Security Intelligence...</p>
      </div>
    );
  }

  if (!data) return null;

  const tls13CipherRows =
    tls13CipherTab === "negotiated" ? data.tls13CipherNegotiated || [] : data.tls13CipherAccepted || [];
  const tls12CipherRows =
    tls12CipherTab === "negotiated" ? data.tls12CipherNegotiated || [] : data.tls12CipherAccepted || [];
  const kyberData = kyberTab === "supported" ? data.kyberSupportedYesNo || [] : data.kyberNegotiatedYesNo || [];
  const immediateAttentionRows = immediateAttentionGroups[immediateAttentionTab] || [];
  const immediateAttentionExplorerHref =
    immediateAttentionTab === "dns"
      ? `/app/${org.slug}/explore?dnsState=not_found`
      : immediateAttentionTab === "cert"
        ? `/app/${org.slug}/explore?certState=expired_or_invalid`
        : `/app/${org.slug}/explore?tlsProfile=legacy_or_missing`;
  const kyberHref =
    kyberTab === "supported"
      ? `/app/${org.slug}/explore?pqcSupported=true`
      : `/app/${org.slug}/explore?pqcNegotiated=true`;

  return (
    <TooltipProvider>
      <div className="flex flex-col space-y-5 pb-10 animate-in fade-in duration-300">
      <div className="rounded-3xl border border-white/40 bg-white/40 p-5 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-xl">
        <h1 className="text-2xl font-bold tracking-tight text-[#3d200a]">Security Overview</h1>
        <p className="mt-1 text-sm font-semibold text-[#8a5d33]/70">
          Real-time intelligence from the latest OpenSSL endpoint scans across your organization.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Scanned TLS Endpoints",
            value: data.totalScanned,
            icon: Boxes,
            tone: "text-blue-700",
            bg: "from-blue-100 to-white",
            borderColor: "border-blue-200",
          },
          {
            title: "Strong Ciphers Confirmed",
            value: data.strongCipherCount,
            icon: ShieldAlert,
            tone: "text-emerald-700",
            bg: "from-emerald-100 to-white",
            borderColor: "border-emerald-200",
          },
          {
            title: "Certificates Expiring (<30d)",
            value: data.closeDeadlineCerts,
            icon: Calendar,
            tone: "text-amber-700",
            bg: "from-amber-100 to-white",
            borderColor: "border-amber-200",
            href: `/app/${org.slug}/explore?certState=expiring_soon`,
          },
          {
            title: "Critical Expirations",
            value: data.expiredCerts,
            icon: AlertTriangle,
            tone: "text-red-700",
            bg: "from-red-100 to-white",
            borderColor: "border-red-200",
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.title}
              className={`rounded-3xl border ${metric.borderColor} bg-white/70 p-5 shadow-sm backdrop-blur`}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#8a5d33]/70">{metric.title}</p>
                <div
                  className={`rounded-xl border ${metric.borderColor} bg-linear-to-br ${metric.bg} p-2 shadow-sm ${metric.tone}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className={`mt-4 text-3xl font-bold tracking-tight ${metric.tone}`}>{metric.value}</p>
              {metric.href ? (
                <div className="mt-3 flex justify-end">
                  <Link
                    href={metric.href}
                    className="text-xs font-bold text-[#8B0000] underline decoration-[#8B0000]/45 underline-offset-3 transition-colors hover:text-[#730000] hover:decoration-[#730000]"
                  >
                    Show
                  </Link>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <article className="flex h-full min-h-[14.5rem] flex-col rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Latest TLS Version</h2>
          </div>
          <OverviewBarChart
            data={data.tlsChartData || []}
            emptyLabel="Complete a scan to view protocol distribution"
            color="#8B0000"
            labelColor="#8B0000"
            yAxisWidth={82}
            onSelect={(name) =>
              router.push(`/app/${org.slug}/explore?tls=${encodeURIComponent(name)}&tlsMatch=exact_latest`)
            }
          />
        </article>

        <article className="flex h-full min-h-[14.5rem] flex-col rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-[#3d200a]">PQC Rating</h2>
            </div>
            <Link
              href={`/app/${org.slug}/pqc`}
              className="text-[10px] font-bold text-[#8B0000] hover:underline"
            >
              View Posture
            </Link>
          </div>
          <div className={`mb-6 flex items-center justify-between rounded-2xl border px-6 py-5 ${data.tier.bg}`}>
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl font-bold shadow-sm ring-4 ring-white/50 ${data.tier.color}`}>
                {data.tier.grade}
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight text-[#3d200a]">{data.tier.tier}</p>
                <p className={`text-base font-bold ${data.tier.color}`}>{data.tier.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-[#3d200a]">{data.tier.score ?? 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">out of 100</p>
            </div>
          </div>

          <div className="mt-auto space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
                <p className="text-xs font-bold text-[#3d200a]">Self-Signed Certificates</p>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-sm font-bold ${data.selfSignedCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {data.selfSignedCount}
                </p>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/app/${org.slug}/explore?selfSigned=true`}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#f6c338] to-[#e0a100] text-[#5b3416] shadow-sm transition hover:from-[#efb80d] hover:to-[#c88c00]"
                    >
                      <Telescope className="h-2.5 w-2.5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-[11px] font-semibold">
                    Open self-signed certificate assets in Asset Explorer
                  </TooltipContent>
                </UiTooltip>
              </div>
            </div>
            {data.tier.portsScored > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
                  <p className="text-xs font-bold text-[#3d200a]">Ports Scored</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-emerald-600">
                    {data.tier.portsScored}
                  </p>
                </div>
              </div>
            )}
          </div>

        </article>

        <article className="flex h-full min-h-[14.5rem] flex-col rounded-[1.9rem] border border-amber-500/20 bg-white/60 p-5 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-[#3d200a]">PQC Safe Key Exchange</h2>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#8a5d33]/15 bg-white/60 text-[#8B0000] transition hover:bg-white"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    align="start"
                    className="rounded-2xl border-[#4a1e1e]/70 bg-linear-to-br from-[#541616] to-[#7a1f1f] px-3 py-2 text-[11px] font-semibold text-white"
                  >
                    NIST Recommended Module Lattice Kyber Exchange Mechanism (MLKEM).
                  </TooltipContent>
                </UiTooltip>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <TabButton active={kyberTab === "supported"} onClick={() => setKyberTab("supported")}>
                Supported
              </TabButton>
              <TabButton active={kyberTab === "negotiated"} onClick={() => setKyberTab("negotiated")}>
                Negotiated
              </TabButton>
            </div>

            <PieStatusCard
              data={kyberData}
              rowHref={(name) => {
                const value = name.toLowerCase();
                const negativeTail = `&dnsState=found&noTls=false`;
                if (kyberTab === "supported") {
                  return value === "yes"
                    ? `/app/${org.slug}/explore?pqcSupported=true`
                    : `/app/${org.slug}/explore?pqcSupported=false${negativeTail}`;
                }
                return value === "yes"
                  ? `/app/${org.slug}/explore?pqcNegotiated=true`
                  : `/app/${org.slug}/explore?pqcNegotiated=false${negativeTail}`;
              }}
              telescopeTooltip={(name) => {
                const state = name.toLowerCase() === "yes" ? "with" : "without";
                return kyberTab === "supported"
                  ? `Open assets ${state} supported MLKEM groups`
                  : `Open assets ${state} negotiated MLKEM groups`;
              }}
            />
          </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-[#3d200a]">TLSv1.3 Ciphers</h2>
            </div>
            <div className="flex items-center gap-2">
              <TabButton active={tls13CipherTab === "negotiated"} onClick={() => setTls13CipherTab("negotiated")}>
                Negotiated
              </TabButton>
              <TabButton active={tls13CipherTab === "accepted"} onClick={() => setTls13CipherTab("accepted")}>
                Accepted
              </TabButton>
            </div>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Version-specific TLS 1.3 cipher posture
          </p>
          <RankedTable
            rows={tls13CipherRows}
            emptyLabel="No TLSv1.3 cipher data captured yet."
            highlightName={isPreferredOverviewCipher}
            rowHref={(name) => `/app/${org.slug}/explore?tls=${encodeURIComponent("TLSv1.3")}&cipher=${encodeURIComponent(name)}`}
            scrollable
            maxHeightClass="max-h-[18rem]"
            totalOverride={data.totalAssets}
          />
        </article>

        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-bold text-[#3d200a]">TLSv1.2 Ciphers</h2>
            </div>
            <div className="flex items-center gap-2">
              <TabButton active={tls12CipherTab === "negotiated"} onClick={() => setTls12CipherTab("negotiated")}>
                Negotiated
              </TabButton>
              <TabButton active={tls12CipherTab === "accepted"} onClick={() => setTls12CipherTab("accepted")}>
                Accepted
              </TabButton>
            </div>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Version-specific TLS 1.2 cipher posture
          </p>
          <RankedTable
            rows={tls12CipherRows}
            emptyLabel="No TLSv1.2 cipher data captured yet."
            highlightName={isPreferredOverviewCipher}
            rowHref={(name) => `/app/${org.slug}/explore?tls=${encodeURIComponent("TLSv1.2")}&cipher=${encodeURIComponent(name)}`}
            scrollable
            maxHeightClass="max-h-[18rem]"
            totalOverride={data.totalAssets}
          />
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-red-500/15 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#3d200a]">Immediate Attention</h2>
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#8a5d33]/15 bg-white/60 text-[#8B0000] transition hover:bg-white"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs rounded-2xl text-[11px] font-semibold">
                      Prioritized endpoints grouped by DNS expiration, expired or invalid certificates, and missing or legacy TLS.
                    </TooltipContent>
                  </UiTooltip>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <TabButton active={immediateAttentionTab === "dns"} onClick={() => setImmediateAttentionTab("dns")}>
                    DNS ({immediateAttentionGroups.dns.length})
                  </TabButton>
                  <TabButton active={immediateAttentionTab === "cert"} onClick={() => setImmediateAttentionTab("cert")}>
                    Cert ({immediateAttentionGroups.cert.length})
                  </TabButton>
                  <TabButton active={immediateAttentionTab === "tls"} onClick={() => setImmediateAttentionTab("tls")}>
                    TLS ({immediateAttentionGroups.tls.length})
                  </TabButton>
                </div>
              </div>
            </div>
          </div>
          {immediateAttentionRows.length > 0 ? (
            <ScrollableFadeList maxHeightClass="max-h-[10.75rem]" itemCount={immediateAttentionRows.length}>
              {immediateAttentionRows.map((asset: any) => (
                <Link href={`/app/${org.slug}/asset/${asset.id}`} key={asset.id} className="block group">
                  <div className="flex items-center justify-between rounded-xl border border-red-500/10 bg-white/60 px-3 py-2.5 transition-all hover:border-red-500/20 hover:bg-red-500/5">
                    <div className="flex min-w-0 items-center gap-3 pr-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="truncate text-xs font-bold text-[#3d200a] transition-colors group-hover:text-red-700">
                          {asset.name}
                        </p>
                        <p className="text-[10px] font-bold text-red-600">{asset.issue}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-red-500/40 transition-colors group-hover:text-red-600" />
                  </div>
                </Link>
              ))}
            </ScrollableFadeList>
          ) : (
            <div className="flex h-[10.75rem] items-center justify-center rounded-2xl border border-dashed border-emerald-500/20 bg-white/40 p-5 text-center">
              <p className="max-w-sm text-sm font-semibold text-emerald-700/80">
                No endpoints are currently flagged in this attention category.
              </p>
            </div>
          )}
          <Link
            href={immediateAttentionExplorerHref}
            className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-full bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-700 transition-colors hover:bg-red-500/20 hover:text-red-800"
          >
            View Explorer
            <ChevronRight className="h-3 w-3" />
          </Link>
        </article>

        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Certificate Key Size</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Public key size distribution from current endpoint certificates
          </p>
          <KeySizeDonutCard
            data={data.certificateKeySizes || []}
            onSelect={(name) => router.push(`/app/${org.slug}/explore?keySize=${encodeURIComponent(name)}`)}
            rowHref={(name) => `/app/${org.slug}/explore?keySize=${encodeURIComponent(name)}`}
            telescopeTooltip={(name) => `Open assets with ${name} certificates in Asset Explorer`}
          />
        </article>
      </section>

      <section>
        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-[#8B0000]" />
            <h2 className="text-base font-bold text-[#3d200a]">Certificate Signature Algorithms</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Observed signing algorithms from endpoint certificates
          </p>
          <RankedTable
            rows={data.certificateSignatureAlgorithms || []}
            emptyLabel="No certificate signature algorithms reported yet."
            rowHref={(name) => `/app/${org.slug}/explore?signatureAlgorithm=${encodeURIComponent(name)}`}
          />
        </article>
      </section>

      <section>
        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-violet-600" />
            <h2 className="text-base font-bold text-[#3d200a]">TLSv1.3 Key Exchange</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Supported key exchange groups across TLSv1.3 endpoints
          </p>

          <div style={{ height: Math.max(180, (data.tls13KeyExchange?.length || 1) * 44 + 20) }}>
            {data.tls13KeyExchange?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={data.tls13KeyExchange}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#d49a38" strokeOpacity={0.5} horizontal={false} />
                  <XAxis type="number" stroke="#8a5d33" fontSize={11} tickLine={false} axisLine={false} fontWeight={600} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      return (
                        <text
                          x={x}
                          y={y}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fontSize={11}
                          fontWeight={700}
                          fill="#5b21b6"
                          style={{ cursor: "pointer" }}
                          onClick={() => router.push(`/app/${org.slug}/explore?kexGroups=${encodeURIComponent(payload.value)}`)}
                          onMouseEnter={(event) => {
                            (event.target as SVGTextElement).style.textDecoration = "underline";
                          }}
                          onMouseLeave={(event) => {
                            (event.target as SVGTextElement).style.textDecoration = "none";
                          }}
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <ChartTooltip
                    cursor={{ fill: "rgba(139,0,0,0.05)" }}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      fontWeight: 700,
                      color: "#3d200a",
                    }}
                    formatter={(value: number) => [value, "Endpoints"]}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 8, 8, 0]}
                    barSize={24}
                    fill="#7c3aed"
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      if (entry?.name) {
                        router.push(`/app/${org.slug}/explore?kexGroups=${encodeURIComponent(entry.name)}`);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-amber-500/20">
                <p className="text-sm font-semibold text-[#8a5d33]/50">No TLSv1.3 key exchange data reported yet.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-sky-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Certificate Instances by Port</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Distribution of observed endpoint certificates across active TLS ports
          </p>
          <BreakdownDonutCard
            data={data.certificatePorts || []}
            emptyLabel="No certificate port distribution is available yet."
            palette={["#3b82f6", "#f59e0b", "#a78bfa", "#ec4899", "#22c55e", "#06b6d4"]}
            rowHref={(name) => `/app/${org.slug}/explore?port=${encodeURIComponent(name)}`}
            telescopeTooltip={(name) => `Open assets with endpoint certificates on port ${name}`}
          />
        </article>

        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-[#8B0000]" />
            <h2 className="text-base font-bold text-[#3d200a]">Certificates by Algorithm</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Signature algorithm distribution from current endpoint certificates
          </p>
          <BreakdownDonutCard
            data={data.certificateSignatureAlgorithms || []}
            emptyLabel="No certificate signature algorithms reported yet."
            palette={["#2563eb", "#f59e0b", "#a78bfa", "#ef4444", "#14b8a6", "#8b5cf6"]}
            rowHref={(name) => `/app/${org.slug}/explore?signatureAlgorithm=${encodeURIComponent(name)}`}
            telescopeTooltip={(name) => `Open assets with ${name} certificate signatures`}
          />
        </article>

        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Expiring Certificates</h2>
          </div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[#8a5d33]/70">
            Current endpoint certificate expiry windows across expired, near-term, and long-lived certificates
          </p>
          <BreakdownDonutCard
            data={data.certificateExpiryWindows || []}
            emptyLabel="No certificate expiry window data is available yet."
            palette={["#ef4444", "#7dd3fc", "#fde047", "#38bdf8"]}
            rowHref={(name) => {
              const expiryMap: Record<string, string> = {
                Expired: "expired",
                "In 30 days": "in_30_days",
                "In 90 days": "in_90_days",
                "> 90 days": "over_90_days",
              };

              return `/app/${org.slug}/explore?certExpiry=${encodeURIComponent(expiryMap[name] || "")}`;
            }}
            telescopeTooltip={(name) => `Open assets with certificates in the ${name.toLowerCase()} bucket`}
          />
        </article>
      </section>

      <section>
        <article className="rounded-3xl border border-amber-500/20 bg-white/60 p-6 shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-sky-600" />
            <h2 className="text-base font-bold text-[#3d200a]">Top Certificates by Identity</h2>
          </div>
          <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-[#8a5d33]/60">
            Grouped by serial number and issuer
          </p>
          <TopCertificateCommonNamesCard rows={data.topCertificatesByIdentity || []} />
        </article>
      </section>
      </div>
    </TooltipProvider>
  );
}
