"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Algorithms", href: "/cbom/explorer/algorithms" },
  { label: "Keys", href: "/cbom/explorer/keys" },
  { label: "Protocols", href: "/cbom/explorer/protocols" },
  { label: "Certificates", href: "/cbom/explorer/certificates" },
];

export default function ExplorerTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="CBOM Explorer Tabs">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`cbom-explorer-tab rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "cbom-explorer-tab-active border-cyan-400/45 bg-cyan-500/20 text-cyan-100"
                : "cbom-explorer-tab-inactive border-white/10 bg-slate-900/40 text-slate-300 hover:bg-white/8"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
