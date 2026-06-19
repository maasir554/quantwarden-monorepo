"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Shield, LogOut, User, Mail, ChevronDown, Loader2, PencilLine } from "lucide-react";
import NavigationProgress from "@/components/ui/navigation-progress";
import { ScanActivityProvider } from "@/components/scan-activity-provider";
import { Toaster } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
                    <button className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#fdf1df] transition-all outline-none focus:ring-2 focus:ring-[#8B0000]/30">
                      <div className="w-9 h-9 rounded-full bg-[#8B0000] flex items-center justify-center text-white text-sm font-bold shadow-md shadow-[#8B0000]/20">
                        {initials}
                      </div>
                      <div className="hidden md:flex flex-col items-start">
                        <span className="text-sm font-bold text-[#3d200a] leading-tight">{user?.name ?? "User"}</span>
                        <span className="text-xs text-[#8a5d33] leading-tight">{user?.email}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-[#8a5d33] hidden md:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <div className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-[#8B0000] flex items-center justify-center text-white text-base font-bold shadow-md shadow-[#8B0000]/20 shrink-0">
                          {initials}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-[#3d200a] truncate">{user?.name ?? "User"}</p>
                          <p className="text-xs text-[#8a5d33] truncate">{user?.email}</p>
                        </div>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-3">
                      <User className="w-4 h-4 text-[#8a5d33]" />
                      <div>
                        <p className="text-xs text-[#8a5d33]">Full Name</p>
                        <p className="font-semibold text-[#3d200a]">{user?.name ?? "—"}</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-3">
                      <Mail className="w-4 h-4 text-[#8a5d33]" />
                      <div>
                        <p className="text-xs text-[#8a5d33]">Email</p>
                        <p className="font-semibold text-[#3d200a]">{user?.email ?? "—"}</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="gap-3 bg-[#8B0000] text-white focus:bg-[#730000] focus:text-white">
                      <Link href="/app/user-profile">
                        <PencilLine className="w-4 h-4 text-white" />
                        <span className="font-semibold text-white">Manage profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="gap-3 text-[#8B0000] focus:bg-[#8B0000]/5 focus:text-[#8B0000]"
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
