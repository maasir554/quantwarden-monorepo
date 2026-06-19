import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import DashboardShell from "../../components/DashboardShell";
import ExplorerTabs from "./ExplorerTabs";

export default function CbomExplorerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DashboardShell title="Cryptographic Bill of Materials">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 min-h-140">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href="/cbom"
            aria-label="Back"
            className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>

          <ExplorerTabs />
        </div>

        <div className="min-h-110 rounded-xl border border-dashed border-white/10 p-3">
          {children}
        </div>
      </section>
    </DashboardShell>
  );
}
