import Link from "next/link";

import Cbom from "../components/Cbom";
import DashboardShell from "../components/DashboardShell";

export default function CbomPage() {
  return (
    <DashboardShell
      title="Cryptographic Bill of Materials"
      headerAction={
        <Link
          href="/cbom/explorer"
            className="cbom-explorer-btn rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.25)] transition hover:bg-cyan-500/30"
        >
            CBOM Eplorer
        </Link>
      }
    >
      <Cbom />
    </DashboardShell>
  );
}
