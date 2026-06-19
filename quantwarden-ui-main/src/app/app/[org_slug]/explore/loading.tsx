import { Loader2 } from "lucide-react";

export default function ExploreLoading() {
  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)] flex flex-col items-center justify-center">
      <div className="bg-white/85 backdrop-blur-sm border border-[#8B0000]/20 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B0000]" />
        <p className="text-sm font-semibold text-[#8a5d33]/70 font-mono">Loading Asset Explorer...</p>
      </div>
    </div>
  );
}
