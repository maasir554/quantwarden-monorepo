"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Download,
  Fingerprint,
  KeyRound,
  Loader2,
  ScrollText,
  ShieldCheck,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { CBOM_NOT_REPORTED, type CbomResponse } from "@/lib/cbom";
import { cn } from "@/lib/utils";

type CbomTabKey = "algorithms" | "keys" | "protocols" | "certificates";
type ExportFormat = "json" | "csv";
type CsvColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
};

type OrgCbomProps = {
  org: { id: string };
};

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, payload: string, mimeType: string) {
  const blob = new Blob([payload], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number | boolean | null | undefined) {
  const normalized = value == null ? "" : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const headerLine = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.accessor(row))).join(",")
  );

  return [headerLine, ...dataLines].join("\n");
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-amber-500/20 bg-white/55 p-6 text-center">
      <p className="max-w-lg text-sm font-semibold text-[#8a5d33]/70">{label}</p>
    </div>
  );
}

function TableShell({
  minWidthClass = "min-w-full",
  children,
}: {
  minWidthClass?: string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateFades = () => {
      setShowLeftFade(element.scrollLeft > 4);
      setShowRightFade(element.scrollLeft + element.clientWidth < element.scrollWidth - 4);
      setShowBottomFade(element.scrollTop + element.clientHeight < element.scrollHeight - 4);
    };

    updateFades();
    element.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);

    return () => {
      element.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="custom-scrollbar max-h-[35rem] overflow-auto rounded-2xl border border-[#8a5d33]/10 bg-white/55"
      >
        <table className={`${minWidthClass} w-full border-collapse text-left text-xs text-[#3d200a]`}>
          {children}
        </table>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-10 rounded-l-2xl bg-gradient-to-r from-[#fff6da] to-transparent transition-opacity duration-200",
          showLeftFade ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-2xl bg-gradient-to-l from-[#fff6da] to-transparent transition-opacity duration-200",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-2xl bg-gradient-to-t from-[#fff6da] to-transparent transition-opacity duration-200",
          showBottomFade ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

function TableHeadCell({
  children,
  centered = false,
  rowSpan,
  colSpan,
  topClass = "top-0",
  zClass = "z-20",
}: {
  children: ReactNode;
  centered?: boolean;
  rowSpan?: number;
  colSpan?: number;
  topClass?: string;
  zClass?: string;
}) {
  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={cn(
        "sticky border-b border-r border-white/15 bg-[#8B0000] px-3 py-2.5 text-[11px] font-bold tracking-[0.18em] text-white backdrop-blur-sm",
        topClass,
        zClass,
        centered ? "text-center" : ""
      )}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  mono = false,
  noWrap = false,
}: {
  children: ReactNode;
  mono?: boolean;
  noWrap?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-b border-r border-[#8a5d33]/10 px-3 py-3 align-top text-sm",
        mono ? "font-mono text-[12px]" : "",
        noWrap ? "whitespace-nowrap" : ""
      )}
    >
      {children}
    </td>
  );
}

function DataPanel({
  title,
  subtitle,
  icon: Icon,
  count,
  exportFormat,
  onExportFormatChange,
  onExport,
  children,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  count: number;
  exportFormat: ExportFormat;
  onExportFormatChange: (value: ExportFormat) => void;
  onExport: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/40 bg-white/45 p-5 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8B0000]/10 text-[#8B0000]">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight text-[#3d200a]">{title}</h2>
              <p className="mt-1 text-sm font-semibold text-[#8a5d33]/75">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#8B0000]/15 bg-white/75 px-3 py-1 text-xs font-bold text-[#8B0000]">
            {count} rows
          </span>
          <div className="flex items-center gap-2 rounded-full border border-[#8B0000]/15 bg-white/80 px-2 py-2">
            <span className="pl-2 text-xs font-bold uppercase tracking-[0.14em] text-[#8a5d33]/80">Export:</span>
            <select
              value={exportFormat}
              onChange={(event) => onExportFormatChange(event.target.value as ExportFormat)}
              className="rounded-full border border-[#8a5d33]/10 bg-[#fffdf8] px-3 py-1.5 text-sm font-bold text-[#3d200a] outline-none transition focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <button
              type="button"
              onClick={onExport}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#8B0000] text-white transition hover:bg-[#6f0000]"
              aria-label={`Download ${exportFormat.toUpperCase()} export`}
              title={`Download ${exportFormat.toUpperCase()}`}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function OrgCbom({ org }: OrgCbomProps) {
  const [data, setData] = useState<CbomResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CbomTabKey>("algorithms");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");

  useEffect(() => {
    let mounted = true;

    const fetchCbom = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/orgs/cbom?orgId=${org.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch org CBOM");
        }
        const json = (await response.json()) as CbomResponse;
        if (mounted) {
          setData(json);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchCbom();
    return () => {
      mounted = false;
    };
  }, [org.id]);

  const tabs = useMemo(() => {
    if (!data) return [];

    return [
      {
        key: "algorithms" as const,
        label: "Algorithms",
        icon: Waypoints,
        count: data.algorithms.length,
        title: "Algorithms",
        subtitle: "Element-wise cryptographic algorithms observed across the latest completed endpoint scans.",
        jsonFilename: "certin-cbom-algorithms.json",
        csvFilename: "certin-cbom-algorithms.csv",
        payload: data.algorithms,
        csvContent: buildCsv(data.algorithms, [
          { header: "Cryptographic Asset Type", accessor: (row) => row.cryptographicAssetType },
          { header: "Name", accessor: (row) => row.name },
          { header: "Asset Type", accessor: (row) => row.assetType },
          { header: "Primitive", accessor: (row) => row.primitive },
          { header: "Mode", accessor: (row) => row.mode },
          { header: "Crypto Functions", accessor: (row) => row.cryptoFunctions },
          { header: "Classical Security Level", accessor: (row) => row.classicalSecurityLevel },
          { header: "OID", accessor: (row) => row.oid },
          { header: "Assets", accessor: (row) => row.assets.join("\n") },
        ]),
        emptyLabel: "No algorithm inventory could be derived from the currently stored OpenSSL scan payloads.",
        minWidthClass: "min-w-[1100px]",
        table: (
          <>
            <thead>
              <tr>
                <TableHeadCell>Cryptographic Asset Type</TableHeadCell>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Asset Type</TableHeadCell>
                <TableHeadCell>Primitive</TableHeadCell>
                <TableHeadCell>Mode</TableHeadCell>
                <TableHeadCell>Crypto Functions</TableHeadCell>
                <TableHeadCell>Classical Security Level</TableHeadCell>
                <TableHeadCell>OID</TableHeadCell>
                <TableHeadCell>List</TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white/45">
              {data.algorithms.map((row) => (
                <tr key={`${row.name}-${row.primitive}-${row.mode}`} className="transition hover:bg-white/45">
                  <TableCell>{row.cryptographicAssetType}</TableCell>
                  <TableCell noWrap>{row.name}</TableCell>
                  <TableCell>{row.assetType}</TableCell>
                  <TableCell noWrap>{row.primitive}</TableCell>
                  <TableCell noWrap>{row.mode}</TableCell>
                  <TableCell>{row.cryptoFunctions}</TableCell>
                  <TableCell noWrap>{row.classicalSecurityLevel}</TableCell>
                  <TableCell mono>{row.oid}</TableCell>
                  <TableCell>{row.list}</TableCell>
                </tr>
              ))}
            </tbody>
          </>
        ),
      },
      {
        key: "keys" as const,
        label: "Keys",
        icon: KeyRound,
        count: data.keys.length,
        title: "Keys",
        subtitle: "Best-effort certificate public key inventory. Lifecycle fields remain explicit when the stored payload does not expose them.",
        jsonFilename: "certin-cbom-keys.json",
        csvFilename: "certin-cbom-keys.csv",
        payload: data.keys,
        csvContent: buildCsv(data.keys, [
          { header: "Cryptographic Asset Type", accessor: (row) => row.cryptographicAssetType },
          { header: "Name", accessor: (row) => row.name },
          { header: "Asset Type", accessor: (row) => row.assetType },
          { header: "ID", accessor: (row) => row.id },
          { header: "State", accessor: (row) => row.state },
          { header: "Size", accessor: (row) => row.size },
          { header: "Creation Date", accessor: (row) => row.creationDate },
          { header: "Activation Date", accessor: (row) => row.activationDate },
        ]),
        emptyLabel: "No certificate public keys were available in the latest completed OpenSSL endpoint scans.",
        minWidthClass: "min-w-[980px]",
        table: (
          <>
            <thead>
              <tr>
                <TableHeadCell>Cryptographic Asset Type</TableHeadCell>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Asset Type</TableHeadCell>
                <TableHeadCell>id</TableHeadCell>
                <TableHeadCell>state</TableHeadCell>
                <TableHeadCell>size</TableHeadCell>
                <TableHeadCell>Creation Date</TableHeadCell>
                <TableHeadCell>Activation Date</TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white/45">
              {data.keys.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="transition hover:bg-white/45">
                  <TableCell>{row.cryptographicAssetType}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.assetType}</TableCell>
                  <TableCell mono>{row.id}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                        row.state === CBOM_NOT_REPORTED
                          ? "border-[#8a5d33]/15 bg-white/70 text-[#8a5d33]"
                          : "border-[#8B0000]/15 bg-[#8B0000]/10 text-[#8B0000]"
                      }`}
                    >
                      {row.state}
                    </span>
                  </TableCell>
                  <TableCell noWrap>{row.size}</TableCell>
                  <TableCell noWrap>{row.creationDate}</TableCell>
                  <TableCell noWrap>{row.activationDate}</TableCell>
                </tr>
              ))}
            </tbody>
          </>
        ),
      },
      {
        key: "protocols" as const,
        label: "Protocols",
        icon: ShieldCheck,
        count: data.protocols.length,
        title: "Protocols",
        subtitle: "Version-specific TLS protocol inventory for each latest scanned endpoint.",
        jsonFilename: "certin-cbom-protocols.json",
        csvFilename: "certin-cbom-protocols.csv",
        payload: data.protocols,
        csvContent: buildCsv(data.protocols, [
          { header: "Cryptographic Asset Type", accessor: (row) => row.cryptographicAssetType },
          { header: "Name", accessor: (row) => row.name },
          { header: "Asset Type", accessor: (row) => row.assetType },
          { header: "Version", accessor: (row) => row.version },
          { header: "Cipher Suites", accessor: (row) => row.cipherSuites },
          { header: "OID", accessor: (row) => row.oid },
        ]),
        emptyLabel: "No supported TLS protocol versions were available in the latest completed OpenSSL endpoint scans.",
        minWidthClass: "min-w-[1000px]",
        table: (
          <>
            <thead>
              <tr>
                <TableHeadCell>Cryptographic Asset Type</TableHeadCell>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Asset Type</TableHeadCell>
                <TableHeadCell>Version</TableHeadCell>
                <TableHeadCell>Cipher Suites</TableHeadCell>
                <TableHeadCell>OID</TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white/45">
              {data.protocols.map((row, index) => (
                <tr key={`${row.version}-${row.assetType}-${index}`} className="transition hover:bg-white/45">
                  <TableCell>{row.cryptographicAssetType}</TableCell>
                  <TableCell noWrap>{row.name}</TableCell>
                  <TableCell>{row.assetType}</TableCell>
                  <TableCell noWrap>{row.version}</TableCell>
                  <TableCell>{row.cipherSuites}</TableCell>
                  <TableCell mono>{row.oid}</TableCell>
                </tr>
              ))}
            </tbody>
          </>
        ),
      },
      {
        key: "certificates" as const,
        label: "Certificates",
        icon: Fingerprint,
        count: data.certificates.length,
        title: "Certificates",
        subtitle: "Observed endpoint certificates from the latest completed OpenSSL scan stored for each asset endpoint.",
        jsonFilename: "certin-cbom-certificates.json",
        csvFilename: "certin-cbom-certificates.csv",
        payload: data.certificates,
        csvContent: buildCsv(data.certificates, [
          { header: "Cryptographic Asset Type", accessor: (row) => row.cryptographicAssetType },
          { header: "Name", accessor: (row) => row.name },
          { header: "Asset Type", accessor: (row) => row.assetType },
          { header: "Subject C", accessor: (row) => row.subjectC },
          { header: "Subject CN", accessor: (row) => row.subjectCN },
          { header: "Subject O", accessor: (row) => row.subjectO },
          { header: "Issuer C", accessor: (row) => row.issuerC },
          { header: "Issuer CN", accessor: (row) => row.issuerCN },
          { header: "Issuer O", accessor: (row) => row.issuerO },
          { header: "Not Valid Before", accessor: (row) => row.notValidBefore },
          { header: "Not Valid After", accessor: (row) => row.notValidAfter },
          { header: "Signature Algorithm Reference", accessor: (row) => row.signatureAlgorithmReference },
          { header: "Subject Public Key Reference", accessor: (row) => row.subjectPublicKeyReference },
          { header: "Certificate Format", accessor: (row) => row.certificateFormat },
          { header: "Certificate Extension", accessor: (row) => row.certificateExtension },
        ]),
        emptyLabel: "No endpoint certificate records were available in the latest completed OpenSSL scan payloads.",
        minWidthClass: "min-w-[1520px]",
        table: (
          <>
            <thead>
              <tr>
                <TableHeadCell rowSpan={2}>Cryptographic Asset Type</TableHeadCell>
                <TableHeadCell rowSpan={2}>Name</TableHeadCell>
                <TableHeadCell rowSpan={2}>Asset Type</TableHeadCell>
                <TableHeadCell colSpan={3} centered>
                  Subject Name
                </TableHeadCell>
                <TableHeadCell colSpan={3} centered>
                  Issuer Name
                </TableHeadCell>
                <TableHeadCell rowSpan={2}>Not Valid Before</TableHeadCell>
                <TableHeadCell rowSpan={2}>Not Valid After</TableHeadCell>
                <TableHeadCell rowSpan={2}>Signature Algorithm Reference</TableHeadCell>
                <TableHeadCell rowSpan={2}>Subject Public Key Reference</TableHeadCell>
                <TableHeadCell rowSpan={2}>Certificate Format</TableHeadCell>
                <TableHeadCell rowSpan={2}>Certificate Extension</TableHeadCell>
              </tr>
              <tr>
                <TableHeadCell centered topClass="top-[34px]" zClass="z-10">C</TableHeadCell>
                <TableHeadCell centered topClass="top-[34px]" zClass="z-10">CN</TableHeadCell>
                <TableHeadCell centered topClass="top-[34px]" zClass="z-10">O</TableHeadCell>
                <TableHeadCell centered topClass="top-[34px]" zClass="z-10">C</TableHeadCell>
                <TableHeadCell centered topClass="top-[34px]" zClass="z-10">CN</TableHeadCell>
                <TableHeadCell centered topClass="top-[34px]" zClass="z-10">O</TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white/45">
              {data.certificates.map((row, index) => (
                <tr key={`${row.name}-${row.notValidAfter}-${index}`} className="transition hover:bg-white/45">
                  <TableCell>{row.cryptographicAssetType}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.assetType}</TableCell>
                  <TableCell noWrap>{row.subjectC}</TableCell>
                  <TableCell>{row.subjectCN}</TableCell>
                  <TableCell>{row.subjectO}</TableCell>
                  <TableCell noWrap>{row.issuerC}</TableCell>
                  <TableCell>{row.issuerCN}</TableCell>
                  <TableCell>{row.issuerO}</TableCell>
                  <TableCell mono>{row.notValidBefore}</TableCell>
                  <TableCell mono>{row.notValidAfter}</TableCell>
                  <TableCell>{row.signatureAlgorithmReference}</TableCell>
                  <TableCell>{row.subjectPublicKeyReference}</TableCell>
                  <TableCell noWrap>{row.certificateFormat}</TableCell>
                  <TableCell noWrap>{row.certificateExtension}</TableCell>
                </tr>
              ))}
            </tbody>
          </>
        ),
      },
    ];
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-amber-600" />
        <p className="text-sm font-semibold text-[#8a5d33]/70">Building CERT-IN CBOM from latest endpoint scans...</p>
      </div>
    );
  }

  if (!data || tabs.length === 0) return null;

  const activeConfig = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const handleExport = () => {
    if (exportFormat === "csv") {
      downloadText(activeConfig.csvFilename, activeConfig.csvContent, "text/csv;charset=utf-8");
      return;
    }

    downloadJson(activeConfig.jsonFilename, activeConfig.payload);
  };

  return (
    <div className="flex flex-col space-y-5 pb-10 animate-in fade-in duration-300">
      <section className="rounded-3xl border border-white/40 bg-white/40 p-5 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8B0000]/10 text-[#8B0000]">
                <ScrollText className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#3d200a]">CERT-IN CBOM</h1>
                <p className="mt-1 text-sm font-semibold text-[#8a5d33]/75">
                  Cryptographic bill of materials aligned to the CERT-In table blueprint and derived from stored OpenSSL endpoint scans.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#8B0000]/10 bg-white/75 px-4 py-3 text-right">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#8a5d33]/70">Generated</p>
            <p className="mt-1 text-sm font-bold text-[#3d200a]">{new Date(data.generatedAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tabs.map((item) => {
            const Icon = item.icon;
            const selected = item.key === activeTab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition",
                  selected
                    ? "border-[#8B0000]/15 bg-[#8B0000] text-white shadow-sm"
                    : "border-[#8a5d33]/10 bg-white/70 text-[#3d200a] hover:bg-white/90"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs font-bold tracking-[0.16em]", selected ? "text-white/80" : "text-[#8a5d33]/70")}>
                    {item.label}
                  </span>
                  <Icon className={cn("h-4 w-4", selected ? "text-white" : "text-[#8B0000]")} />
                </div>
                <div className="mt-2 text-2xl font-black">{item.count}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-50/80 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#8B0000]" />
            <div className="space-y-2">
              <p className="text-sm font-bold text-[#3d200a]">Data coverage notes</p>
              <ul className="space-y-1 text-sm font-medium text-[#8a5d33]">
                {data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/40 bg-white/45 p-3 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const selected = tab.key === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition",
                  selected
                    ? "border-[#8B0000]/15 bg-[#8B0000] text-white"
                    : "border-[#8a5d33]/10 bg-white/70 text-[#8a5d33] hover:bg-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span className={cn("rounded-full px-2 py-0.5 text-xs", selected ? "bg-white/15 text-white" : "bg-[#8B0000]/8 text-[#8B0000]")}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <DataPanel
        title={activeConfig.title}
        subtitle={activeConfig.subtitle}
        icon={activeConfig.icon}
        count={activeConfig.count}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        onExport={handleExport}
      >
        {activeConfig.count === 0 ? (
          <EmptyState label={activeConfig.emptyLabel} />
        ) : (
          <TableShell minWidthClass={activeConfig.minWidthClass}>{activeConfig.table}</TableShell>
        )}
      </DataPanel>
    </div>
  );
}
