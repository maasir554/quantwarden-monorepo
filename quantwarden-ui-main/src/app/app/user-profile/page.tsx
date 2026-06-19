"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Clock3,
  Loader2,
  Mail,
  Trash2,
  User,
  X,
} from "lucide-react";

type InvitationRow = {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  roleName: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  inviter: {
    name: string;
    email: string;
  };
};

type InvitationsPayload = {
  active: InvitationRow[];
  history: InvitationRow[];
};

const STATUS_LABELS: Record<string, string> = {
  accepted: "Accepted",
  declined: "Rejected",
  expired: "Expired",
  revoked: "Revoked",
  cancelled: "Cancelled",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getHistoryBadgeClass(status: string) {
  if (status === "accepted") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "declined") return "bg-[#8B0000]/10 text-[#8B0000] border-[#8B0000]/20";
  if (status === "expired") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function UserProfilePage() {
  const router = useRouter();
  const { data: sessionData, isPending: sessionLoading } = useSession();

  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState("");
  const [invites, setInvites] = useState<InvitationsPayload>({ active: [], history: [] });
  const [actioningInviteId, setActioningInviteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !sessionData?.session) {
      router.replace("/login");
    }
  }, [sessionLoading, sessionData, router]);

  useEffect(() => {
    setName(sessionData?.user?.name || "");
  }, [sessionData?.user?.name]);

  const loadInvitations = async () => {
    try {
      setInvitesError("");
      setInvitesLoading(true);

      const res = await fetch("/api/user/invitations", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load invitations.");
      }

      setInvites(data);
    } catch (error: any) {
      setInvitesError(error?.message || "Failed to load invitations.");
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading && sessionData?.session) {
      loadInvitations();
    }
  }, [sessionLoading, sessionData?.session]);

  const hasNameChanges = useMemo(
    () => name.trim() !== (sessionData?.user?.name || "").trim(),
    [name, sessionData?.user?.name]
  );

  const handleSaveProfile = async () => {
    setSaveMessage("");
    setSaveError("");
    setIsSaving(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not update profile.");
      }

      setSaveMessage("Profile updated successfully.");
      router.refresh();
    } catch (error: any) {
      setSaveError(error?.message || "Could not update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteAction = async (
    invite: InvitationRow,
    action: "accept" | "decline"
  ) => {
    setInvitesError("");
    setActioningInviteId(invite.id);

    try {
      const res = await fetch(`/api/orgs/invite/${invite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process invitation.");
      }

      await loadInvitations();
      if (action === "accept" && invite.organization.slug) {
        router.push(`/app/${invite.organization.slug}`);
      }
    } catch (error: any) {
      setInvitesError(error?.message || "Failed to process invitation.");
    } finally {
      setActioningInviteId(null);
    }
  };

  const openDeleteModal = () => {
    setDeleteEmailInput("");
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const handleDeleteProfile = async () => {
    setDeleteError("");
    setIsDeleting(true);

    try {
      const res = await fetch("/api/user/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: deleteEmailInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not delete profile.");
      }

      window.location.href = "/login";
    } catch (error: any) {
      setDeleteError(error?.message || "Could not delete profile.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#8B0000]" />
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen">
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]"
      />

      <div className="relative z-10 space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#8B0000] px-6 py-7 md:px-8 md:py-9 shadow-xl shadow-[#8B0000]/15">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: 0.16,
              backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-white tracking-tight">Profile Manager</h1>
            <p className="text-white/75 mt-1 text-base">Update your account details and manage your invitations.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-1 rounded-2xl border border-white/55 bg-white/75 backdrop-blur-md p-5 shadow-lg shadow-[#8B0000]/8">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-[#8B0000]" />
              <h2 className="text-lg font-bold text-[#3d200a]">Profile Details</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/20 bg-white/80 px-3 py-2.5">
                <p className="text-xs uppercase tracking-widest text-[#8a5d33] mb-1">Email</p>
                <p className="font-semibold text-[#3d200a] break-all">{sessionData?.user?.email}</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-[#8a5d33] mb-1 block">Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="w-full rounded-xl border border-[#8B0000]/30 bg-white px-3 py-2.5 text-[#3d200a] font-medium outline-none focus:ring-2 focus:ring-[#8B0000]/30"
                  placeholder="Enter your full name"
                />
              </div>

              {saveError ? <p className="text-sm text-[#8B0000]">{saveError}</p> : null}
              {saveMessage ? <p className="text-sm text-emerald-700">{saveMessage}</p> : null}

              <button
                onClick={handleSaveProfile}
                disabled={isSaving || !hasNameChanges}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B0000] px-4 py-2.5 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#730000] transition-colors shadow-md shadow-[#8B0000]/20"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                Save Profile
              </button>
            </div>
          </section>

          <section className="xl:col-span-2 rounded-2xl border border-white/55 bg-white/75 backdrop-blur-md p-5 shadow-lg shadow-[#8B0000]/8">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-4 h-4 text-[#8B0000]" />
              <h2 className="text-lg font-bold text-[#3d200a]">Active Invitations</h2>
            </div>

            {invitesError ? (
              <p className="text-sm text-[#8B0000] mb-3">{invitesError}</p>
            ) : null}

            {invitesLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#8B0000]" />
              </div>
            ) : invites.active.length === 0 ? (
              <div className="py-8 text-center text-[#8a5d33] bg-white/45 rounded-xl border border-amber-500/15">
                No active invitations right now.
              </div>
            ) : (
              <div className="space-y-3">
                {invites.active.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-xl border border-amber-500/25 bg-[#fff9ef] p-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="font-bold text-[#3d200a]">{invite.organization.name}</p>
                        <p className="text-sm text-[#8a5d33]">
                          Invited by {invite.inviter.name} ({invite.inviter.email || "No email"})
                        </p>
                        <p className="text-xs text-[#8a5d33] mt-1">
                          Role: <span className="font-semibold text-[#6f4827]">{invite.roleName}</span> • Expires {formatDate(invite.expiresAt)}
                        </p>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleInviteAction(invite, "decline")}
                          disabled={actioningInviteId === invite.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#8B0000]/30 bg-white px-3 py-2 text-sm font-semibold text-[#8B0000] hover:bg-[#8B0000]/5 disabled:opacity-50"
                        >
                          {actioningInviteId === invite.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          Decline
                        </button>
                        <button
                          onClick={() => handleInviteAction(invite, "accept")}
                          disabled={actioningInviteId === invite.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {actioningInviteId === invite.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-white/55 bg-white/75 backdrop-blur-md p-5 shadow-lg shadow-[#8B0000]/8">
          <div className="flex items-center gap-2 mb-4">
            <Clock3 className="w-4 h-4 text-[#8B0000]" />
            <h2 className="text-lg font-bold text-[#3d200a]">Invitation History</h2>
          </div>

          {invitesLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#8B0000]" />
            </div>
          ) : invites.history.length === 0 ? (
            <div className="py-8 text-center text-[#8a5d33] bg-white/45 rounded-xl border border-amber-500/15">No invitation history yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-amber-500/20 bg-white/70">
              <table className="w-full min-w-175">
                <thead>
                  <tr className="text-left border-b border-amber-500/20 bg-[#8B0000]/5">
                    <th className="py-2.5 px-3 text-xs uppercase tracking-widest text-[#8B0000]">Organization</th>
                    <th className="py-2.5 px-3 text-xs uppercase tracking-widest text-[#8B0000]">Invited By</th>
                    <th className="py-2.5 px-3 text-xs uppercase tracking-widest text-[#8B0000]">Role</th>
                    <th className="py-2.5 px-3 text-xs uppercase tracking-widest text-[#8B0000]">Status</th>
                    <th className="py-2.5 px-3 text-xs uppercase tracking-widest text-[#8B0000]">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.history.map((item) => (
                    <tr key={item.id} className="border-b border-amber-500/10 last:border-b-0">
                      <td className="py-3 px-3 font-semibold text-[#3d200a]">{item.organization.name}</td>
                      <td className="py-3 px-3 text-[#6f4827]">{item.inviter.name}</td>
                      <td className="py-3 px-3 text-[#6f4827]">{item.roleName}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getHistoryBadgeClass(item.status)}`}>
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#6f4827]">{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#8B0000]/30 bg-[#8B0000]/6 backdrop-blur-md p-5 shadow-lg shadow-[#8B0000]/10">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#8B0000]" />
            <h2 className="text-lg font-bold text-[#8B0000]">Danger Zone</h2>
          </div>
          <p className="text-sm text-[#6f4827] mb-4">
            Deleting your profile is permanent. You will lose access to your account data and invitations.
          </p>
          <button
            onClick={openDeleteModal}
            className="inline-flex items-center gap-2 rounded-xl border border-[#8B0000]/35 bg-white px-4 py-2.5 text-[#8B0000] font-semibold hover:bg-[#8B0000]/8 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Profile
          </button>
        </section>
      </div>

      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => {
              if (!isDeleting) setShowDeleteModal(false);
            }}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-[#8B0000]/25 bg-white p-6 shadow-2xl shadow-black/25">
            <h3 className="text-xl font-black text-[#3d200a] tracking-tight">Delete Profile</h3>
            <p className="text-sm text-[#6f4827] mt-2">
              Type your exact account email to confirm permanent profile deletion.
            </p>

            <div className="mt-4 rounded-lg bg-[#fff5f5] border border-[#8B0000]/15 px-3 py-2 text-sm text-[#8B0000]">
              Account email: <span className="font-bold">{sessionData?.user?.email}</span>
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-widest text-[#8a5d33] mb-1 block">Confirm Email</label>
              <input
                value={deleteEmailInput}
                onChange={(e) => setDeleteEmailInput(e.target.value)}
                className="w-full rounded-xl border border-[#8B0000]/30 bg-white px-3 py-2.5 text-[#3d200a] font-medium outline-none focus:ring-2 focus:ring-[#8B0000]/30"
                placeholder="Type your account email"
                autoFocus
              />
            </div>

            {deleteError ? <p className="text-sm text-[#8B0000] mt-3">{deleteError}</p> : null}

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-amber-500/25 text-[#6f4827] font-semibold hover:bg-[#fdf1df] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProfile}
                disabled={
                  isDeleting ||
                  deleteEmailInput.trim().toLowerCase() !== (sessionData?.user?.email || "").trim().toLowerCase()
                }
                className="px-4 py-2.5 rounded-xl bg-[#8B0000] text-white font-semibold hover:bg-[#730000] disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
