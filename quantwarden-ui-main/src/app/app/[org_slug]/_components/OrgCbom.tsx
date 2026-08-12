"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  Download,
  Fingerprint,
  KeyRound,
  Loader2,
  ScrollText,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

import { CBOM_NOT_REPORTED, type CbomResponse } from "@/lib/cbom";
import {
  buildCycloneDxCbom,
  buildPerAssetCbomExport,
  buildSpdxInteropDocument,
  CYCLONEDX_CBOM_SPEC_VERSION,
  SPDX_INTEROP_SPEC_VERSION,
} from "@/lib/cbom-export";
import { cn } from "@/lib/utils";

type CbomTabKey = "assets" | "algorithms" | "keys" | "protocols" | "certificates";
type ExportFormat = "cyclonedx" | "spdx" | "per-asset" | "csv";
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
    <div className="flex min-h-[220px] items-center justify-center border-t border-slate-200 bg-white p-6 text-center">
      <p className="max-w-lg text-sm text-slate-500">{label}</p>
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
        className="custom-scrollbar max-h-[35rem] overflow-auto border-t border-slate-200 bg-white"
      >
        <table className={`${minWidthClass} w-full border-collapse text-left text-xs text-[#3d200a]`}>
          {children}
        </table>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent transition-opacity duration-200",
          showLeftFade ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent transition-opacity duration-200",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent transition-opacity duration-200",
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
          "sticky border-b border-r border-white/15 bg-[#6f0000] px-3 py-2.5 text-[11px] font-semibold text-white",
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
        "border-b border-r border-slate-200 px-3 py-3 align-top text-sm",
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
  count,
  exportFormat,
  onExportFormatChange,
  onExport,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  exportFormat: ExportFormat;
  onExportFormatChange: (value: ExportFormat) => void;
  onExport: () => void;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">{count} {count === 1 ? "row" : "rows"}</span>
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
            <select
              value={exportFormat}
              onChange={(event) => onExportFormatChange(event.target.value as ExportFormat)}
              aria-label="Export format"
              className="border-0 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
            >
              <option value="cyclonedx">CycloneDX 1.6 JSON</option>
              <option value="spdx">SPDX 2.3 JSON</option>
              <option value="per-asset">Per-asset details JSON</option>
              <option value="csv">Current table CSV</option>
            </select>
            <button
              type="button"
              onClick={onExport}
              className="inline-flex h-9 w-10 items-center justify-center border-l border-slate-300 bg-[#8B0000] text-white transition hover:bg-[#6f0000]"
              aria-label="Download selected CBOM export"
              title="Download selected export"
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
  const [activeTab, setActiveTab] = useState<CbomTabKey>("assets");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("cyclonedx");

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
        key: "assets" as const,
        label: "Assets",
        icon: Boxes,
        count: data.assets.length,
        title: "Asset inventory",
        subtitle: "Cryptographic coverage from the latest completed scan for each asset and endpoint.",
        jsonFilename: "certin-cbom-assets.json",
        csvFilename: "certin-cbom-assets.csv",
        payload: data.assets,
        csvContent: buildCsv(data.assets, [
          { header: "Asset", accessor: (row) => row.assetName },
          { header: "Type", accessor: (row) => row.assetType },
          { header: "Endpoints", accessor: (row) => row.endpoints.map((endpoint) => `${endpoint.port}/${endpoint.protocol}`).join("\n") },
          { header: "Algorithms", accessor: (row) => row.algorithms.length },
          { header: "Keys", accessor: (row) => row.keys.length },
          { header: "Protocols", accessor: (row) => row.protocols.length },
          { header: "Certificates", accessor: (row) => row.certificates.length },
        ]),
        emptyLabel: "No assets have completed an OpenSSL endpoint scan yet.",
        minWidthClass: "min-w-[820px]",
        table: (
          <>
            <thead>
              <tr>
                <TableHeadCell>Asset</TableHeadCell>
                <TableHeadCell>Type</TableHeadCell>
                <TableHeadCell>Scanned endpoints</TableHeadCell>
                <TableHeadCell centered>Algorithms</TableHeadCell>
                <TableHeadCell centered>Keys</TableHeadCell>
                <TableHeadCell centered>Protocols</TableHeadCell>
                <TableHeadCell centered>Certificates</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              {data.assets.map((row) => (
                <tr key={row.assetId} className="transition hover:bg-slate-50">
                  <TableCell><span className="font-medium text-slate-950">{row.assetName}</span></TableCell>
                  <TableCell noWrap>{row.assetType}</TableCell>
                  <TableCell mono noWrap>{row.endpoints.map((endpoint) => `${endpoint.port}/${endpoint.protocol}`).join(", ")}</TableCell>
                  <TableCell><span className="block text-center tabular-nums">{row.algorithms.length}</span></TableCell>
                  <TableCell><span className="block text-center tabular-nums">{row.keys.length}</span></TableCell>
                  <TableCell><span className="block text-center tabular-nums">{row.protocols.length}</span></TableCell>
                  <TableCell><span className="block text-center tabular-nums">{row.certificates.length}</span></TableCell>
                </tr>
              ))}
            </tbody>
          </>
        ),
      },
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
    const uuid = crypto.randomUUID();
    if (exportFormat === "spdx") {
      downloadJson("quantwarden-cbom.spdx.json", buildSpdxInteropDocument(data, uuid));
      return;
    }
    if (exportFormat === "per-asset") {
      downloadJson("quantwarden-cbom-per-asset.json", buildPerAssetCbomExport(data));
      return;
    }
    downloadJson("quantwarden-cbom.cdx.json", buildCycloneDxCbom(data, uuid));
  };

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5 pb-10 animate-in fade-in duration-300">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#8B0000]">
            <ScrollText className="h-5 w-5" />
            <h1 className="text-2xl font-semibold tracking-tight text-[#3d200a]">CERT-IN CBOM</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[#8a5d33]">
            Cryptographic inventory derived from the latest completed endpoint scans.
          </p>
        </div>
        <p className="text-xs text-[#8a5d33]">Generated {new Date(data.generatedAt).toLocaleString()}</p>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur">
        <nav aria-label="CBOM inventory" className="flex overflow-x-auto border-b border-slate-200 px-3">
          {tabs.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition",
                  selected ? "text-[#8B0000]" : "text-slate-500 hover:text-slate-900"
                )}
              >
                {tab.label}
                <span className={cn("rounded-full px-2 py-0.5 text-xs", selected ? "bg-[#8B0000]/10 text-[#8B0000]" : "bg-slate-100 text-slate-500")}>{tab.count}</span>
                {selected ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[#8B0000]" /> : null}
              </button>
            );
          })}
        </nav>

        <DataPanel
          title={activeConfig.title}
          subtitle={activeConfig.subtitle}
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
      </section>

      <details className="rounded-lg border border-slate-200 bg-white/60 px-4 py-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-medium text-slate-700">
          <AlertTriangle className="h-4 w-4 text-[#8B0000]" /> Coverage and export notes
        </summary>
        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-slate-600">
          <p>
            CycloneDX {CYCLONEDX_CBOM_SPEC_VERSION} is the native CBOM export. SPDX {SPDX_INTEROP_SPEC_VERSION} is provided as an interoperability view. Per-asset export creates a CycloneDX document for each asset.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {data.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
      </details>
    </div>
  );
}
