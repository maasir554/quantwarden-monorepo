"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Shield, ShieldCheck, LogOut, ChevronDown, Loader2, PencilLine } from "lucide-react";
import NavigationProgress from "@/components/ui/navigation-progress";
import { ScanActivityProvider } from "@/components/scan-activity-provider";
import { Toaster } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type ExplorerOrgNavItem = {
  id: string;
  name: string;
  slug: string;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: sessionData, isPending } = useSession();
  const [workspaceOrg, setWorkspaceOrg] = useState<ExplorerOrgNavItem | null>(null);
  const [superAdmin, setSuperAdmin] = useState(false);

  const workspaceOrgSlug = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/app\/([^/]+)(?:\/.*)?$/);
    return match?.[1] ?? null;
  }, [pathname]);

  const user = sessionData?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? "?";

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        }
      }
    });
  };

  useEffect(() => {
    if (isPending || sessionData?.session) {
      return;
    }

    if (pathname && pathname.includes("/app/invites/")) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    router.replace("/login");
  }, [isPending, pathname, router, sessionData?.session]);

  useEffect(() => {
    if (!workspaceOrgSlug || !sessionData?.session) {
      setWorkspaceOrg(null);
      return;
    }

    let cancelled = false;

    const loadWorkspaceOrg = async () => {
      try {
        const res = await fetch("/api/orgs/list");
        if (!res.ok) return;

        const json = await res.json();
        const organizations = Array.isArray(json.organizations) ? json.organizations : [];
        const matchingOrg = organizations.find((org: ExplorerOrgNavItem) => org.slug === workspaceOrgSlug) || null;

        if (!cancelled) {
          setWorkspaceOrg(matchingOrg);
        }
      } catch {
        if (!cancelled) {
          setWorkspaceOrg(null);
        }
      }
    };

    loadWorkspaceOrg();

    return () => {
      cancelled = true;
    };
  }, [workspaceOrgSlug, sessionData?.session]);

  useEffect(() => {
    if (!sessionData?.session) {
      setSuperAdmin(false);
      return;
    }

    fetch("/api/admin/status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { superAdmin: false })
      .then((data) => setSuperAdmin(Boolean(data.superAdmin)))
      .catch(() => setSuperAdmin(false));
  }, [sessionData?.session]);

  if (isPending || !sessionData?.session) {
    return (
      <ScanActivityProvider>
        <div className="min-h-screen flex items-center justify-center bg-[#fffcf5] text-slate-900">
          <Loader2 className="w-10 h-10 animate-spin text-[#8B0000]" />
        </div>
      </ScanActivityProvider>
    );
  }

  return (
    <ScanActivityProvider>
      <div className="min-h-screen bg-[#fffcf5] font-sans text-slate-900 selection:bg-[#8B0000] selection:text-white overscroll-none">
        <Toaster
          position="top-right"
          expand
          toastOptions={{
            style: {
              background: "rgba(255, 248, 235, 0.98)",
              color: "#3d200a",
              border: "1px solid rgba(217, 119, 6, 0.18)",
              boxShadow: "0 18px 45px rgba(61, 32, 10, 0.12)",
            },
            actionButtonStyle: {
              background: "#8B0000",
              color: "#ffffff",
            },
            cancelButtonStyle: {
              background: "rgba(139, 0, 0, 0.08)",
              color: "#8B0000",
            },
          }}
        />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {/* Top Navigation Bar */}
        <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-white/80 backdrop-blur-lg border-b border-amber-500/15 shadow-sm">
          <div className="max-w-360 mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center gap-2.5">
              {workspaceOrg && (
                <>
                  <Link
                    href={`/app/${workspaceOrg.slug}`}
                    className="hidden lg:flex items-center gap-2 rounded-full border border-[#8B0000]/35 bg-[#8B0000] px-3.5 py-1.5 shadow-sm shadow-[#8B0000]/20 transition hover:bg-[#730000]"
                  >
                    <div className="min-w-0">
                      <p className="max-w-[200px] truncate text-sm font-bold leading-tight text-white">
                        {workspaceOrg.name}
                      </p>
                      <p className="max-w-[200px] truncate text-[11px] font-semibold leading-tight text-white/80">
                        {workspaceOrg.slug}
                      </p>
                    </div>
                  </Link>
                  <span className="hidden lg:inline text-lg font-black text-[#8B0000]/85">@</span>
                </>
              )}
              <Link href="/app" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 bg-[#8B0000] rounded-lg flex items-center justify-center shadow-md shadow-[#8B0000]/20 group-hover:shadow-lg group-hover:shadow-[#8B0000]/30 transition-all">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-extrabold text-[#3d200a] tracking-tight hidden sm:inline">
                  Quant<span className="text-[#8B0000]">Warden</span>
                </span>
              </Link>
            </div>

            {/* Right: User Profile Dropdown */}
            <div className="flex items-center gap-3">
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#8B0000]" />
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 outline-none focus:ring-2 focus:ring-[#8B0000]/20">
                      <div className="w-9 h-9 rounded-full bg-[#8B0000] flex items-center justify-center text-white text-sm font-bold shadow-md shadow-[#8B0000]/20">
                        {initials}
                      </div>
                      <div className="hidden md:flex flex-col items-start">
                        <span className="text-sm font-bold text-[#3d200a] leading-tight">{user?.name ?? "User"}</span>
                        <span className="text-xs text-[#8a5d33] leading-tight">{user?.email}</span>
                      </div>
                      <ChevronDown className="hidden h-4 w-4 text-slate-500 md:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl border-slate-200 p-1.5 shadow-xl shadow-slate-900/10">
                    <div className="px-2.5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8B0000] text-sm font-semibold text-white">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{user?.name ?? "User"}</p>
                          <p className="truncate text-xs text-slate-500">{user?.email}</p>
                        </div>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="gap-3 text-slate-700 focus:bg-slate-100 focus:text-slate-950">
                      <Link href="/app/user-profile">
                        <PencilLine className="h-4 w-4 text-slate-500" />
                        <span>Manage profile</span>
                      </Link>
                    </DropdownMenuItem>
                    {superAdmin ? (
                      <DropdownMenuItem asChild className="gap-3 text-slate-700 focus:bg-slate-100 focus:text-slate-950">
                        <Link href="/app/admin">
                          <ShieldCheck className="h-4 w-4 text-slate-500" />
                          <span>Admin console</span>
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="gap-3 text-red-700 focus:bg-red-50 focus:text-red-800"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="font-semibold">Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-360 mx-auto px-6 sm:px-8 py-8 pt-24">
          {children}
        </main>
      </div>
    </ScanActivityProvider>
  );
}
