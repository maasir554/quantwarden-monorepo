import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REPORT_SCORING_PENALTIES,
  REPORT_SCORING_RULES,
  REPORT_TIER_BANDS,
  type OrganizationReportPayload,
  type ReportSectionKey,
  type ReportTone,
} from "@/lib/reporting";

export interface LatexReportOptions {
  heading: string;
  subtitle: string;
  sections: Record<ReportSectionKey, boolean>;
}

const TONE_COLORS: Record<ReportTone, string> = {
  emerald: "QWGreen",
  blue: "QWBlue",
  amber: "QWGold",
  red: "QWRed",
};

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function tex(value: unknown) {
  return ascii(value).replace(/[\\{}$&#_%~^]/g, (character) => {
    const escaped: Record<string, string> = {
      "\\": "\\textbackslash{}",
      "{": "\\{",
      "}": "\\}",
      "$": "\\$",
      "&": "\\&",
      "#": "\\#",
      "_": "\\_",
      "%": "\\%",
      "~": "\\textasciitilde{}",
      "^": "\\textasciicircum{}",
    };
    return escaped[character];
  });
}

function texAsset(value: unknown) {
  return tex(value)
    .replace(/\\./g, ".\\allowbreak{}")
    .replace(/-/g, "-\\allowbreak{}");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}

function section(title: string, body: string) {
  return `\\section{${tex(title)}}\\thispagestyle{fancy}\n${body}\n`;
}

function metricCards(data: OrganizationReportPayload) {
  const metrics = [
    ["PQC score", `${data.pqc.averageScore}/100`],
    ["Readiness", data.pqc.status],
    ["Scored assets", data.coverage.totalAssetsScored],
    ["Scored ports", data.coverage.totalPortsScored],
  ];
  return `\\begin{tabularx}{\\textwidth}{|*{4}{>{\\centering\\arraybackslash}X|}}
\\hline
${metrics.map(([label]) => `\\textbf{${tex(label)}}`).join(" & ")} \\\\ \\hline
${metrics.map(([, value]) => `\\Large\\textbf{${tex(value)}}`).join(" & ")} \\\\ \\hline
\\end{tabularx}`;
}

type PdfChartRow = {
  label: string;
  value: number;
  color: string;
  display?: string;
};

function percent(value: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
}

function horizontalBarChart(rows: PdfChartRow[], maxValue?: number, includeLegend = true) {
  const chartMax = Math.max(1, maxValue || 0, ...rows.map((row) => row.value));
  const commands = rows.map((row, index) => {
    const y = (rows.length - index - 1) * 0.82;
    const width = Math.max(0, Math.min(5.2, (row.value / chartMax) * 5.2));
    return `\\fill[QWLight] (0,${y.toFixed(2)}) rectangle (5.2,${(y + 0.28).toFixed(2)});
\\fill[${row.color}] (0,${y.toFixed(2)}) rectangle (${width.toFixed(2)},${(y + 0.28).toFixed(2)});`;
  }).join("\n");

  const tableRows = rows.map((row) => {
    const share = maxValue
      ? percent(row.value, maxValue)
      : percent(row.value, rows.reduce((sum, item) => sum + Math.max(0, item.value), 0));
    return `\\textcolor{${row.color}}{\\rule{1em}{1em}} & ${tex(row.label)} & ${tex(row.display ?? row.value)} & ${share}\\% \\\\ \\hline`;
  }).join("\n");

  return `\\begin{minipage}{\\linewidth}
\\begin{center}
\\begin{tikzpicture}[x=1cm,y=1cm]
${commands}
\\end{tikzpicture}
\\end{center}
${includeLegend ? `
\\begin{tabularx}{\\linewidth}{|>{\\centering\\arraybackslash}p{0.08\\linewidth}|>{\\raggedright\\arraybackslash}X|>{\\centering\\arraybackslash}p{0.17\\linewidth}|>{\\centering\\arraybackslash}p{0.15\\linewidth}|}
\\hline \\textbf{Key} & \\textbf{Label} & \\textbf{Value} & \\textbf{Share} \\\\ \\hline
${tableRows}
\\end{tabularx}` : ""}
\\end{minipage}`;
}

function donutChart(rows: PdfChartRow[], centerLabel: string) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  let angle = 90;
  const arcs = rows.filter((row) => row.value > 0).map((row) => {
    const nextAngle = angle - (row.value / Math.max(1, total)) * 360;
    const command = `\\draw[${row.color},line width=8pt] (${angle.toFixed(2)}:1cm) arc[start angle=${angle.toFixed(2)},end angle=${nextAngle.toFixed(2)},radius=1cm];`;
    angle = nextAngle;
    return command;
  }).join("\n");
  const legend = rows.map((row) =>
    `\\textcolor{${row.color}}{\\rule{1em}{1em}} & ${tex(row.label)} & \\textbf{${row.value}} & ${percent(row.value, total)}\\% \\\\ \\hline`
  ).join("\n");

  return `\\begin{center}
\\begin{tikzpicture}
\\draw[QWLight,line width=8pt] (0,0) circle (1cm);
${arcs}
\\node[align=center,font=\\normalsize\\bfseries] at (0,0) {${tex(centerLabel)}};
\\end{tikzpicture}
\\end{center}
\\begin{tabularx}{\\linewidth}{|>{\\centering\\arraybackslash}p{0.08\\linewidth}|>{\\raggedright\\arraybackslash}X|>{\\centering\\arraybackslash}p{0.16\\linewidth}|>{\\centering\\arraybackslash}p{0.16\\linewidth}|}
\\hline \\textbf{Key} & \\textbf{Label} & \\textbf{Value} & \\textbf{Share} \\\\ \\hline
${legend}
\\end{tabularx}`;
}

function executiveSummary(data: OrganizationReportPayload) {
  const scoredPercent = percent(data.coverage.totalAssetsScored, data.coverage.totalAssets);
  const reachablePercent = percent(data.coverage.reachableTlsEndpoints, data.coverage.totalScannedEndpoints);
  return section("Executive summary", `${metricCards(data)}

\\subsection*{Key findings}
\\begin{itemize}
${data.summaryHighlights.map((item) => `  \\item ${tex(item)}`).join("\n")}
\\end{itemize}

\\subsection*{Coverage at a glance}
${horizontalBarChart([
    { label: "Assets with a PQC score", value: scoredPercent, color: "QWBlue", display: `${data.coverage.totalAssetsScored} / ${data.coverage.totalAssets}` },
    { label: "Reachable TLS endpoints", value: reachablePercent, color: "QWGreen", display: `${data.coverage.reachableTlsEndpoints} / ${data.coverage.totalScannedEndpoints}` },
  ], 100)}`);
}

function securityOverview(data: OrganizationReportPayload) {
  const tlsRows: PdfChartRow[] = data.overview.tlsVersionMix.length
    ? data.overview.tlsVersionMix.map((row) => ({
        label: row.name,
        value: row.value,
        color: row.name.startsWith("Danger")
          ? "QWRed"
          : row.name === "TLS 1.3 only"
            ? "QWGreen"
            : row.name === "TLS 1.2 + 1.3"
              ? "QWBlue"
              : row.name === "TLS 1.2 only"
                ? "QWGold"
                : "QWMuted",
      }))
    : [{ label: "No TLS version data", value: 0, color: "QWMuted" }];
  const certRows: PdfChartRow[] = data.overview.certificateHealth.map((row) => ({
    label: row.label,
    value: row.value,
    color: TONE_COLORS[row.tone],
  }));
  return section("Security overview", `\\subsection*{TLS endpoint posture}
Each reachable endpoint is counted once. Deprecated TLS exposure takes precedence over otherwise modern protocol support.\\par\\medskip
${horizontalBarChart(tlsRows)}

\\vspace{1.1em}
\\begin{minipage}{\\textwidth}
\\subsection*{Certificate health}
${donutChart(certRows, `${certRows.reduce((sum, row) => sum + row.value, 0)} certs`)}
\\end{minipage}

\\vspace{1.1em}
\\subsection*{Operational indicators}
\\begin{tabularx}{\\textwidth}{|>{\\raggedright\\arraybackslash}p{0.28\\textwidth}|>{\\centering\\arraybackslash}p{0.12\\textwidth}|>{\\raggedright\\arraybackslash}X|}
\\hline \\textbf{Indicator} & \\textbf{Endpoints} & \\textbf{Analytical meaning} \\\\ \\hline
Strong cipher posture & ${data.overview.strongCipherCount} & Preferred cipher evidence is modern. \\\\ \\hline
Weak cipher posture & ${data.overview.weakCipherCount} & Cipher configuration requires review or hardening. \\\\ \\hline
Self-signed certificates & ${data.overview.selfSignedCount} & Trust is not anchored to a recognised certificate authority. \\\\ \\hline
Protocol remediation needed & ${data.overview.tlsDowngradeVulnerable} & Endpoint lacks TLS 1.3 or still exposes TLS 1.0 / 1.1. \\\\ \\hline
\\end{tabularx}`);
}

function pqcPosture(data: OrganizationReportPayload) {
  const score = Math.max(0, Math.min(100, data.pqc.averageScore));
  return section("Post-quantum readiness", `${metricCards(data)}

\\vspace{1em}
\\textbf{Readiness progress}\\par
\\noindent\\colorbox{QWLight}{\\parbox[c][8pt][c]{0.98\\textwidth}{\\color{QWRed}\\rule{${score / 100}\\linewidth}{8pt}}}

\\vspace{0.8em}
The organization is currently classified as \\textbf{${tex(data.pqc.status)}} (Tier ${tex(data.pqc.tier)}). The score is calculated from the latest completed endpoint scans and reflects key exchange, symmetric encryption, protocol version, and certificate authentication posture.`);
}

function methodology() {
  const tierRows = REPORT_TIER_BANDS.map(
    (row) => `${tex(row.tier)} & ${tex(row.scoreRange)} & ${tex(row.meaning)} \\\\ \\hline`
  ).join("\n");
  const ruleRows = REPORT_SCORING_RULES.map(
    (row) => `${tex(row.pillar)} & ${tex(row.condition)} & \\textbf{${tex(row.points)}} \\\\ \\hline`
  ).join("\n");
  const penaltyRows = REPORT_SCORING_PENALTIES.map(
    (row) => `${tex(row.condition)} & \\textbf{${tex(row.points)}} \\\\ \\hline`
  ).join("\n");
  return `\\clearpage
${section("Scoring methodology", `\\subsection*{Tier interpretation}
\\begin{longtable}{|>{\\raggedright\\arraybackslash}p{0.15\\textwidth}|>{\\raggedright\\arraybackslash}p{0.22\\textwidth}|>{\\raggedright\\arraybackslash}p{0.52\\textwidth}|}
\\hline \\textbf{Tier} & \\textbf{Score} & \\textbf{Meaning} \\\\ \\hline
${tierRows}
\\end{longtable}

\\subsection*{Exact scoring rules}
Only the highest matching rule in each pillar is awarded. The four pillar scores are added, then all applicable penalties are subtracted. The final score is clamped to 0-100.
\\begin{longtable}{|>{\\raggedright\\arraybackslash}p{0.22\\textwidth}|>{\\raggedright\\arraybackslash}p{0.61\\textwidth}|>{\\centering\\arraybackslash}p{0.09\\textwidth}|}
\\hline \\textbf{Pillar} & \\textbf{Condition} & \\textbf{Points} \\\\ \\hline
${ruleRows}
\\end{longtable}

\\subsection*{Penalties}
\\begin{longtable}{|>{\\raggedright\\arraybackslash}p{0.78\\textwidth}|>{\\centering\\arraybackslash}p{0.14\\textwidth}|}
\\hline \\textbf{Condition} & \\textbf{Points} \\\\ \\hline
${penaltyRows}
\\end{longtable}`)}`;
}

function tierDistribution(data: OrganizationReportPayload) {
  const tierColors: Record<string, string> = { A: "QWGreen", B: "QWBlue", C: "QWGold", D: "QWRed", F: "QWText" };
  const riskLevels: Record<string, string> = { A: "Low", B: "Moderate", C: "Elevated", D: "High", F: "Critical / reserved" };
  const rows: PdfChartRow[] = data.tierDistribution.map((bucket) => ({
    label: `${bucket.label} - ${bucket.status}`,
    value: bucket.percent,
    color: tierColors[bucket.tier] || "QWMuted",
    display: `${bucket.count} (${bucket.percent}%)`,
  }));
  const matrixRows = data.tierDistribution.map((bucket) => {
    const band = REPORT_TIER_BANDS.find((item) => item.tier === bucket.tier);
    return `\\textcolor{${tierColors[bucket.tier] || "QWMuted"}}{\\rule{1em}{1em}} & \\textbf{${tex(bucket.tier)}} & ${tex(riskLevels[bucket.tier] || bucket.status)} & ${tex(band?.scoreRange || "-")} & ${bucket.count} & ${bucket.percent}\\% & ${tex(band?.guidance || bucket.status)} \\\\ \\hline`;
  }).join("\n");
  return `\\clearpage
${section("Tier distribution and risk overview", `The matrix shows how scored assets are distributed across readiness tiers and what each tier means for remediation priority.

${horizontalBarChart(rows, 100, false)}

\\vspace{0.7em}
\\begin{longtable}{|>{\\centering\\arraybackslash}p{0.05\\textwidth}|>{\\centering\\arraybackslash}p{0.06\\textwidth}|>{\\raggedright\\arraybackslash}p{0.13\\textwidth}|>{\\centering\\arraybackslash}p{0.10\\textwidth}|>{\\centering\\arraybackslash}p{0.08\\textwidth}|>{\\centering\\arraybackslash}p{0.08\\textwidth}|>{\\raggedright\\arraybackslash}p{0.34\\textwidth}|}
\\hline \\textbf{Key} & \\textbf{Tier} & \\textbf{Risk} & \\textbf{Score} & \\textbf{Assets} & \\textbf{Share} & \\textbf{Analysis} \\\\ \\hline
${matrixRows}
\\end{longtable}`)}`;
}

function tierAssets(data: OrganizationReportPayload) {
  const rows = data.assets.map((asset) => {
    const evidence = `\\textbf{Key exchange:} ${tex(asset.primaryKeyExchange || "Not reported")}\\newline \\textbf{Cipher:} ${tex(asset.primaryEncryption || "Not reported")}`;
    return `${texAsset(asset.value)} & \\textbf{${tex(asset.tier)}} - ${tex(asset.status)} & ${asset.averageScore}/100 & ${asset.portCount} & ${evidence} \\\\ \\hline`;
  }).join("\n");
  const content = rows
    ? `Assets are ordered by remediation priority, then score. Port count reflects the latest scored endpoint coverage.
\\begin{longtable}{|>{\\raggedright\\arraybackslash}p{0.25\\textwidth}|>{\\raggedright\\arraybackslash}p{0.15\\textwidth}|>{\\centering\\arraybackslash}p{0.10\\textwidth}|>{\\centering\\arraybackslash}p{0.08\\textwidth}|>{\\raggedright\\arraybackslash}p{0.31\\textwidth}|}
\\hline \\textbf{Asset} & \\textbf{Tier / risk} & \\textbf{Score} & \\textbf{Ports} & \\textbf{Primary evidence} \\\\ \\hline
${rows}
\\end{longtable}`
    : "No scored assets are available for this report.";
  return section("Asset-wise risk table", content);
}

function pqcSupport(data: OrganizationReportPayload) {
  const chartRows: PdfChartRow[] = data.pqcSupport.map((bucket) => ({
    label: bucket.label,
    value: bucket.count,
    color: bucket.key === "supported" ? "QWGreen" : "QWRed",
  }));
  const blocks = data.pqcSupport.map((bucket) => {
    const names = bucket.assets.slice(0, 12).map((asset) => tex(asset.value));
    return `${tex(bucket.label)} & ${bucket.count} & ${bucket.percent}\\% & ${names.length ? names.join(", ") : "No assets"} \\\\ \\hline`;
  }).join("\n");
  return `\\clearpage
${section("PQC support", `
${donutChart(chartRows, `${data.coverage.totalAssetsScored} assets`)}

\\vspace{0.8em}
\\begin{tabularx}{\\textwidth}{|>{\\raggedright\\arraybackslash}p{0.20\\textwidth}|>{\\centering\\arraybackslash}p{0.10\\textwidth}|>{\\centering\\arraybackslash}p{0.12\\textwidth}|>{\\raggedright\\arraybackslash}X|}
\\hline \\textbf{Status} & \\textbf{Count} & \\textbf{Share} & \\textbf{Assets} \\\\ \\hline
${blocks}
\\end{tabularx}`)}`;
}

function immediateAttention(data: OrganizationReportPayload) {
  const rows = data.immediateAttention.flatMap((bucket) =>
    bucket.assets.map(
      (asset) =>
        `\\textcolor{${TONE_COLORS[bucket.tone]}}{${tex(bucket.label)}} & ${texAsset(asset.name)} & ${tex(asset.issue)} \\\\ \\hline`,
    ),
  );
  const content = rows.length
    ? `Current DNS, certificate, and TLS findings that should be prioritised for remediation.
\\begin{longtable}{|>{\\raggedright\\arraybackslash}p{0.18\\textwidth}|>{\\raggedright\\arraybackslash}p{0.26\\textwidth}|>{\\raggedright\\arraybackslash}p{0.47\\textwidth}|}
\\hline \\textbf{Category} & \\textbf{Asset} & \\textbf{Finding} \\\\ \\hline
${rows.join("\n")}
\\end{longtable}`
    : "No immediate DNS, certificate, or TLS findings were identified.";
  return `\\clearpage
${section("Immediate attention", content)}`;
}

function suggestedChanges(data: OrganizationReportPayload) {
  const rows = data.suggestedChanges.map((item) => {
    const findings = item.findings.length
      ? item.findings
          .map((finding) => `\\textbf{${tex(finding.label)}:} ${tex(finding.value)}`)
          .join("\\par\\smallskip\n")
      : "No structured findings";
    const actions = item.actions
      .map((action) => `\\textcolor{QWRed}{\\textbullet}~${tex(action)}`)
      .join("\\par\\smallskip\n");
    return `\\textbf{${texAsset(item.assetName)}}\\newline \\textcolor{QWMuted}{\\small ${tex(item.port)}} & ${findings} & ${actions} \\\\ \\hline`;
  });
  const content = rows.length
    ? `Recommendations are endpoint-specific. Non-TLS services are flagged for classification rather than automatically being told to enable TLS.
\\begin{longtable}{|>{\\raggedright\\arraybackslash}p{0.24\\textwidth}|>{\\raggedright\\arraybackslash}p{0.29\\textwidth}|>{\\raggedright\\arraybackslash}p{0.38\\textwidth}|}
\\hline \\textbf{Endpoint} & \\textbf{Observed posture} & \\textbf{Recommended actions} \\\\ \\hline
${rows.join("\n")}
\\end{longtable}`
    : "No endpoint recommendations are available because no completed endpoint scans were found.";
  return section("Suggested changes by asset and port", content);
}

export function buildLatexReport(data: OrganizationReportPayload, options: LatexReportOptions) {
  const bodies = [
    options.sections.executiveSummary ? executiveSummary(data) : "",
    options.sections.securityOverview ? securityOverview(data) : "",
    options.sections.pqcPosture ? pqcPosture(data) : "",
    options.sections.tierDistribution ? tierDistribution(data) : "",
    options.sections.pqcSupport ? pqcSupport(data) : "",
    options.sections.tierAssets ? tierAssets(data) : "",
    options.sections.immediateAttention ? immediateAttention(data) : "",
    options.sections.suggestedChanges ? suggestedChanges(data) : "",
    options.sections.tierMethodology ? methodology() : "",
  ].filter(Boolean).join("\\medskip\n");

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[scaled=0.98]{helvet}
\\usepackage[left=18mm,right=18mm,top=20mm,bottom=18mm,headheight=16pt]{geometry}
\\usepackage[table]{xcolor}
\\usepackage{tikz}
\\usepackage{tabularx,longtable,booktabs,array}
\\usepackage{fancyhdr}
\\usepackage[hidelinks]{hyperref}
\\definecolor{QWRed}{HTML}{8B0000}
\\definecolor{QWGold}{HTML}{9A6728}
\\definecolor{QWBlue}{HTML}{365C7D}
\\definecolor{QWGreen}{HTML}{387D66}
\\definecolor{QWText}{HTML}{25364A}
\\definecolor{QWMuted}{HTML}{5E6B7A}
\\definecolor{QWLight}{HTML}{E8EBEF}
\\renewcommand{\\familydefault}{\\sfdefault}
\\color{QWText}
\\arrayrulecolor{QWMuted}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{5pt}
\\emergencystretch=2em
\\renewcommand{\\arraystretch}{1.28}
\\setlength{\\tabcolsep}{5pt}
\\raggedbottom
\\pagestyle{fancy}
\\fancyhf{}
\\lhead{\\textbf{${tex(data.organization.name)}}}
\\rhead{\\small\\textcolor{QWMuted}{QuantWarden}}
\\cfoot{\\small\\textcolor{QWMuted}{Confidential - Page \\thepage}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\fancypagestyle{plain}{\\fancyhf{}\\lhead{\\textbf{${tex(data.organization.name)}}}\\rhead{\\small\\textcolor{QWMuted}{QuantWarden}}\\cfoot{\\small\\textcolor{QWMuted}{Confidential - Page \\thepage}}\\renewcommand{\\headrulewidth}{0.4pt}}
\\makeatletter
\\renewcommand\\section{\\@startsection{section}{1}{0pt}{1.4em}{0.65em}{\\Large\\bfseries\\color{QWRed}}}
\\makeatother
\\begin{document}
\\hypersetup{pdftitle={${tex(options.heading)}},pdfauthor={QuantWarden},pdfsubject={Security posture and post-quantum readiness report},pageanchor=false}
\\begin{titlepage}
\\vspace*{24mm}
{\\color{QWRed}\\rule{\\textwidth}{3pt}}\\par
\\vspace{16mm}
\\begin{minipage}{\\textwidth}\\raggedright\\hyphenpenalty=10000
{\\LARGE\\bfseries ${tex(options.heading)}}\\par
\\vspace{5mm}
{\\large\\color{QWMuted} ${tex(options.subtitle)}}\\par
\\end{minipage}
\\vfill
{\\large\\bfseries ${tex(data.organization.name)}}\\par
\\vspace{3mm}
Generated ${tex(formatDate(data.generatedAt))}\\par
\\vspace{12mm}
{\\color{QWRed}\\rule{\\textwidth}{1pt}}
\\end{titlepage}
\\pagestyle{fancy}
\\hypersetup{pageanchor=true}
${bodies}
\\end{document}`;
}

function runPdflatex(directory: string) {
  return new Promise<void>((resolve, reject) => {
    const binary = process.env.LATEX_BIN || "pdflatex";
    const child = spawn(binary, ["-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", "report.tex"], {
      cwd: directory,
      env: { ...process.env, max_print_line: "1000" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let errors = "";
    const collectOutput = (chunk: Buffer) => {
      if (errors.length < 12000) errors += chunk.toString();
    };
    child.stdout.on("data", collectOutput);
    child.stderr.on("data", collectOutput);
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("LaTeX compilation exceeded 45 seconds."));
    }, 45_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      code === 0 ? resolve() : reject(new Error(`LaTeX compilation failed (${code}). ${errors.slice(-3000)}`));
    });
  });
}

export async function generateLatexPdf(data: OrganizationReportPayload, options: LatexReportOptions) {
  const directory = await mkdtemp(join(tmpdir(), "quantwarden-report-"));
  try {
    await writeFile(join(directory, "report.tex"), buildLatexReport(data, options), "utf8");
    await runPdflatex(directory);
    return await readFile(join(directory, "report.pdf"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
