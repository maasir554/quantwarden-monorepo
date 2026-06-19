"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import {
  Shield,
  ShieldCheck,
  Users,
  ArrowLeft,
  FileText,
  ScrollText,
  Network,
} from "lucide-react";
import TeamManagement from "./TeamManagement";
import AssetManagement from "./AssetManagement";
import AssetScanning from "./AssetScanning";
import OrgOverview from "./OrgOverview";
import RoleManagement from "./RoleManagement";
import OrgReporting from "./OrgReporting";
import { Activity } from "lucide-react";
import type { DashboardSection } from "./dashboard-sections";
import ScanActivityMonitor from "./ScanActivityMonitor";
import OrgCbom from "./OrgCbom";
import PqcPosture from "./PqcPosture";
import AssetGraphViewer from "./AssetGraphViewer";

interface OrgDashboardProps {
  org: any;
  currentUserRole: string;
  currentUserId: string;
  activeSection: DashboardSection;
  canManageTeam: boolean;
  canManageRoles: boolean;
  canManageAssets: boolean;
  canScan: boolean;
}

const navItems = [
  { id: "overview", label: "Security Overview", icon: Activity },
  { id: "discoveries", label: "Discoveries", icon: Network },
  { id: "cbom", label: "CERT-IN CBOM", icon: ScrollText },
  { id: "pqc", label: "PQC Posture", icon: ShieldCheck },
  { id: "reporting", label: "Reporting", icon: FileText },
  { id: "asset", label: "Asset Management", icon: Shield },
  { id: "scan", label: "Asset Scanning", icon: Shield },
  { id: "team", label: "Team Management", icon: Users },
];

export default function OrgDashboard({ org, currentUserRole, currentUserId, activeSection, canManageTeam, canManageRoles, canManageAssets, canScan }: OrgDashboardProps) {
  const { data: sessionData } = useSession();
  const user = sessionData?.user;

  // Treat 'Administrator' and 'admin' as equivalent
  const isAdmin = ["owner", "admin", "administrator"].includes(currentUserRole?.toLowerCase?.() ?? "");

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="fixed inset-0 top-16 overflow-hidden z-10">
      {/* Warm gold gradient background — matches /dashboard */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]"
      />

      {/* Sidebar */}
      <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#8B0000] z-20 hidden lg:flex flex-col">
        <div className="border-b border-white/10 px-5 py-4">
          <Link
            href="/app"
            className="flex items-center gap-2 text-red-200 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Organizations
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <Link
                key={item.id}
                href={`/app/${org.slug}/${item.id}`}
                className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-white/20 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]"
                    : "text-red-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-white" : "text-red-300 group-hover:text-white"}`} />
                <span className="font-bold">{item.label}</span>
              </Link>
            );
          })}

          <div className="px-2 pt-4">
            <ScanActivityMonitor orgId={org.id} orgSlug={org.slug} canScan={canScan} />
          </div>
        </nav>

        {/* Sidebar Footer — User */}
        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.name ?? "User"}</p>
              <p className="text-xs text-red-200 truncate capitalize">{currentUserRole}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Navigation */}
      <div className="lg:hidden bg-white/60 backdrop-blur-lg border-b border-amber-500/15 px-4 py-3 sticky top-0 z-10 flex items-center gap-3 overflow-x-auto">
        <Link
          href="/app"
          className="shrink-0 p-2 rounded-lg text-[#8a5d33] hover:bg-amber-500/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="h-6 w-px bg-amber-500/20 shrink-0" />
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <Link
              key={item.id}
              href={`/app/${org.slug}/${item.id}`}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                active
                  ? "bg-[#8B0000] text-white shadow-md"
                  : "text-[#8a5d33] hover:bg-amber-500/10"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
        <div className="shrink-0 min-w-[240px]">
          <ScanActivityMonitor orgId={org.id} orgSlug={org.slug} canScan={canScan} compact />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 lg:ml-72 h-full overflow-y-auto flex flex-col">
        <div className="w-full min-h-full px-4 sm:px-5 lg:px-6 py-4 sm:py-5 flex flex-col">
          {activeSection === "overview" && (
            <OrgOverview
              org={org}
              isAdmin={isAdmin}
            />
          )}
          {activeSection === "discoveries" && (
            <AssetGraphViewer
              org={org}
            />
          )}
          {activeSection === "cbom" && (
            <OrgCbom
              org={org}
            />
          )}
          {activeSection === "pqc" && (
            <PqcPosture
              org={org}
            />
          )}
          {activeSection === "reporting" && (
            <OrgReporting
              org={org}
              canConfigure={isAdmin}
            />
          )}
          {activeSection === "team" && (
            <TeamManagement
              org={org}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId}
              canManageTeam={canManageTeam}
              canManageRoles={canManageRoles}
            />
          )}
          {activeSection === "asset" && (
            <AssetManagement
              org={org}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId}
              canManageAssets={canManageAssets}
              canScan={canScan}
            />
          )}
          {activeSection === "scan" && (
            <AssetScanning
              org={org}
              isAdmin={isAdmin}
              canScan={canScan}
            />
          )}
          {activeSection === "roles" && (
            <RoleManagement
              org={org}
              currentUserRole={currentUserRole}
              canManageRoles={canManageRoles}
            />
          )}
        </div>
      </main>
    </div>
  );
}
