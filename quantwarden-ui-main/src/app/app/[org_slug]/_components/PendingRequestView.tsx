"use client";

import { useState } from "react";
import { Clock, XCircle, ArrowLeft, Loader2, Building2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PendingRequestViewProps {
  org: { id: string; name: string; slug: string; logo: string | null };
  request: { id: string; status: string; createdAt: Date };
}

export default function PendingRequestView({ org, request }: PendingRequestViewProps) {
  const router = useRouter();
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const res = await fetch("/api/orgs/join-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id }),
      });
      if (res.ok) {
        router.push("/app");
      }
    } catch {
      console.error("Failed to withdraw");
    } finally {
      setWithdrawing(false);
    }
  };

  const isPending = request.status === "pending";
  const isDenied = request.status === "denied";

  return (
    <div className="relative isolate min-h-screen">
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]"
      />

      <div className="relative z-10 max-w-lg mx-auto py-16">
        <Link
          href="/app"
          className="flex items-center gap-2 text-[#8a5d33] font-bold text-sm mb-8 hover:text-[#8B0000] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="bg-white border border-amber-500/20 rounded-2xl shadow-xl shadow-amber-500/5 overflow-hidden">
        {/* Header */}
        <div className={`px-8 py-8 text-center ${isDenied ? "bg-red-600" : "bg-[#8B0000]"}`}>
          <div className={`w-16 h-16 ${isDenied ? "bg-white/20" : "bg-white/15"} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            {isDenied ? (
              <AlertTriangle className="w-8 h-8 text-white" />
            ) : (
              <Clock className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mb-1">
            {isDenied ? "Request Denied" : "Request Pending"}
          </h1>
          <p className="text-white/70 font-medium">
            {isDenied
              ? "Your request to join this organization was declined."
              : "Your request is awaiting admin approval."}
          </p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Org info */}
          <div className="flex items-center gap-4 bg-[#fdf8f0] border border-amber-500/15 rounded-xl p-4">
            {org.logo ? (
              <img src={org.logo} alt={org.name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 bg-[#8B0000]/10 rounded-full flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-[#8B0000]" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-[#3d200a]">{org.name}</h3>
              <p className="text-sm text-[#8a5d33] font-mono">{org.slug}</p>
            </div>
          </div>

          {isPending && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-800">Awaiting Approval</span>
              </div>
              <p className="text-sm text-amber-700 leading-relaxed">
                An organization admin will review your request. You'll be notified once a decision is made. You can withdraw your request at any time.
              </p>
            </div>
          )}

          {isDenied && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-bold text-red-800">Request Declined</span>
              </div>
              <p className="text-sm text-red-700 leading-relaxed">
                The organization admin has declined your membership request. You can dismiss this and try again later, or contact the organization admin directly.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/app"
              className="flex-1 py-3 px-4 rounded-xl font-bold text-[#3d200a] border border-amber-500/30 hover:bg-[#fdf1df] transition-all text-center"
            >
              Go to Dashboard
            </Link>
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all shadow-md disabled:opacity-50 ${
                isDenied
                  ? "text-[#3d200a] bg-[#fdf1df] border border-amber-500/30 hover:bg-amber-100"
                  : "text-white bg-red-600 hover:bg-red-700"
              }`}
            >
              {withdrawing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isDenied ? (
                "Dismiss"
              ) : (
                "Withdraw Request"
              )}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
