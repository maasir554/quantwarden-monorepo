"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { getRoleStyle } from "@/lib/utils";
import {
  Users,
  Mail,
  Send,
  Plus,
  Trash2,
  Loader2,
  Check,
  Clock,
  XCircle,
  CheckCircle2,
  MoreHorizontal,
  ChevronDown,
  UserPlus,
  UserX,
  UserCheck,
  Filter,
  Inbox,
  Shield,
  Crown,
  Maximize2,
  X,
  Info,
  ArrowRight,
  KeyRound,
} from "lucide-react";

interface TeamManagementProps {
  org: any;
  currentUserRole: string;
  currentUserId: string;
  canManageTeam: boolean;
  canManageRoles: boolean;
}

const SYSTEM_INVITE_ROLES = [
  { id: "admin", name: "Administrator", permissions: { team: true, scan: true, asset: true } },
  { id: "analyst", name: "Analyst", permissions: { team: false, scan: false, asset: false } },
  { id: "auditor", name: "Auditor", permissions: { team: false, scan: false, asset: false } },
];

function buildAvailableRoles(roles: any[]) {
  const available = [...(roles || [])];
  for (const fallback of SYSTEM_INVITE_ROLES) {
    const exists = available.some(
      (role) =>
        String(role.id).toLowerCase() === fallback.id ||
        String(role.name).toLowerCase() === fallback.name.toLowerCase()
    );
    if (!exists) available.push(fallback);
  }
  return available;
}

// ═══════════════════════════════════════
// Reusable Role Dropdown
// ═══════════════════════════════════════
function RoleDropdown({
  currentRole,
  roles,
  onChange,
  small,
}: {
  currentRole: string;
  roles: any[];
  onChange: (role: string) => void;
  small?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const allRoles = roles.map((r) => ({ id: r.id, name: r.name }));
  const selectableRoleCount = allRoles.filter((role) => role.id !== "owner").length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Recalculate position when scrolling inside any ancestor
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const updatePos = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const optionCount = Math.max(1, selectableRoleCount);
      const dropdownHeight = Math.min(248, 48 + optionCount * 44);
      const dropdownWidth = Math.max(192, rect.width);
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= dropdownHeight + 8
        ? rect.bottom + 6
        : Math.max(8, rect.top - dropdownHeight - 6);
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - dropdownWidth - 8)
      );
      setDropdownPos({ top, left, width: dropdownWidth });
    };
    updatePos();
    // Listen for scroll on all ancestors to reposition
    const scrollHandler = () => updatePos();
    window.addEventListener("scroll", scrollHandler, true);
    window.addEventListener("resize", scrollHandler);
    return () => {
      window.removeEventListener("scroll", scrollHandler, true);
      window.removeEventListener("resize", scrollHandler);
    };
  }, [isOpen, selectableRoleCount]);

  const currentLabel = allRoles.find((r) => r.id === currentRole)?.name || currentRole;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`flex items-center justify-between gap-2 font-bold rounded-xl border outline-none cursor-pointer transition-colors ${
          small ? "text-[10px] px-2.5 py-2 w-[110px]" : "text-xs px-3 py-2 w-[140px]"
        }`}
        style={getRoleStyle(currentRole, roles)}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {isOpen && dropdownPos && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white border border-amber-500/20 rounded-xl shadow-xl overflow-hidden flex flex-col py-1.5 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
        >
          <div className="px-3 pb-1.5 pt-1 mb-1 text-[10px] font-bold text-[#8a5d33]/50 uppercase tracking-wider border-b border-amber-500/10">
            Select Role
          </div>
          <div className="flex flex-col max-h-[200px] overflow-y-auto">
            {allRoles
              .filter((r) => r.id !== "owner")
              .map((r) => {
                const style = getRoleStyle(r.id, roles);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { onChange(r.id); setIsOpen(false); }}
                    className={`flex items-center justify-between text-xs font-bold px-3 py-3 transition-colors border-b border-amber-500/10 last:border-b-0 ${
                      r.id === currentRole ? "bg-amber-500/10" : "hover:bg-amber-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full ring-1 ring-black/10 shrink-0" style={{ backgroundColor: style.color }} />
                      <span style={{ color: style.color }}>{r.name}</span>
                    </div>
                    {r.id === currentRole && <Check className="w-3.5 h-3.5" style={{ color: style.color }} />}
                  </button>
                );
              })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Expand Modal
// ═══════════════════════════════════════
function ExpandModal({ open, onClose, title, icon: Icon, badge, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: any;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200">
        {/* Modal Header */}
        <div className="bg-[#fdf8f0] px-6 py-4 border-b border-amber-500/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Icon className="w-5 h-5 text-[#8B0000]" />
            <h2 className="text-base font-extrabold text-[#3d200a] uppercase tracking-wider">{title}</h2>
            {badge}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8a5d33] hover:bg-[#8B0000]/10 hover:text-[#8B0000] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Section Card Wrapper
// ═══════════════════════════════════════
function SectionCard({ title, icon: Icon, badge, onExpand, children, className }: {
  title: string;
  icon: any;
  badge?: React.ReactNode;
  onExpand: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white/80 backdrop-blur-sm border border-amber-300/40 rounded-2xl shadow-sm overflow-hidden flex flex-col ${className || ""}`}>
      <div className="bg-[#fdf8f0] px-4 py-2 border-b border-amber-500/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-3.5 h-3.5 text-[#8B0000] shrink-0" />
          <h2 className="text-[11px] font-extrabold text-[#3d200a] uppercase tracking-wider truncate">{title}</h2>
          {badge}
        </div>
        <button
          onClick={onExpand}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#8a5d33] hover:bg-[#8B0000]/10 hover:text-[#8B0000] transition-colors shrink-0 cursor-pointer"
          title="Expand"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {children}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function TeamManagement({ org, currentUserRole, currentUserId, canManageTeam, canManageRoles }: TeamManagementProps) {
  const availableRoles = buildAvailableRoles(org.roles || []);
  const defaultInviteRoleId =
    availableRoles.find((role: any) => role.name.toLowerCase() === "analyst")?.id ||
    availableRoles.find((role: any) => role.id !== "owner")?.id ||
    "analyst";
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [roleFilter, setRoleFilter] = useState("all");

  // Invite input
  const [newInvites, setNewInvites] = useState<{ email: string; roleId: string }[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [emailAuthEnabled, setEmailAuthEnabled] = useState(false);
  const [usernameDomain, setUsernameDomain] = useState("guest.local");
  const [currentInviteRole, setCurrentInviteRole] = useState(defaultInviteRoleId);
  const [sendingInvites, setSendingInvites] = useState(false);

  // Member actions
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Accept request role
  const [acceptRoleFor, setAcceptRoleFor] = useState<string | null>(null);
  const [acceptRole, setAcceptRole] = useState(defaultInviteRoleId);

  // Modals
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // === Data Fetching ===
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, invitesRes, requestsRes] = await Promise.all([
        fetch(`/api/orgs/members?orgId=${org.id}`),
        fetch(`/api/orgs/invite?orgId=${org.id}`),
        canManageTeam ? fetch(`/api/orgs/join-requests?orgId=${org.id}`) : Promise.resolve(null),
      ]);
      if (membersRes.ok) setMembers(await membersRes.json());
      if (invitesRes.ok) setInvites(await invitesRes.json());
      if (requestsRes && requestsRes.ok) setJoinRequests(await requestsRes.json());
    } catch { console.error("Failed to fetch team data"); }
    finally { setLoading(false); }
  }, [org.id, canManageTeam]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    fetch("/api/auth/methods")
      .then((res) => res.json())
      .then((methods) => {
        setEmailAuthEnabled(Boolean(methods.email));
        if (methods.usernameDomain) setUsernameDomain(String(methods.usernameDomain));
      })
      .catch(() => {
        setEmailAuthEnabled(false);
        setUsernameDomain("guest.local");
      });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // === Invite Handlers ===
  // Username invitations are always available; email invitations are opt-in.
  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-z0-9_.-]{3,32}$/;
    const tokens = currentEmail
      .split(/[\s,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && (usernameRegex.test(e) || (emailAuthEnabled && emailRegex.test(e))));
    if (tokens.length === 0) return;
    const toAdd = tokens.filter((email) => !newInvites.some((inv) => inv.email === email)).map((email) => ({ email, roleId: currentInviteRole }));
    if (toAdd.length > 0) setNewInvites([...newInvites, ...toAdd]);
    setCurrentEmail("");
  };

  // === Username-account password reset ===
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const handleResetPassword = async (userId: string) => {
    if (resetPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orgs/members/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: org.id, userId, newPassword: resetPassword }),
      });
      if (res.ok) { setResetDone(true); }
      else { const data = await res.json(); setError(data.error || "Failed to reset password."); }
    } catch { setError("Something went wrong."); }
    finally { setActionLoading(false); }
  };

  const handleSendInvites = async () => {
    if (newInvites.length === 0) return;
    setSendingInvites(true);
    setError("");
    try {
      const res = await fetch("/api/orgs/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: org.id, invites: newInvites.map((inv) => ({ email: inv.email, roleId: inv.roleId })) }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewInvites([]);
        if (data.warnings?.length) setError(data.warnings.join(" "));
        fetchAll();
      }
      else { const data = await res.json(); setError(data.error || "Failed to send invitations."); }
    } catch { setError("Something went wrong."); }
    finally { setSendingInvites(false); }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/orgs/members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: org.id, memberId, newRole }) });
      if (res.ok) { fetchAll(); setChangingRoleFor(null); setOpenMenuId(null); }
      else { const data = await res.json(); setError(data.error || "Failed to update role."); }
    } catch { setError("Something went wrong."); }
    finally { setActionLoading(false); }
  };

  const handleRemoveMember = async (memberId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/orgs/members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: org.id, memberId }) });
      if (res.ok) { fetchAll(); setConfirmRemove(null); setOpenMenuId(null); }
      else { const data = await res.json(); setError(data.error || "Failed to remove member."); }
    } catch { setError("Something went wrong."); }
    finally { setActionLoading(false); }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try { const res = await fetch(`/api/orgs/invite/${inviteId}`, { method: "DELETE" }); if (res.ok) fetchAll(); }
    catch { console.error("Failed to revoke invite"); }
  };

  const handleAcceptRequest = async (requestId: string, role: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/orgs/join-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, action: "accept", role }) });
      if (res.ok) { fetchAll(); setAcceptRoleFor(null); }
    } catch { console.error("Failed to accept request"); }
    finally { setActionLoading(false); }
  };

  const handleDenyRequest = async (requestId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/orgs/join-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, action: "deny" }) });
      if (res.ok) fetchAll();
    } catch { console.error("Failed to deny request"); }
    finally { setActionLoading(false); }
  };

  // === Derived ===
  const filteredMembers = roleFilter === "all" ? members : members.filter((m) => m.role === roleFilter);
  const uniqueRoles = Array.from(new Set(members.map((m) => m.role)));
  const activeInvites = invites.filter((inv) => inv.status === "pending");
  const previewMembers = members.slice(0, 3);
  const displayInviteIdentifier = (value: string) => {
    const suffix = `@${usernameDomain.toLowerCase()}`;
    return value.toLowerCase().endsWith(suffix) ? value.slice(0, -suffix.length) : value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B0000]" />
      </div>
    );
  }

  // ═══════════════════════════════════════
  // MEMBER LIST (shared between card & modal)
  // ═══════════════════════════════════════
  const renderMemberRow = (member: any, compact: boolean = false) => {
    const memberInitials = member.userName
      ? member.userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?";
    const isOwner = member.roleId === "owner";
    const isSelf = member.userId === currentUserId;

    return (
      <div
        key={member.id}
        className={`group flex items-center justify-between hover:bg-amber-500/[.02] transition-colors relative ${compact ? "px-5 py-3" : "px-6 py-3.5"}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`${compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"} rounded-full flex items-center justify-center shrink-0 font-bold ${
            isOwner ? "bg-[#8B0000]/10 text-[#8B0000]" : "bg-amber-500/10 text-[#8a5d33]"
          }`}>{memberInitials}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className={`${compact ? "text-xs" : "text-sm"} font-bold text-[#3d200a] truncate`}>{member.userName || "Unknown"}</p>
              {isSelf && <span className="text-[9px] font-bold text-[#8a5d33] bg-amber-500/10 px-1.5 py-0.5 rounded">You</span>}
              {member.userUsername && <span className="text-[9px] font-bold text-[#3d200a] bg-[#3d200a]/10 px-1.5 py-0.5 rounded">Username</span>}
            </div>
            <p className={`${compact ? "text-[10px]" : "text-xs"} text-[#8a5d33] truncate`}>{member.userUsername ? `@${member.userUsername}` : member.userEmail}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {changingRoleFor === member.id ? (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
              <RoleDropdown currentRole={member.roleId} roles={availableRoles} onChange={(newRole) => handleChangeRole(member.id, newRole)} small />
              <button onClick={() => setChangingRoleFor(null)} className="text-[10px] text-[#8a5d33] font-bold hover:text-[#3d200a] px-1.5 py-1 rounded-lg hover:bg-amber-500/10 transition-colors">Cancel</button>
            </div>
          ) : (
            <>
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-wider font-bold border"
                style={getRoleStyle(member.roleId, availableRoles)}
              >
                {isOwner && <Crown className="w-2.5 h-2.5" />}
                {member.roleId === "admin" && <Shield className="w-2.5 h-2.5" />}
                {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
              </span>
              {!compact && <span className="text-[10px] text-[#8a5d33]/40 hidden sm:inline">{new Date(member.createdAt).toLocaleDateString()}</span>}
            </>
          )}

          {/* 3-dot menu */}
          {canManageTeam && !isOwner && changingRoleFor !== member.id && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === member.id ? null : member.id); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8a5d33] opacity-0 group-hover:opacity-100 hover:bg-[#8B0000]/10 hover:text-[#8B0000] transition-all cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {openMenuId === member.id && (
                <div className="absolute right-0 top-8 w-48 bg-white border border-amber-500/20 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in slide-in-from-top-1">
                  {!isSelf && (
                    <button onClick={() => { setChangingRoleFor(member.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#3d200a] hover:bg-[#fdf1df] transition-colors cursor-pointer">
                      <Shield className="w-4 h-4 text-[#8a5d33]" /><span className="font-medium">Change Role</span>
                    </button>
                  )}
                  {member.userUsername && (
                    resetFor === member.id ? (
                      <div className="px-4 py-3 space-y-2.5">
                        {resetDone ? (
                          <p className="text-xs text-green-700 font-medium">Password updated. Share it with the member.</p>
                        ) : (
                          <>
                            <p className="text-xs text-[#3d200a] font-medium">Set a new password for @{member.userUsername}</p>
                            <input
                              type="text"
                              autoComplete="off"
                              value={resetPassword}
                              onChange={(e) => setResetPassword(e.target.value)}
                              placeholder="At least 8 characters"
                              className="w-full bg-white border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-xs text-[#3d200a] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/40"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleResetPassword(member.userId)} disabled={actionLoading || resetPassword.length < 8} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#3d200a] text-white rounded-lg text-xs font-bold hover:bg-[#2c1707] disabled:opacity-50">{actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Set"}</button>
                              <button onClick={() => { setResetFor(null); setResetPassword(""); }} className="flex-1 px-2 py-1.5 text-xs font-bold text-[#3d200a] border border-amber-500/30 rounded-lg hover:bg-[#fdf1df]">Cancel</button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <button onClick={() => { setResetFor(member.id); setResetPassword(""); setResetDone(false); setError(""); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#3d200a] hover:bg-[#fdf1df] transition-colors cursor-pointer">
                        <KeyRound className="w-4 h-4 text-[#8a5d33]" /><span className="font-medium">Reset Password</span>
                      </button>
                    )
                  )}
                  <div className="border-t border-amber-500/15 my-1" />
                  {confirmRemove === member.id ? (
                    <div className="px-4 py-3 space-y-2.5">
                      <p className="text-xs text-red-700 font-medium">{isSelf ? "Leave this organization?" : `Remove ${member.userName || "this member"}?`}</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleRemoveMember(member.id)} disabled={actionLoading} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50">{actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}</button>
                        <button onClick={() => setConfirmRemove(null)} className="flex-1 px-2 py-1.5 text-xs font-bold text-[#3d200a] border border-amber-500/30 rounded-lg hover:bg-[#fdf1df]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRemove(member.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" /><span className="font-medium">{isSelf ? "Leave Organization" : "Remove Member"}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {!canManageTeam && isSelf && !isOwner && (
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === member.id ? null : member.id); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8a5d33] opacity-0 group-hover:opacity-100 hover:bg-[#8B0000]/10 hover:text-[#8B0000] transition-all cursor-pointer">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {openMenuId === member.id && (
                <div className="absolute right-0 top-8 w-44 bg-white border border-amber-500/20 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in slide-in-from-top-1">
                  {confirmRemove === member.id ? (
                    <div className="px-4 py-3 space-y-2.5">
                      <p className="text-xs text-red-700 font-medium">Leave this organization?</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleRemoveMember(member.id)} disabled={actionLoading} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50">{actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Leave"}</button>
                        <button onClick={() => setConfirmRemove(null)} className="flex-1 px-2 py-1.5 text-xs font-bold text-[#3d200a] border border-amber-500/30 rounded-lg hover:bg-[#fdf1df]">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRemove(member.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" /><span className="font-medium">Leave Organization</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // INVITE FORM (shared between card & modal)
  // ═══════════════════════════════════════
  const renderInviteForm = () => (
    <form onSubmit={handleAddEmail} className="flex flex-col h-full">
      {/* Fixed top: email input with inline add button */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          <label className="text-[10px] font-bold text-[#8a5d33]/60 uppercase tracking-wider">
            {emailAuthEnabled ? "Username or Email" : "Username"}
          </label>
          <div className="relative group/info">
            <button type="button" className="w-4 h-4 rounded-full bg-amber-500/10 flex items-center justify-center text-[#8a5d33]/50 hover:bg-amber-500/20 hover:text-[#8a5d33] transition-colors cursor-help">
              <Info className="w-2.5 h-2.5" />
            </button>
            <div className="absolute left-0 top-full mt-1.5 w-52 bg-white text-[#8a5d33] text-[10px] leading-relaxed px-3 py-2 rounded-lg shadow-lg border border-amber-500/20 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-150 pointer-events-none z-50">
              {emailAuthEnabled
                ? "Invite by username through the in-app inbox, or by email link."
                : "Invite by username. The invitation appears in their in-app inbox."}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <RoleDropdown currentRole={currentInviteRole} roles={availableRoles} onChange={setCurrentInviteRole} small />
          <input
            type="text"
            value={currentEmail}
            onChange={(e) => setCurrentEmail(e.target.value)}
            placeholder={emailAuthEnabled ? "username or colleague@company.com" : "colleague-username"}
            className="flex-1 min-w-0 bg-white border border-amber-500/30 rounded-xl px-4 py-2 text-[#3d200a] placeholder:text-[#8a5d33]/40 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/50 transition-all text-sm"
          />
          <button
            type="submit"
            disabled={!currentEmail.trim()}
            className="w-[34px] h-[34px] rounded-full bg-[#8B0000] text-white flex items-center justify-center shrink-0 self-center hover:bg-[#730000] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Scrollable middle: queued invites */}
      {newInvites.length > 0 && (
        <div className="flex-1 overflow-y-auto min-h-0 px-4 space-y-1.5 py-1">
          {newInvites.map((inv) => (
            <div key={inv.email} className="flex items-center justify-between bg-[#fdf8f0] border border-amber-500/15 rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {inv.email.includes("@")
                  ? <Mail className="w-3.5 h-3.5 text-amber-500/50 shrink-0" />
                  : <UserPlus className="w-3.5 h-3.5 text-amber-500/50 shrink-0" />}
                <span className="text-xs font-semibold text-[#3d200a] truncate">{inv.email}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <RoleDropdown currentRole={inv.roleId} roles={availableRoles} onChange={(newRole) => setNewInvites(newInvites.map((i) => (i.email === inv.email ? { ...i, roleId: newRole } : i)))} small />
                <button type="button" onClick={() => setNewInvites(newInvites.filter((i) => i.email !== inv.email))} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Fixed bottom: send button (only when invites queued) */}
      {newInvites.length > 0 && (
        <div className="px-4 py-2.5 shrink-0 border-t border-amber-500/10">
          <button type="button" onClick={handleSendInvites} disabled={sendingInvites} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#8B0000] text-white rounded-xl font-bold text-xs shadow-md shadow-[#8B0000]/20 hover:bg-[#730000] transition-all disabled:opacity-50">
            {sendingInvites ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send {newInvites.length} Invite{newInvites.length > 1 ? "s" : ""}
          </button>
        </div>
      )}
    </form>
  );

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 lg:gap-3">
      {/* Page Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#3d200a] tracking-tight">Team Management</h1>
          <p className="text-[#8a5d33] font-medium mt-1">Manage members, invitations, and join requests for {org.name}.</p>
        </div>
        {canManageRoles && (
          <Link
            href={`/app/${org.slug}/roles`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#8B0000] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#8B0000]/20 hover:bg-[#730000] hover:-translate-y-0.5 transition-all shrink-0"
          >
            <Shield className="w-4 h-4" />
            Manage Roles
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* GRID LAYOUT (2-column)                 */}
      {/* ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[1fr_1fr] gap-4 lg:gap-3 flex-1 min-h-0 pb-2">

        {/* ────── TOP LEFT: Invite Members ────── */}
        {canManageTeam && (
          <SectionCard
            title="Invite Members"
            icon={UserPlus}
            onExpand={() => setExpandedSection("invite")}
          >
            {renderInviteForm()}
          </SectionCard>
        )}

        {/* ────── TOP RIGHT: All Members ────── */}
        <SectionCard
          title="All Members"
          icon={Users}
          badge={<span className="text-[10px] font-bold text-[#8a5d33] bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/15">{members.length} total</span>}
          onExpand={() => setExpandedSection("members")}
          className={!canManageTeam ? "lg:col-span-2" : ""}
        >
          <div className="divide-y divide-amber-500/10">
            {previewMembers.map((m) => renderMemberRow(m, true))}
          </div>
          {members.length > 3 && (
            <button
              onClick={() => setExpandedSection("members")}
              className="w-full py-3 text-center text-xs font-extrabold text-[#8a5d33] uppercase tracking-wider hover:bg-amber-500/5 transition-colors border-t border-amber-500/10 cursor-pointer"
            >
              Show all {members.length} members
            </button>
          )}
        </SectionCard>

        {/* ────── BOTTOM LEFT: Joining Requests ────── */}
        {canManageTeam && (
          <SectionCard
            title="Joining Requests"
            icon={UserCheck}
            badge={joinRequests.length > 0 ? <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15">{joinRequests.length} pending</span> : <span className="text-[10px] font-bold text-[#8a5d33]/50 bg-amber-500/5 px-2 py-0.5 rounded-full border border-amber-500/10">0 pending</span>}
            onExpand={() => setExpandedSection("requests")}
          >
            {joinRequests.length === 0 ? (
              <div className="px-5 py-6 text-center flex flex-col items-center justify-center flex-1">
                <Inbox className="w-9 h-9 text-amber-500/20 mx-auto mb-3" />
                <p className="text-xs font-bold text-[#8a5d33]/50">No active requests</p>
                <p className="text-[10px] text-[#8a5d33]/35 mt-1">Pending approval requests from external users will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-amber-500/10">
                {joinRequests.slice(0, 3).map((req) => (
                  <div key={req.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0 text-emerald-600 font-bold text-xs">
                        {req.userName ? req.userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#3d200a] truncate">{req.userName || "Unknown"}</p>
                        <p className="text-[10px] text-[#8a5d33] truncate">{req.userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => { setAcceptRoleFor(req.id); setAcceptRole(defaultInviteRoleId); setExpandedSection("requests"); }} className="px-2 py-1 bg-emerald-600 text-white rounded-md text-[10px] font-bold hover:bg-emerald-700"><Check className="w-3 h-3" /></button>
                      <button onClick={() => handleDenyRequest(req.id)} className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-md text-[10px] font-bold hover:bg-red-100"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {joinRequests.length > 3 && (
                  <button onClick={() => setExpandedSection("requests")} className="w-full py-2.5 text-center text-[10px] font-extrabold text-[#8a5d33] uppercase tracking-wider hover:bg-amber-500/5 transition-colors cursor-pointer">
                    View all {joinRequests.length} requests
                  </button>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* ────── BOTTOM RIGHT: Active Invitations ────── */}
        {canManageTeam && (
          <SectionCard
            title="Active Invitations"
            icon={Mail}
            badge={activeInvites.length > 0 ? <span className="text-[10px] font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/15">{activeInvites.length} sent</span> : <span className="text-[10px] font-bold text-[#8a5d33]/50 bg-amber-500/5 px-2 py-0.5 rounded-full border border-amber-500/10">0 sent</span>}
            onExpand={() => setExpandedSection("invites")}
          >
            {activeInvites.length === 0 ? (
              <div className="px-5 py-6 text-center flex flex-col items-center justify-center flex-1">
                <CheckCircle2 className="w-9 h-9 text-amber-500/20 mx-auto mb-3" />
                <p className="text-xs font-bold text-[#8a5d33]/50">Clean Slate</p>
                <p className="text-[10px] text-[#8a5d33]/35 mt-1">When you invite new team members, their pending status will track here.</p>
              </div>
            ) : (
              <div className="divide-y divide-amber-500/10">
                {activeInvites.slice(0, 3).map((inv) => (
                  <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0">
                        <Mail className="w-3.5 h-3.5 text-amber-600/60" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#3d200a] truncate">{displayInviteIdentifier(inv.email)}</p>
                        <p className="text-[10px] text-[#8a5d33]/50">{new Date(inv.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span 
                        className="px-2 py-0.5 rounded text-[9px] uppercase font-bold border"
                        style={getRoleStyle(inv.roleId, availableRoles)}
                      >
                        {availableRoles.find((r: any) => r.id === inv.roleId)?.name || inv.roleId}
                      </span>
                      <button onClick={() => handleRevokeInvite(inv.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {activeInvites.length > 3 && (
                  <button onClick={() => setExpandedSection("invites")} className="w-full py-2.5 text-center text-[10px] font-extrabold text-[#8a5d33] uppercase tracking-wider hover:bg-amber-500/5 transition-colors cursor-pointer">
                    View all {activeInvites.length} invitations
                  </button>
                )}
              </div>
            )}
          </SectionCard>
        )}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* EXPAND MODALS                          */}
      {/* ═══════════════════════════════════════ */}

      {/* Invite Members Modal */}
      <ExpandModal open={expandedSection === "invite"} onClose={() => setExpandedSection(null)} title="Invite Members" icon={UserPlus}>
        {renderInviteForm()}
      </ExpandModal>

      {/* All Members Modal */}
      <ExpandModal
        open={expandedSection === "members"}
        onClose={() => setExpandedSection(null)}
        title="All Members"
        icon={Users}
        badge={
          <div className="flex items-center gap-2 ml-auto">
            <Filter className="w-3 h-3 text-[#8a5d33]/50" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="text-[10px] font-bold text-[#3d200a] bg-white border border-amber-500/30 rounded-lg px-2 py-1 outline-none cursor-pointer">
              <option value="all">All Roles</option>
              {uniqueRoles.map((r) => (<option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>))}
            </select>
          </div>
        }
      >
        <div className="divide-y divide-amber-500/10">
          {filteredMembers.map((m) => renderMemberRow(m))}
        </div>
      </ExpandModal>

      {/* Joining Requests Modal */}
      <ExpandModal
        open={expandedSection === "requests"}
        onClose={() => setExpandedSection(null)}
        title="Joining Requests"
        icon={UserCheck}
        badge={joinRequests.length > 0 ? <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15 ml-2">{joinRequests.length} pending</span> : undefined}
      >
        {joinRequests.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Inbox className="w-12 h-12 text-amber-500/20 mx-auto mb-4" />
            <p className="text-sm font-bold text-[#8a5d33]/50">No active requests</p>
            <p className="text-xs text-[#8a5d33]/35 mt-1.5">Pending approval requests from external users will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-amber-500/10">
            {joinRequests.map((req) => (
              <div key={req.id} className="px-6 py-4 hover:bg-amber-500/[.02] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0 text-emerald-600 font-bold text-sm">
                      {req.userName ? req.userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#3d200a] truncate">{req.userName || "Unknown"}</p>
                      <p className="text-xs text-[#8a5d33] truncate">{req.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {acceptRoleFor === req.id ? (
                      <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
                        <RoleDropdown currentRole={acceptRole} roles={availableRoles} onChange={(r) => setAcceptRole(r)} small />
                        <button onClick={() => handleAcceptRequest(req.id, acceptRole)} disabled={actionLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50">
                          {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Confirm
                        </button>
                        <button onClick={() => setAcceptRoleFor(null)} className="px-2 py-1.5 text-[#8a5d33] text-xs font-bold hover:bg-amber-500/10 rounded-lg transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-[#8a5d33]/60">{new Date(req.createdAt).toLocaleDateString()}</span>
                        <button onClick={() => { setAcceptRoleFor(req.id); setAcceptRole(defaultInviteRoleId); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all">
                          <UserCheck className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button onClick={() => handleDenyRequest(req.id)} disabled={actionLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-all disabled:opacity-50">
                          <UserX className="w-3.5 h-3.5" /> Deny
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ExpandModal>

      {/* Active Invitations Modal */}
      <ExpandModal
        open={expandedSection === "invites"}
        onClose={() => setExpandedSection(null)}
        title="Active Invitations"
        icon={Mail}
        badge={activeInvites.length > 0 ? <span className="text-[10px] font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/15 ml-2">{activeInvites.length} pending</span> : undefined}
      >
        {activeInvites.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-amber-500/20 mx-auto mb-4" />
            <p className="text-sm font-bold text-[#8a5d33]/50">No active invitations</p>
            <p className="text-xs text-[#8a5d33]/35 mt-1.5">Invite team members from the Invite Members section.</p>
          </div>
        ) : (
          <div className="divide-y divide-amber-500/10">
            {activeInvites.map((inv) => (
              <div key={inv.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-amber-500/[.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0">
                    {inv.email.toLowerCase().endsWith(`@${usernameDomain.toLowerCase()}`)
                      ? <UserPlus className="w-4 h-4 text-amber-600/60" />
                      : <Mail className="w-4 h-4 text-amber-600/60" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#3d200a] truncate">{displayInviteIdentifier(inv.email)}</p>
                    <p className="text-xs text-[#8a5d33]/60">Sent {new Date(inv.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span 
                    className="px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider font-bold border"
                    style={getRoleStyle(inv.roleId, availableRoles)}
                  >
                    {availableRoles.find((r: any) => r.id === inv.roleId)?.name || inv.roleId}
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md text-xs font-bold border border-amber-200">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                  <button onClick={() => handleRevokeInvite(inv.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Revoke">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ExpandModal>
    </div>
  );
}
