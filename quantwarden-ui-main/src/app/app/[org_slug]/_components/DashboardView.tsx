"use client";

import { Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DashboardView({ org }: { org: any }) {
  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <Link href="/app" className="flex items-center justify-center p-2 rounded-xl text-[#8a5d33] hover:bg-[#8B0000]/5 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-black text-[#3d200a] tracking-tight">{org.name} Dashboard</h1>
      </div>
      
      <div className="bg-white border border-amber-500/20 rounded-2xl p-12 text-center shadow-sm">
        <div className="w-20 h-20 bg-[#8B0000]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-10 h-10 text-[#8B0000]" />
        </div>
        <h3 className="text-2xl font-black text-[#3d200a] mb-2">Welcome to {org.name}</h3>
        <p className="text-[#8a5d33] max-w-md mx-auto">
          The organization setup is complete. You can now start adding assets, members, and generating CBOMs.
        </p>
      </div>
    </div>
  );
}
