"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChartNoAxesCombined,
  Cpu,
  Layers,
  Moon,
  Radar,
  Search,
  Shield,
  Star,
  Sun,
  User,
} from "lucide-react";

type DashboardShellProps = {
  title: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
};

type NavItem = {
  label: string;
  icon: React.FC<{ className?: string }>;
  href: string;
};

const navItems: NavItem[] = [
  { label: "Overview", icon: Radar, href: "/dashboard" },
  { label: "Asset Inventory", icon: Layers, href: "/asset-inventory" },
  { label: "Discoveries", icon: Search, href: "/discoveries" },
  { label: "CBOM", icon: Cpu, href: "/cbom" },
  { label: "Crypto Posture", icon: Shield, href: "/crypto-posture" },
  { label: "Cyber Rating", icon: Star, href: "/cyber-rating" },
  { label: "Reporting", icon: ChartNoAxesCombined, href: "/reporting" },
];

const THEME_STORAGE_KEY = "quantwarden-theme";

export default function DashboardShell({ title, children, headerAction }: DashboardShellProps) {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
  });

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? "dark" : "light");
  }, [darkMode]);

  const t = useMemo(
    () =>
      darkMode
        ? {
            pageBg:
              "bg-[radial-gradient(circle_at_15%_0%,_rgba(14,165,233,0.15),_transparent_40%),radial-gradient(circle_at_85%_10%,_rgba(99,102,241,0.16),_transparent_40%),linear-gradient(180deg,#050b14_0%,#07111f_100%)]",
            sidebarBg: "bg-slate-950/65 border-white/10 backdrop-blur-lg",
            sidebarBorder: "border-white/10",
            logoBg: "bg-white text-slate-950",
            logoLabel: "text-slate-400",
            logoTitle: "text-slate-100",
            navActive:
              "bg-cyan-500/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]",
            navInactive: "text-slate-300 hover:bg-white/5 hover:text-slate-100",
            navIconActive: "text-cyan-300",
            navIconInact: "text-slate-400 group-hover:text-slate-300",
            badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/20",
            operatorCard: "border-white/10 bg-slate-900/70",
            operatorLabel: "text-slate-400",
            operatorName: "text-slate-100",
            operatorRole: "text-slate-400",
            operatorIcon: "bg-cyan-400/20 text-cyan-200",
            toggleBg: "bg-slate-700 hover:bg-slate-600",
            toggleText: "text-cyan-300",
            headerCard: "border-white/10 bg-slate-950/50 backdrop-blur-sm",
            headerSub: "text-slate-400",
            headerTitle: "text-slate-100",
            scanBadge: "border-white/10 bg-slate-900/90 text-slate-300",
            scanIcon: "text-cyan-300",
            cbomAction:
              "border border-cyan-400/40 bg-cyan-500/20 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.25)] hover:bg-cyan-500/30",
          }
        : {
            pageBg: "bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]",
            sidebarBg: "bg-[#8B0000] border-[#a80000]",
            sidebarBorder: "border-[#a80000]",
            logoBg: "bg-white/20 text-white",
            logoLabel: "text-red-200",
            logoTitle: "text-white",
            navActive: "bg-white/20 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]",
            navInactive: "text-red-100 hover:bg-white/10 hover:text-white",
            navIconActive: "text-white",
            navIconInact: "text-red-300 group-hover:text-white",
            badge: "bg-white/20 text-white border-white/30",
            operatorCard: "border-white/20 bg-white/10",
            operatorLabel: "text-red-200",
            operatorName: "text-white",
            operatorRole: "text-red-200",
            operatorIcon: "bg-white/20 text-white",
            toggleBg: "bg-white/20 hover:bg-white/30",
            toggleText: "text-white",
            headerCard: "border-amber-300/40 bg-white/30 backdrop-blur-sm",
            headerSub: "text-amber-800",
            headerTitle: "text-amber-900",
            scanBadge: "border-amber-400/40 bg-white/40 text-amber-900",
            scanIcon: "text-amber-700",
            cbomAction: "border border-[#8B0000]/40 bg-[#8B0000] text-white hover:bg-[#730000]",
          },
    [darkMode]
  );

  return (
    <div className={`${darkMode ? "theme-dark" : "theme-light"} relative min-h-screen text-slate-100`}>
      <div aria-hidden className={`fixed inset-0 z-0 ${t.pageBg}`} />
      <div className="relative z-10 w-full min-h-screen lg:pl-68">
        <aside
          className={`border-b ${t.sidebarBorder} ${t.sidebarBg} flex flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:h-screen lg:w-68 lg:border-r lg:border-b-0`}
        >
          <div className={`flex h-20 items-center border-b ${t.sidebarBorder} px-6`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-lg ${t.logoBg} p-2`}>
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.25em] ${t.logoLabel}`}>QuantWarden</p>
                <p className={`text-sm font-semibold ${t.logoTitle}`}>Quantum-Proof Scanner</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1 px-4 py-6 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    active ? t.navActive : t.navInactive
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? t.navIconActive : t.navIconInact}`} />
                  {item.label}
                  {item.href === "/cyber-rating" && (
                    <span className={`ml-auto rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${t.badge}`}>
                      755
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="px-4 mb-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${t.toggleBg}`}
            >
              {darkMode ? (
                <>
                  <Sun className={`h-4 w-4 ${t.toggleText}`} />
                  <span className={t.toggleText}>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className={`h-4 w-4 ${t.toggleText}`} />
                  <span className={t.toggleText}>Dark Mode</span>
                </>
              )}
            </button>
          </div>

          <div className={`mx-4 mb-5 rounded-xl border ${t.operatorCard} p-4`}>
            <p className={`text-xs ${t.operatorLabel}`}>Operator</p>
            <div className="mt-2 flex items-center gap-2">
              <div className={`rounded-full ${t.operatorIcon} p-2`}>
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className={`text-sm font-medium ${t.operatorName}`}>hackathon_user</p>
                <p className={`text-xs ${t.operatorRole}`}>SOC Tier 2</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col p-4 md:p-7">
          <header
            className={`mb-6 flex flex-col gap-4 rounded-2xl border ${t.headerCard} p-5 md:flex-row md:items-center md:justify-between shrink-0`}
          >
            <div>
              <p className={`text-xs uppercase tracking-[0.2em] ${t.headerSub}`}>QuantWarden</p>
              <h1 className={`mt-1 text-2xl font-semibold ${t.headerTitle}`}>{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              {headerAction}
              <div className={`flex items-center gap-2 rounded-xl border ${t.scanBadge} px-3 py-2 text-xs`}>
                <Activity className={`h-4 w-4 ${t.scanIcon}`} />
                Last scan completed 10 min ago
              </div>
            </div>
          </header>

          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
