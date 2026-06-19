"use client";

import { useState } from "react";
import {
  Users, Calendar, Search, ArrowLeft, BarChart2,
  Mail, FolderOpen, Link2, Send, Settings2, FileText,
  Globe, Layers, Cpu, Shield, Star, ChevronDown,
} from "lucide-react";

type SubView = "hub" | "executives" | "scheduled" | "ondemand";

const reportTypeOptions = [
  { icon: BarChart2, label: "Executive Reporting" },
  { icon: Search,    label: "Assets Discovery" },
  { icon: Layers,    label: "Assets Inventory" },
  { icon: Cpu,       label: "CBOM" },
  { icon: Shield,    label: "Posture of PQC" },
  { icon: Star,      label: "Cyber Rating (Tiers 1 – 4)" },
];

const executiveSummary = [
  { label: "Overall Posture Score", value: "755 / 1000", color: "text-emerald-300" },
  { label: "Critical Assets",       value: "2",          color: "text-rose-300" },
  { label: "Certs Expiring Soon",   value: "57",         color: "text-amber-300" },
  { label: "PQC Adoption",          value: "33%",        color: "text-cyan-300" },
];

// ──────────────────────────────────────────────────────
// Sub: Executives Reporting
// ──────────────────────────────────────────────────────
function ExecutivesView({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition">
        <ArrowLeft className="h-4 w-4" /> Back to Reporting
      </button>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-indigo-500/20 p-2.5 text-indigo-300"><Users className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Executives Reporting</h2>
            <p className="text-xs text-slate-400">High-level security posture summary for leadership</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          {executiveSummary.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 mb-4">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Executive Summary — Punjab National Bank</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            QuantWarden has completed its latest quantum-threat assessment across <span className="text-slate-200">1,284 PNB assets</span> spanning 18 banking circles across India.
            Punjab National Bank holds an <span className="text-emerald-300 font-medium">Elite-PQC</span> rating of <span className="text-emerald-300 font-medium">755/1000</span>,
            reflecting strong TLS configurations on core digital banking infrastructure.
            Immediate attention is required on <span className="text-rose-300">2 critical-risk assets</span> (including <code className="text-rose-200 text-xs">corebanking.pnb.co.in</code>) and <span className="text-amber-300">57 expiring certificates</span>.
            PQC algorithm migration is <span className="text-cyan-300">33% complete</span> — on track for RBI compliance deadline.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "Certificate Health", val: 78, color: "#22d3ee" },
            { label: "Cipher Compliance",  val: 85, color: "#34d399" },
            { label: "PQC Readiness",      val: 33, color: "#818cf8" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-400">{item.label}</span>
                <span className="text-xs font-bold text-slate-200">{item.val}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-700">
                <div className="h-2 rounded-full" style={{ width: `${item.val}%`, background: item.color }} />
              </div>
            </div>
          ))}
        </div>

        <button className="mt-5 w-full rounded-xl bg-indigo-500/20 border border-indigo-400/30 py-3 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30 transition">
          <FileText className="inline h-4 w-4 mr-2" />Download PDF Report
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Sub: Scheduled Reporting
// ──────────────────────────────────────────────────────
function ScheduledView({ onBack }: { onBack: () => void }) {
  const [sections, setSections] = useState({
    Discovery: true, Inventory: true, CBOM: true, "PQC Posture": true, "Cyber Rating": true,
  });
  const [deliveryEmail, setDeliveryEmail] = useState(true);
  const [deliverySave, setDeliverySave] = useState(true);
  const [deliveryLink, setDeliveryLink] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const toggle = (key: string) => setSections((p) => ({ ...p, [key]: !p[key as keyof typeof p] }));

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition">
        <ArrowLeft className="h-4 w-4" /> Back to Reporting
      </button>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-cyan-500/20 p-2.5 text-cyan-300 flex-shrink-0"><Calendar className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-100">Schedule Reporting</h2>
              <p className="text-xs text-slate-400">Automate recurring security reports</p>
            </div>
          </div>
          {/* Enable toggle */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-slate-400 whitespace-nowrap">Enable Schedule</span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative h-7 w-14 rounded-full transition-colors ${enabled ? "bg-cyan-500" : "bg-slate-600"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-8" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Left column */}
          <div className="space-y-5">
            {/* Report Type */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Report Type</label>
              <div className="relative">
                <select className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none">
                  <option>Executive Summary Report</option>
                  <option>Full Technical Report</option>
                  <option>PQC Compliance Report</option>
                  <option>Certificate Audit Report</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Frequency</label>
              <div className="relative">
                <select className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none">
                  <option>Weekly</option>
                  <option>Daily</option>
                  <option>Bi-Weekly</option>
                  <option>Monthly</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Select Assets */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Select Assets</label>
              <div className="relative">
                <select className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none">
                  <option>All Assets</option>
                  <option>Critical Only</option>
                  <option>High Risk</option>
                  <option>Public Web Apps</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Include Sections */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-3">Include Sections</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(sections).map(([key, val]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => toggle(key)}
                      className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${val ? "bg-cyan-500 border-cyan-500" : "border-slate-500 bg-transparent"}`}
                    >
                      {val && <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <span className="text-xs text-slate-300">{key}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Schedule Details */}
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-semibold text-cyan-200">Schedule Details</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Date</label>
                  <div className="relative">
                    <input type="date" defaultValue="2026-04-25"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Time</label>
                  <div className="relative">
                    <select className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none">
                      <option>09:00 AM (IST)</option>
                      <option>12:00 PM (IST)</option>
                      <option>06:00 PM (IST)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <p className="text-xs text-slate-500">Time Zone: Asia/Kolkata</p>
              </div>
            </div>

            {/* Delivery Options */}
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Send className="h-4 w-4 text-indigo-300" />
                <h3 className="text-sm font-semibold text-indigo-200">Delivery Options</h3>
              </div>
              <div className="space-y-3">
                {/* Email */}
                <div className="flex items-center gap-3">
                  <button onClick={() => setDeliveryEmail(!deliveryEmail)}
                    className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${deliveryEmail ? "bg-cyan-500 border-cyan-500" : "border-slate-500"}`}>
                    {deliveryEmail && <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300 w-24 flex-shrink-0">Email</span>
                  <input type="email" defaultValue="ciso@pnb.co.in"
                    className="flex-1 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none" />
                </div>
                {/* Save to Location */}
                <div className="flex items-center gap-3">
                  <button onClick={() => setDeliverySave(!deliverySave)}
                    className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${deliverySave ? "bg-cyan-500 border-cyan-500" : "border-slate-500"}`}>
                    {deliverySave && <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300 w-24 flex-shrink-0">Save to Local</span>
                  <span className="flex-1 min-w-0 truncate rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400">/PNB/Reports/Quarterly/</span>
                </div>
                {/* Download Link */}
                <div className="flex items-center gap-3">
                  <button onClick={() => setDeliveryLink(!deliveryLink)}
                    className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${deliveryLink ? "bg-cyan-500 border-cyan-500" : "border-slate-500"}`}>
                    {deliveryLink && <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                  <Link2 className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-300">Download Link</span>
                </div>
              </div>
            </div>

            <button className="w-full rounded-xl bg-cyan-500/20 border border-cyan-400/30 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/30 transition flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4" /> Schedule Report →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Sub: On-Demand Reporting
// ──────────────────────────────────────────────────────
function OnDemandView({ onBack }: { onBack: () => void }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [saveLocation, setSaveLocation] = useState(true);
  const [downloadLink, setDownloadLink] = useState(false);
  const [slackNotif, setSlackNotif] = useState(false);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [passwordProtect, setPasswordProtect] = useState(false);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition">
        <ArrowLeft className="h-4 w-4" /> Back to Reporting
      </button>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-indigo-500/20 p-2.5 text-indigo-300"><Search className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">On-Demand Reporting</h2>
            <p className="text-xs text-slate-400">Request reports as needed</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Left: Report Type dropdown */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Report Type</label>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-200"
                >
                  <span className={selectedReport ? "text-slate-100" : "text-slate-500"}>
                    {selectedReport || "Select Report"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-white/10 bg-slate-900 shadow-xl overflow-hidden">
                    {reportTypeOptions.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => { setSelectedReport(opt.label); setDropdownOpen(false); }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 text-left"
                        >
                          <Icon className="h-4 w-4 text-slate-400" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Advanced Settings</h3>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                {/* File Format */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">File Format</label>
                  <div className="relative">
                    <select className="appearance-none rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none pr-7">
                      <option>PDF</option><option>CSV</option><option>XLSX</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  </div>
                </div>
                {/* Include Charts toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Include Charts</span>
                  <button onClick={() => setIncludeCharts(!includeCharts)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${includeCharts ? "bg-cyan-500" : "bg-slate-600"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${includeCharts ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {/* Password Protect toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Password Protect</span>
                  <button onClick={() => setPasswordProtect(!passwordProtect)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${passwordProtect ? "bg-cyan-500" : "bg-slate-600"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${passwordProtect ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Delivery Options */}
          <div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-4 w-4 text-indigo-300" />
                <h3 className="text-sm font-semibold text-indigo-200">Delivery Options</h3>
              </div>

              {/* Send via Email */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSendEmail(!sendEmail)}
                      className={`h-4 w-4 rounded border flex items-center justify-center ${sendEmail ? "bg-cyan-500 border-cyan-500" : "border-slate-500"}`}>
                      {sendEmail && <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-300">Send via Email</span>
                  </div>
                  <button onClick={() => setSendEmail(!sendEmail)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${sendEmail ? "bg-cyan-500" : "bg-slate-600"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${sendEmail ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                <input type="email" placeholder="Enter Email Addresses"
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none" />
              </div>

              {/* Save to Location */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSaveLocation(!saveLocation)}
                      className={`h-4 w-4 rounded border flex items-center justify-center ${saveLocation ? "bg-cyan-500 border-cyan-500" : "border-slate-500"}`}>
                      {saveLocation && <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                    <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-300">Save to Location</span>
                  </div>
                  <button onClick={() => setSaveLocation(!saveLocation)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${saveLocation ? "bg-cyan-500" : "bg-slate-600"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${saveLocation ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
                  <span className="text-xs text-slate-400 flex-1">/Reports/OnDemand/</span>
                  <FolderOpen className="h-3.5 w-3.5 text-slate-500" />
                </div>
              </div>

              {/* Download Link */}
              <div className="flex items-center gap-2">
                <button onClick={() => setDownloadLink(!downloadLink)}
                  className={`h-4 w-4 rounded border flex items-center justify-center ${downloadLink ? "bg-cyan-500 border-cyan-500" : "border-slate-500"}`}>
                  {downloadLink && <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <Link2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-300">Download Link</span>
              </div>

              {/* Slack Notification */}
              <div className="flex items-center gap-2">
                <button onClick={() => setSlackNotif(!slackNotif)}
                  className={`h-4 w-4 rounded border flex items-center justify-center ${slackNotif ? "bg-cyan-500 border-cyan-500" : "border-slate-500"}`}>
                  {slackNotif && <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs text-slate-300">Slack Notification</span>
              </div>
            </div>

            <button className="mt-4 w-full rounded-xl bg-indigo-500/20 border border-indigo-400/30 py-3 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/30 transition flex items-center justify-center gap-2">
              <FileText className="h-4 w-4" /> Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Main: Reporting Hub
// ──────────────────────────────────────────────────────
const hubCards = [
  {
    id: "executives" as SubView,
    icon: Users,
    title: "Executives Reporting",
    desc: "High-level posture summaries for leadership",
    accent: "border-indigo-400/30 bg-indigo-500/10 hover:bg-indigo-500/15",
    iconBg: "bg-indigo-500/20 text-indigo-300",
    glow: "hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]",
  },
  {
    id: "scheduled" as SubView,
    icon: Calendar,
    title: "Scheduled Reporting",
    desc: "Automated reports delivered on a recurring schedule",
    accent: "border-cyan-400/30 bg-cyan-500/10 hover:bg-cyan-500/15",
    iconBg: "bg-cyan-500/20 text-cyan-300",
    glow: "hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]",
  },
  {
    id: "ondemand" as SubView,
    icon: Search,
    title: "On-Demand Reporting",
    desc: "Generate ad-hoc reports whenever you need them",
    accent: "border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/15",
    iconBg: "bg-emerald-500/20 text-emerald-300",
    glow: "hover:shadow-[0_0_30px_rgba(52,211,153,0.15)]",
  },
];

export default function Reporting() {
  const [subView, setSubView] = useState<SubView>("hub");

  if (subView === "executives") return <ExecutivesView onBack={() => setSubView("hub")} />;
  if (subView === "scheduled")  return <ScheduledView  onBack={() => setSubView("hub")} />;
  if (subView === "ondemand")   return <OnDemandView   onBack={() => setSubView("hub")} />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Reporting Centre</h2>
        <p className="text-xs text-slate-400 mb-8">Select a reporting mode below to configure and generate security reports.</p>

        <div className="flex flex-col md:flex-row gap-5 justify-center items-stretch">
          {hubCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => setSubView(card.id)}
                className={`flex-1 max-w-xs flex flex-col items-center gap-5 rounded-[2rem] border p-8 text-center transition-all duration-200 ${card.accent} ${card.glow}`}
              >
                <div className={`rounded-2xl p-5 ${card.iconBg}`}>
                  <Icon className="h-10 w-10" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-100 mb-1">{card.title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
