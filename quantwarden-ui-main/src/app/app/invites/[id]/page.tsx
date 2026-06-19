"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Check, X, Loader2, ArrowRight } from "lucide-react";
import { useSession } from "@/lib/auth-client";

interface InvitationData {
  id: string;
  organizationId: string;
  email: string;
  status: string;
  expiresAt: string;
  roleName: string | null;
  organization: { name: string; slug: string };
  user: { name: string | null; email: string };
}

export default function InviteRedemptionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const inviteId = resolvedParams.id;
  const router = useRouter();
  const { data: sessionData, isPending: sessionLoading } = useSession();

  const [invite, setInvite] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [isMismatchError, setIsMismatchError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;

    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/orgs/invite/${inviteId}`);
        if (!res.ok) {
          const e = await res.json();
          const message = e.error || "Failed to load invitation.";
          setError(message);
          setIsMismatchError(
            res.status === 403 &&
              /someone else|mismatch|different email/i.test(message)
          );
        } else {
          setInvite(await res.json());
        }
      } catch (e) {
        setError("Could not reach server.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [inviteId, sessionLoading]);

  const handleResponse = async (action: "accept" | "decline") => {
    setIsProcessing(true);
    setError("");
    try {
      const res = await fetch(`/api/orgs/invite/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to process invitation.");
        setIsProcessing(false);
        return;
      }

      if (action === "accept" && invite?.organization?.slug) {
        router.push(`/app/${invite.organization.slug}`);
      } else {
        router.push("/app");
      }
    } catch (e) {
      setError("An unexpected error occurred.");
      setIsProcessing(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#8B0000]" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-md mx-auto text-center px-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${isMismatchError ? "bg-amber-100" : "bg-red-100"}`}>
          {isMismatchError ? <Shield className="w-8 h-8 text-amber-600" /> : <X className="w-8 h-8 text-red-600" />}
        </div>
        <h1 className="text-2xl font-black text-[#3d200a] mb-2 tracking-tight">
          {isMismatchError ? "This invitation is for someone else" : "Invitation Expired"}
        </h1>
        <p className="text-[#8a5d33] mb-8 font-medium">
          {isMismatchError
            ? "Please sign in with the email address that received this invitation."
            : "This invitation has expired or been revoked by the organization."}
        </p>
        <button
          onClick={() => router.push(isMismatchError ? "/login" : "/app")}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 ${
            isMismatchError
              ? "bg-[#8B0000] text-white hover:bg-[#730000]"
              : "bg-white border border-amber-500/30 text-[#3d200a] hover:bg-[#fdf1df]"
          }`}
        >
          {isMismatchError ? "Switch Account" : "Return to Dashboard"} <ArrowRight className="w-4 h-4" />
        </button>
        {isMismatchError && (
          <img
            src="/undraw-invite-only.svg"
            alt="Invitation is for a different account"
            className="w-52 h-auto mt-8"
          />
        )}
      </div>
    );
  }

  // Pre-checks
  if (invite.status !== "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-md mx-auto text-center px-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
          <InfoIcon className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-black text-[#3d200a] mb-2 tracking-tight">Invitation Already Processed</h1>
        <p className="text-[#8a5d33] mb-8 font-medium">This invitation has already been {invite.status}.</p>
        <button
          onClick={() => router.push("/app")}
          className="px-6 py-2.5 bg-white border border-amber-500/30 text-[#3d200a] rounded-xl font-bold hover:bg-[#fdf1df] transition-all shadow-sm flex items-center gap-2"
        >
          Return to Dashboard <ArrowRight className="w-4 h-4" />
        </button>
        <img
          src="/undraw-starry-window.svg"
          alt="Invitation status illustration"
          className="w-40 h-auto mt-8"
        />
      </div>
    );
  }

  // Double check email matching inside UI just to reassure the user
  if (sessionData?.user?.email !== invite.email) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-md mx-auto text-center px-4">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
          <Shield className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-black text-[#3d200a] mb-2 tracking-tight">Account Mismatch</h1>
        <p className="text-[#8a5d33] mb-8 font-medium">
          This invitation was sent to <strong className="text-[#3d200a]">{invite.email}</strong>, but you are logged in as <strong className="text-[#3d200a]">{sessionData?.user?.email}</strong>.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="px-6 py-2.5 bg-[#8B0000] text-white rounded-xl font-bold shadow-md shadow-[#8B0000]/20 hover:bg-[#730000] transition-all flex items-center gap-2"
        >
          Switch Account <ArrowRight className="w-4 h-4" />
        </button>
        <img
          src="/undraw-invite-only.svg"
          alt="Invitation is for a different account"
          className="w-52 h-auto mt-8"
        />
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen w-screen overflow-hidden left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
      <div
        aria-hidden
        className="fixed inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,#fff8e8_0%,#fef3c7_35%,#fbbf24_75%,#f59e0b_100%)]"
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12 md:py-16">
        <div className="w-full max-w-2xl bg-white/72 backdrop-blur-xl border border-white/70 rounded-2xl shadow-2xl shadow-amber-900/10 p-8 md:p-12 text-center animate-in zoom-in-95 duration-500">
          <h1 className="text-3xl font-black text-[#3d200a] mb-3 tracking-tight">You&apos;re Invited!</h1>
          <p className="text-base text-[#7a5633] mb-8 leading-relaxed">
            <strong className="text-[#3d200a]">{invite.user.name || "A team member"}</strong>
            <span className="text-[#8a6a48]"> ({invite.user.email})</span>
            <span> invited you to collaborate on QuantWarden in </span>
            <strong className="text-[#3d200a] bg-white/75 px-2 py-0.5 rounded-md inline-flex border border-amber-500/20">{invite.organization.name}</strong>
            <span>.</span>
          </p>

          {invite.roleName && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 border border-amber-500/25 rounded-lg text-sm text-[#7a5633] font-bold mb-10">
              <span className="uppercase tracking-widest text-[10px] opacity-70">Assigned Role:</span>
              {invite.roleName}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-2">
            <button
              onClick={() => handleResponse("decline")}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-white/90 border border-amber-500/30 text-[#6f4827] rounded-xl font-bold hover:bg-white transition-all disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Decline"}
            </button>
            <button
              onClick={() => handleResponse("accept")}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold shadow-md shadow-emerald-900/20 hover:bg-emerald-700 transition-all disabled:opacity-50 hover:-translate-y-0.5"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Accept Invite</>}
            </button>
          </div>
        </div>

        <img
          src="/undraw-collab-pic.svg"
          alt="Collaboration illustration"
          className="w-72 md:w-md h-auto mt-8"
        />
      </div>
    </div>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
