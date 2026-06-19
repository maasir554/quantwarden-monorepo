"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ArrowRight, ArrowLeft, Globe, Lock, Search, EyeOff, Plus, Trash2, Mail, Check, Copy, Info, ChevronDown, ChevronLeft, ChevronRight, Send, XCircle, CheckCircle2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { getRoleStyle } from "@/lib/utils";

const PRESET_COLORS = [
  "#8B0000", // Crimson
  "#ea580c", // Amber
  "#059669", // Emerald
  "#2563eb", // Blue
  "#7c3aed", // Purple
  "#db2777", // Pink
  "#475569", // Slate
  "#3d200a", // Dark Brown
];

// Custom Dropdown Component for fully color-coded options
function RoleDropdown({ 
  currentRoleId, 
  roles, 
  onChange
}: { 
  currentRoleId: string, 
  roles: any[], 
  onChange: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      // Small timeout prevents immediate closure on click
      setTimeout(() => document.addEventListener("click", handleClickOutside), 10);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  const currentRole = roles.find(r => r.id === currentRoleId);

  return (
    <div className="relative text-left" onClick={(e) => e.stopPropagation()}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 text-xs font-bold px-3 py-1.5 rounded-lg border outline-none cursor-pointer transition-colors w-[140px] hover:brightness-95"
        style={getRoleStyle(currentRoleId, roles)}
      >
        <span className="truncate">{currentRole?.name || "Select Role"}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-amber-500/20 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col py-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 pb-1.5 pt-1 mb-1 text-[10px] font-bold text-[#8a5d33]/50 uppercase tracking-wider border-b border-amber-500/10">Select Role</div>
          <div className="flex flex-col max-h-[200px] overflow-y-auto">
            {roles.map(r => {
              const style = getRoleStyle(r.id, roles);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onChange(r.id);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between text-left text-xs font-bold px-3 py-3 transition-colors border-b border-amber-500/10 last:border-b-0 ${
                    r.id === currentRoleId ? "bg-amber-500/10" : "hover:bg-amber-500/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full ring-1 ring-black/10 shrink-0" style={{ backgroundColor: style.color }} />
                    <span style={{ color: style.color }}>{r.name}</span>
                  </div>
                  {r.id === currentRoleId && <Check className="w-3.5 h-3.5" style={{ color: style.color }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionCheckbox({
  checked,
  disabled,
  onToggle,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
      className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
        disabled
          ? checked
            ? "bg-stone-200 border-stone-300 text-white/90 cursor-not-allowed"
            : "bg-white/35 border-amber-500/20 text-transparent cursor-not-allowed"
          : checked
          ? "bg-[#8B0000] border-[#8B0000] text-white shadow-md shadow-[#8B0000]/25 hover:bg-[#730000]"
          : "bg-white/75 border-amber-500/35 text-transparent hover:bg-white hover:border-[#8B0000]/45"
      }`}
    >
      <Check className="w-4 h-4" />
    </button>
  );
}

export default function OnboardingFlow({ org }: { org: any }) {
  const [step, setStep] = useState(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(1);
  const [showHeaderNotch, setShowHeaderNotch] = useState(false);
  const router = useRouter();
  const progressHeaderRef = useRef<HTMLDivElement | null>(null);

  // Load from local storage securely on client side mount
  useEffect(() => {
    try {
      const savedStep = localStorage.getItem(`onboard_step_${org.id}`);
      const savedMax = localStorage.getItem(`onboard_max_${org.id}`);
      if (savedStep) setStep(parseInt(savedStep, 10));
      if (savedMax) setMaxUnlockedStep(parseInt(savedMax, 10));
    } catch(e) {}
  }, [org.id]);

  const navigateToStep = (newStep: number) => {
    setStep(newStep);
    try {
      localStorage.setItem(`onboard_step_${org.id}`, newStep.toString());
      if (newStep > maxUnlockedStep) {
        setMaxUnlockedStep(newStep);
        localStorage.setItem(`onboard_max_${org.id}`, newStep.toString());
      }
    } catch(e) {}
  };

  // Step 1 State
  const [visibility, setVisibility] = useState<"hidden" | "public">(org.discoverable ? "public" : "hidden");
  const [approval, setApproval] = useState<"private" | "public">(org.isPublic ? "public" : "private");

  // Step 2 State
  const [domains, setDomains] = useState<string[]>(org.domains || []);
  const [currentDomain, setCurrentDomain] = useState("");

  // Step 4 State
  const [invites, setInvites] = useState<{ email: string, roleId: string }[]>([]);
  const [sentInvites, setSentInvites] = useState<any[]>([]);
  const [currentInvite, setCurrentInvite] = useState("");
  const [isSendingInvites, setIsSendingInvites] = useState(false);

  useEffect(() => {
    if (step === 4) {
      const fetchSent = async () => {
        try {
          const res = await fetch(`/api/orgs/invite?orgId=${org.id}`);
          if (res.ok) {
            setSentInvites(await res.json());
          }
        } catch(e) {}
      };
      fetchSent();
    }
  }, [step, org.id]);

  useEffect(() => {
    const node = progressHeaderRef.current;
    if (!node) return;

    let rafId: number | null = null;
    const SHOW_AT = 96;
    const HIDE_AT = 126;

    const evaluateNotchVisibility = () => {
      rafId = null;
      const { bottom } = node.getBoundingClientRect();

      setShowHeaderNotch((prev) => {
        if (!prev && bottom <= SHOW_AT) return true;
        if (prev && bottom >= HIDE_AT) return false;
        return prev;
      });
    };

    const onScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(evaluateNotchVisibility);
    };

    evaluateNotchVisibility();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Step 3 State
  const defaultRoles = [
    { id: "admin", name: "Administrator", permissions: { team: true, scan: true, asset: true }, isSystem: true, locked: ["team", "scan", "asset"] },
    { id: "analyst", name: "Analyst", permissions: { team: false, scan: false, asset: false }, isSystem: true, locked: ["team"] },
    { id: "auditor", name: "Auditor", permissions: { team: false, scan: false, asset: false }, isSystem: true, locked: ["team", "scan", "asset"] }
  ];

  const initialRoles = defaultRoles.map(def => {
    const existing = org.roles.find((r: any) => r.name === def.name);
    return existing ? { ...def, id: existing.id, permissions: existing.permissions } : def;
  });

  org.roles.forEach((r: any) => {
    if (!defaultRoles.find(def => def.name === r.name)) {
      initialRoles.push({ id: r.id, name: r.name, permissions: r.permissions, isSystem: false, locked: [] });
    }
  });

  const [roles, setRoles] = useState<any[]>(initialRoles);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.color-picker-container')) {
        setActiveColorPicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global State
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Background Auto-Save
  const autoSave = async (data: any) => {
    setAutoSaveStatus("saving");
    const { visibility: _v, approval: _a, domains: _d, ...restData } = data; // For potential use directly, but we map specific objects.

    try {
      await fetch("/api/orgs/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          ...data
        })
      });
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2500);
    } catch (e) {
      console.error("Auto-save failed", e);
      setAutoSaveStatus("idle");
    }
  };

  const handleVisibilityChange = (val: "hidden" | "public") => {
    setVisibility(val);
    autoSave({ discoverable: val === "public" });
  };

  const handleApprovalChange = (val: "private" | "public") => {
    setApproval(val);
    autoSave({ isPublic: val === "public" });
  };

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDomain.trim()) return;
    
    const splitDomains = currentDomain
      .split(/[\s,]+/)
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);

    if (splitDomains.length === 0) return;

    // Filter out domains already in the list to prevent duplicates
    const newDomainsToAdd = splitDomains.filter(d => !domains.includes(d));
    
    if (newDomainsToAdd.length > 0) {
      const newDomains = [...domains, ...newDomainsToAdd];
      setDomains(newDomains);
      autoSave({ domains: newDomains });
    }
    setCurrentDomain("");
  };

  const handleRemoveDomain = (domain: string) => {
    const newDomains = domains.filter(d => d !== domain);
    setDomains(newDomains);
    autoSave({ domains: newDomains });
  };

  const handleTogglePermission = (roleId: string, perm: string) => {
    const newRoles = roles.map(r => {
      if (r.id === roleId && !r.locked.includes(perm)) {
        return { ...r, permissions: { ...r.permissions, [perm]: !r.permissions[perm] } };
      }
      return r;
    });
    setRoles(newRoles);
    autoSave({ roles: newRoles });
  };

  const handleAddCustomRole = () => {
    const newRoles = [
      ...roles, 
      { id: crypto.randomUUID(), name: "Custom Role", permissions: { team: false, scan: false, asset: false }, isSystem: false, locked: [] }
    ];
    setRoles(newRoles);
    autoSave({ roles: newRoles });
  };

  const handleUpdateRoleName = (roleId: string, newName: string) => {
    const newRoles = roles.map(r => r.id === roleId ? { ...r, name: newName } : r);
    setRoles(newRoles);
    autoSave({ roles: newRoles });
  };

  const handleRoleColorChange = (roleId: string, color: string) => {
    const newRoles = roles.map(r => r.id === roleId ? { ...r, permissions: { ...r.permissions, color } } : r);
    setRoles(newRoles);
    autoSave({ roles: newRoles });
  };

  const handleRemoveRole = (roleId: string) => {
    const newRoles = roles.filter(r => r.id !== roleId);
    setRoles(newRoles);
    autoSave({ roles: newRoles });
  };

  const handleAddInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInvite.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const splitEmails = currentInvite
      .split(/[\s,]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0 && emailRegex.test(e));

    if (splitEmails.length === 0) return;

    // Pick a sensible default role (e.g. Analyst or Member or the first role available)
    const defaultRoleId = roles.find(r => r.name.toLowerCase() === "analyst")?.id || roles[0]?.id || "";

    const newInvitesToAdd = splitEmails
      .filter(email => !invites.some(inv => inv.email === email))
      .map(email => ({ email, roleId: defaultRoleId }));

    if (newInvitesToAdd.length > 0) {
      setInvites([...invites, ...newInvitesToAdd]);
    }
    setCurrentInvite("");
  };

  const handleRemoveInvite = (email: string) => {
    setInvites(invites.filter(inv => inv.email !== email));
  };

  const handleUpdateInviteRole = (email: string, roleId: string) => {
    setInvites(invites.map(inv => inv.email === email ? { ...inv, roleId } : inv));
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(org.slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvites = async () => {
    if (invites.length === 0) return;
    setIsSendingInvites(true);
    
    try {
      setError("");
      const res = await fetch("/api/orgs/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          invites: invites.map(inv => ({ email: inv.email, roleId: inv.roleId }))
        })
      });

      if (res.ok) {
        const fetchRes = await fetch(`/api/orgs/invite?orgId=${org.id}`);
        if (fetchRes.ok) setSentInvites(await fetchRes.json());
        setInvites([]);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to send invitations.");
      }
    } catch(e) {
      setError("An unexpected error occurred while sending invites.");
    }
    
    setIsSendingInvites(false);
  };

  const handleDeleteSentInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/orgs/invite/${inviteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSentInvites(sentInvites.filter(inv => inv.id !== inviteId));
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError("");

    try {
      await autoSave({ discoverable: visibility === "public", isPublic: approval === "public", setupComplete: true });
      localStorage.removeItem(`onboard_step_${org.id}`);
      localStorage.removeItem(`onboard_max_${org.id}`);
      router.push(`/app/${org.slug}`);
    } catch (e) {
      console.error(e);
      setError("Something went wrong finalizing setup.");
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)]"
      />

      <div
        aria-hidden={!showHeaderNotch}
        className={`fixed top-8 left-1/2 -translate-x-1/2 -translate-y-1/2 z-60 origin-top bg-[#8B0000]/95 backdrop-blur-md rounded-[999px] border border-white/20 px-5 py-2.5 w-[min(380px,calc(100vw-32px))] transition-[opacity,transform,filter] duration-380 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform,filter] ${
          showHeaderNotch ? "opacity-100 scale-100 blur-0 pointer-events-auto" : "opacity-0 scale-108 blur-[1.5px] pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={() => step > 1 && navigateToStep(step - 1)}
          disabled={step <= 1}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-transparent bg-transparent text-white/85 flex items-center justify-center transition-all hover:bg-white/18 hover:border-white/35 disabled:opacity-35 disabled:cursor-not-allowed"
          aria-label="Previous step"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <p className="text-center text-[10px] font-extrabold tracking-[0.14em] uppercase text-white/95">Organization Setup</p>
        <div className="flex items-center justify-center gap-1 mt-1.5">
          {[1, 2, 3, 4].map((num) => (
            <div key={`notch-${num}`} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => num <= maxUnlockedStep && navigateToStep(num)}
                disabled={num > maxUnlockedStep}
                className={`w-3 h-3 rounded-full border ${
                  step >= num ? "bg-white border-white" : "bg-white/20 border-white/35"
                } transition-all ${
                  num <= maxUnlockedStep ? "cursor-pointer hover:scale-110" : "cursor-not-allowed opacity-60"
                }`}
                aria-label={`Go to step ${num}`}
              >
                <span className="sr-only">Step {num}</span>
              </button>
              {num < 4 && (
                <span className={`h-0.5 w-3 rounded-full ${step > num ? "bg-white/80" : "bg-white/25"}`} />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => step < maxUnlockedStep && navigateToStep(step + 1)}
          disabled={step >= maxUnlockedStep}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-transparent bg-transparent text-white/85 flex items-center justify-center transition-all hover:bg-white/18 hover:border-white/35 disabled:opacity-35 disabled:cursor-not-allowed"
          aria-label="Next step"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto py-10">
      {/* Progress Header */}
      <div ref={progressHeaderRef} className="mb-10 text-center">
        <h1 className="text-3xl font-black text-[#8B0000] mb-2 tracking-tight">Organization Setup</h1>
        <p className="text-[#8a5d33] font-medium">Configure {org.name} to get started</p>
        
        <div className="flex items-center justify-center gap-9 mt-8">
          <button
            type="button"
            onClick={() => step > 1 && navigateToStep(step - 1)}
            disabled={step <= 1}
            className="w-9 h-9 rounded-full border border-transparent bg-transparent text-[#8B0000] flex items-center justify-center transition-all hover:bg-white/45 hover:border-white/60 disabled:opacity-45 disabled:cursor-not-allowed"
            aria-label="Previous step"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className={`relative ${num < 4 ? "mr-7" : ""}`}>
              <button
                type="button"
                onClick={() => {
                  if (num <= maxUnlockedStep) navigateToStep(num);
                }}
                disabled={num > maxUnlockedStep}
                className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all focus:outline-none ${
                  step === num
                    ? "bg-[#8B0000]/88 backdrop-blur-sm text-white shadow-md shadow-[#8B0000]/30 ring-1 ring-white/30 scale-110"
                    : step > num
                    ? "bg-[#8B0000] text-white border border-[#8B0000] shadow-sm shadow-[#8B0000]/25"
                    : "bg-white/22 backdrop-blur-sm border border-white/45 text-[#8a5d33]/65"
                } ${num <= maxUnlockedStep ? "cursor-pointer hover:ring-2 hover:ring-amber-500/40" : "cursor-not-allowed opacity-60"}`}
              >
                {step > num ? <Check className="w-4 h-4" /> : num}
              </button>
              {num < 4 && (
                <span
                  className={`absolute top-1/2 left-full -translate-y-1/2 -ml-1 h-1.5 w-8 rounded-full transition-all ${
                    step > num ? "bg-[#8B0000]/65" : "bg-amber-500/18"
                  }`}
                />
              )}
            </div>
          ))}
          </div>

          <button
            type="button"
            onClick={() => step < 4 && navigateToStep(step + 1)}
            disabled={step >= 4}
            className="w-9 h-9 rounded-full border border-transparent bg-transparent text-[#8B0000] flex items-center justify-center transition-all hover:bg-white/45 hover:border-white/60 disabled:opacity-45 disabled:cursor-not-allowed"
            aria-label="Next step"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-white/65 rounded-2xl shadow-2xl shadow-amber-900/15 overflow-hidden">
        {error && (
          <div className="bg-red-50 border-b border-red-200 text-red-600 px-6 py-3 text-sm font-medium flex items-center gap-2">
            {error}
          </div>
        )}

        <div className="p-8 md:p-10">
          {/* STEP 1: Privacy Settings */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-[#3d200a]">Search Visibility</h2>
                <div className="grid grid-cols-1 md:grid-grid-cols-2 gap-4">
                  <button
                    onClick={() => handleVisibilityChange("hidden")}
                    className={`flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left ${
                      visibility === "hidden"
                        ? "border-[#8B0000]/80 bg-[#8B0000]/12 shadow-md shadow-[#8B0000]/15 ring-1 ring-[#8B0000]/20"
                        : "border-amber-500/18 hover:border-amber-500/35 bg-transparent hover:bg-white/25"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 font-bold text-[#3d200a]">
                      <EyeOff className={`w-5 h-5 ${visibility === "hidden" ? "text-[#8B0000]" : "text-[#8a5d33]"}`} /> Hidden (Default)
                    </div>
                    <p className="text-sm text-[#8a5d33] font-medium leading-relaxed">
                      Your organization won't appear in search results. Members must know the exact join code.
                    </p>
                  </button>

                  <button
                    onClick={() => handleVisibilityChange("public")}
                    className={`flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left ${
                      visibility === "public"
                        ? "border-[#8B0000]/80 bg-[#8B0000]/12 shadow-md shadow-[#8B0000]/15 ring-1 ring-[#8B0000]/20"
                        : "border-amber-500/18 hover:border-amber-500/35 bg-transparent hover:bg-white/25"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 font-bold text-[#3d200a]">
                      <Search className={`w-5 h-5 ${visibility === "public" ? "text-[#8B0000]" : "text-[#8a5d33]"}`} /> Public
                    </div>
                    <p className="text-sm text-[#8a5d33] font-medium leading-relaxed">
                      Anyone can find your organization by searching its name.
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-amber-500/10">
                <h2 className="text-xl font-bold text-[#3d200a]">Joining Approval</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleApprovalChange("private")}
                    className={`flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left ${
                      approval === "private"
                        ? "border-[#8B0000]/80 bg-[#8B0000]/12 shadow-md shadow-[#8B0000]/15 ring-1 ring-[#8B0000]/20"
                        : "border-amber-500/18 hover:border-amber-500/35 bg-transparent hover:bg-white/25"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 font-bold text-[#3d200a]">
                      <Lock className={`w-5 h-5 ${approval === "private" ? "text-[#8B0000]" : "text-[#8a5d33]"}`} /> Private
                    </div>
                    <p className="text-sm text-[#8a5d33] font-medium leading-relaxed">
                      Owners and admins must manually approve any request to join.
                    </p>
                  </button>

                  <button
                    onClick={() => handleApprovalChange("public")}
                    className={`flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left ${
                      approval === "public"
                        ? "border-[#8B0000]/80 bg-[#8B0000]/12 shadow-md shadow-[#8B0000]/15 ring-1 ring-[#8B0000]/20"
                        : "border-amber-500/18 hover:border-amber-500/35 bg-transparent hover:bg-white/25"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 font-bold text-[#3d200a]">
                      <Globe className={`w-5 h-5 ${approval === "public" ? "text-[#8B0000]" : "text-[#8a5d33]"}`} /> Public
                    </div>
                    <p className="text-sm text-[#8a5d33] font-medium leading-relaxed">
                      Anyone who knows the joining code can instantly join as a member without approval.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Root Domains */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <h2 className="text-xl font-bold text-[#3d200a] mb-2">Root Domains</h2>
                <p className="text-[#8a5d33] font-medium leading-relaxed">
                  Enter your root domain(s) manually. QuantWarden will automatically discover and catalogue your public sub-domains and assets.
                </p>
              </div>

              <form onSubmit={handleAddDomain} className="flex gap-3">
                <input
                  type="text"
                  value={currentDomain}
                  onChange={(e) => setCurrentDomain(e.target.value)}
                  placeholder="e.g. quantwarden.com, example.com"
                  className="flex-1 bg-white border border-amber-500/30 rounded-xl px-4 py-3 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/50 transition-all shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!currentDomain.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-[#8B0000] text-white rounded-xl font-bold text-sm hover:bg-[#730000] transition-all shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>
              <p className="text-xs text-[#8a5d33]/70 font-medium px-1">
                You can add multiple domains at once. Separate them with spaces, commas, or newlines.
              </p>

              {domains.length > 0 ? (
                <div className="border border-amber-500/20 rounded-xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left font-medium">
                    <thead className="bg-[#fdf1df]">
                      <tr>
                        <th className="py-3 px-4 text-[#8a5d33] text-xs uppercase tracking-wider">Domain</th>
                        <th className="py-3 px-4 text-right text-[#8a5d33] text-xs uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-500/10">
                      {domains.map((d) => (
                        <tr key={d} className="hover:bg-amber-500/5 transition-colors">
                          <td className="py-3 px-4 text-[#3d200a]">{d}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRemoveDomain(d)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-amber-50/50 border-2 border-dashed border-amber-500/20 rounded-xl p-8 text-center">
                  <Globe className="w-8 h-8 text-amber-500/50 mx-auto mb-3" />
                  <p className="text-[#8a5d33] font-medium text-sm">No domains added yet.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Roles and Permissions */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <h2 className="text-xl font-bold text-[#3d200a] mb-2">Roles & Permissions</h2>
                <p className="text-[#8a5d33] font-medium leading-relaxed">
                  Configure default and custom role permissions for members within your organization. 
                </p>
              </div>

              <div className="border border-amber-500/20 rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto">
                <table className="w-full text-left font-medium min-w-[500px]">
                  <thead className="bg-[#fdf1df]">
                    <tr>
                      <th className="py-3 px-4 text-[#8a5d33] text-xs uppercase tracking-wider">Role Name</th>
                      <th className="py-3 px-4 text-center text-[#8a5d33] text-xs uppercase tracking-wider relative group">
                        <div className="flex items-center justify-center gap-1.5 cursor-help">
                          Team Mgt
                          <Info className="w-3.5 h-3.5 text-amber-500/70" />
                        </div>
                        <div className="absolute hidden group-hover:block top-full mt-1 left-1/2 -translate-x-1/2 w-48 bg-[#3d200a] text-white text-[10px] leading-relaxed normal-case p-3 rounded-lg shadow-xl z-50 font-medium text-left">
                          Approve/deny join requests, assign user roles, add/remove users.
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[#3d200a]"></div>
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center text-[#8a5d33] text-xs uppercase tracking-wider relative group">
                        <div className="flex items-center justify-center gap-1.5 cursor-help">
                          Scan Config
                          <Info className="w-3.5 h-3.5 text-amber-500/70" />
                        </div>
                        <div className="absolute hidden group-hover:block top-full mt-1 left-1/2 -translate-x-1/2 w-48 bg-[#3d200a] text-white text-[10px] leading-relaxed normal-case p-3 rounded-lg shadow-xl z-50 font-medium text-left">
                          Schedule Normal and Advanced Scans.
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[#3d200a]"></div>
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center text-[#8a5d33] text-xs uppercase tracking-wider relative group">
                        <div className="flex items-center justify-center gap-1.5 cursor-help">
                          Asset Mgt
                          <Info className="w-3.5 h-3.5 text-amber-500/70" />
                        </div>
                        <div className="absolute hidden group-hover:block top-full mt-1 left-1/2 -translate-x-1/2 w-52 bg-[#3d200a] text-white text-[10px] leading-relaxed normal-case p-3 rounded-lg shadow-xl z-50 font-medium text-left">
                          Add or remove domains/subdomains, verify ownership of domains/subdomains.
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[#3d200a]"></div>
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right text-[#8a5d33] text-xs uppercase tracking-wider w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/10">
                    {roles.map((r) => (
                      <tr key={r.id} className="hover:bg-amber-500/5 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3 relative">
                            <div className="relative color-picker-container">
                              <button
                                onClick={() => setActiveColorPicker(activeColorPicker === r.id ? null : r.id)}
                                className="w-3.5 h-3.5 rounded-full border border-black/20 hover:scale-110 transition-transform shrink-0 shadow-sm"
                                style={{ backgroundColor: r.permissions?.color || "#d1d5db" }}
                                title="Choose role color"
                              />
                              {activeColorPicker === r.id && (
                                <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-amber-500/20 shadow-2xl rounded-xl p-3 flex flex-col gap-3 w-40 animate-in fade-in zoom-in duration-150 origin-top-left">
                                  <div className="text-[10px] uppercase font-bold text-[#8a5d33] tracking-widest">Preset Colors</div>
                                  <div className="grid grid-cols-4 gap-2">
                                    {PRESET_COLORS.map(c => (
                                      <button
                                        key={c}
                                        onClick={() => {
                                          handleRoleColorChange(r.id, c);
                                          setActiveColorPicker(null);
                                        }}
                                        className={`w-6 h-6 rounded-full border border-black/20 transition-transform ${r.permissions?.color === c ? 'ring-2 ring-offset-1 ring-black/50 scale-110' : 'hover:scale-110'}`}
                                        style={{ backgroundColor: c }}
                                        title={c}
                                      />
                                    ))}
                                  </div>
                                  <div className="border-t border-amber-500/10 pt-2 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-gray-500 uppercase font-semibold">Custom</span>
                                    <div className="relative rounded overflow-hidden shadow-sm border border-black/10 w-8 h-6">
                                      <input
                                        type="color"
                                        value={r.permissions?.color || "#000000"}
                                        onChange={(e) => handleRoleColorChange(r.id, e.target.value)}
                                        className="absolute inset-0 w-[200%] h-[200%] -ml-[50%] -mt-[50%] cursor-pointer opacity-0"
                                      />
                                      <div className="w-full h-full pointer-events-none" style={{ backgroundColor: r.permissions?.color || "#000000" }} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {r.isSystem ? (
                              <span className="text-[#3d200a] font-bold">{r.name}</span>
                            ) : (
                              <input 
                                type="text" 
                                value={r.name} 
                                onChange={(e) => handleUpdateRoleName(r.id, e.target.value)}
                                className="bg-white border border-amber-500/30 rounded-lg px-2 py-1 text-[#3d200a] font-bold outline-none focus:ring-2 ring-[#8B0000]/40 w-full max-w-[150px]"
                              />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <PermissionCheckbox
                            checked={r.permissions.team}
                            disabled={r.locked.includes("team")}
                            onToggle={() => handleTogglePermission(r.id, "team")}
                            label={`${r.name} team management permission`}
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <PermissionCheckbox
                            checked={r.permissions.scan}
                            disabled={r.locked.includes("scan")}
                            onToggle={() => handleTogglePermission(r.id, "scan")}
                            label={`${r.name} scan configuration permission`}
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <PermissionCheckbox
                            checked={r.permissions.asset}
                            disabled={r.locked.includes("asset")}
                            onToggle={() => handleTogglePermission(r.id, "asset")}
                            label={`${r.name} asset management permission`}
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!r.isSystem && (
                            <button
                              onClick={() => handleRemoveRole(r.id)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors ml-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <button
                onClick={handleAddCustomRole}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-amber-500/40 text-[#8a5d33] rounded-xl font-bold text-sm hover:bg-amber-500/10 hover:border-amber-500/60 transition-all w-full justify-center"
              >
                <Plus className="w-4 h-4" /> Add Custom Role
              </button>
            </div>
          )}

          {/* STEP 4: Invite Members */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <h2 className="text-xl font-bold text-[#3d200a] mb-2">Invite Your Team</h2>
                <p className="text-[#8a5d33] font-medium leading-relaxed">
                  Start adding colleagues to your workspace. Roles can be changed at any time.
                </p>
              </div>

              <form onSubmit={handleAddInvite} className="flex gap-3">
                <input
                  type="text"
                  value={currentInvite}
                  onChange={(e) => setCurrentInvite(e.target.value)}
                  placeholder="name@company.com, ceo@company.com"
                  className="flex-1 bg-white border border-amber-500/30 rounded-xl px-4 py-3 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/50 transition-all shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!currentInvite.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-[#8B0000] text-white rounded-xl font-bold text-sm hover:bg-[#730000] transition-all shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>
              <p className="text-xs text-[#8a5d33]/70 font-medium px-1">
                You can add multiple emails at once. Separate them with spaces, commas, or newlines.
              </p>

              {invites.length > 0 && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="border border-amber-500/20 rounded-xl bg-white shadow-sm mt-4 overflow-visible">
                    <table className="w-full text-left font-medium">
                      <thead className="bg-[#fdf1df]">
                        <tr>
                          <th className="py-2.5 px-4 text-[#8a5d33] text-[10px] uppercase tracking-wider font-bold">Email</th>
                          <th className="py-2.5 px-4 text-right text-[#8a5d33] text-[10px] uppercase tracking-wider font-bold">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-500/10">
                        {invites.map((inv, index) => (
                          <tr key={inv.email} className={`hover:bg-amber-500/5 transition-colors`}>
                            <td className="py-3 px-4 flex items-center gap-3">
                              <Mail className="w-4 h-4 text-amber-500/50" />
                              <span className="text-[#3d200a] text-sm font-semibold">{inv.email}</span>
                            </td>
                            <td className="py-2 px-2 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <RoleDropdown 
                                currentRoleId={inv.roleId} 
                                roles={roles} 
                                onChange={(newRoleId) => handleUpdateInviteRole(inv.email, newRoleId)} 
                              />
                              <button
                                onClick={() => handleRemoveInvite(inv.email)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Remove Invite"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2 border-b border-amber-500/10 pb-6">
                    <button
                      onClick={handleSendInvites}
                      disabled={isSendingInvites}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#8B0000] text-white rounded-xl font-bold shadow-md shadow-[#8B0000]/20 hover:bg-[#730000] transition-all disabled:opacity-50"
                    >
                      {isSendingInvites ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send Invitations
                    </button>
                  </div>
                </div>
              )}

              {sentInvites.length > 0 && (
                <div className="mt-8 pt-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#8a5d33] uppercase tracking-wider">Sent Invitations</h3>
                    <span className="px-2.5 py-1 bg-amber-500/10 text-[#8a5d33] text-xs font-bold rounded-full border border-amber-500/20">
                      {sentInvites.length} queued
                    </span>
                  </div>
                  <div className="border border-amber-500/20 rounded-xl bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-left font-medium">
                      <thead className="bg-[#f0e8db]">
                        <tr>
                          <th className="py-2.5 px-4 text-[#8a5d33] text-[10px] uppercase tracking-wider font-bold">Email</th>
                          <th className="py-2.5 px-4 text-[#8a5d33] text-[10px] uppercase tracking-wider font-bold hidden sm:table-cell">Role</th>
                          <th className="py-2.5 px-4 text-right text-[#8a5d33] text-[10px] uppercase tracking-wider font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-500/10">
                        {sentInvites.map((inv) => (
                          <tr key={inv.id} className="hover:bg-amber-500/5 transition-colors">
                            <td className="py-3 px-4 flex items-center gap-3">
                              <span className="text-[#3d200a] text-sm font-semibold">{inv.email}</span>
                            </td>
                            <td className="py-3 px-4 hidden sm:table-cell">
                              <span 
                                className="inline-block px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border"
                                style={getRoleStyle(inv.roleId, roles)}
                              >
                                {roles.find(r => r.id === inv.roleId)?.name || "Unknown Role"}
                              </span>
                            </td>
                            <td className="py-3 px-4 flex justify-end items-center gap-3">
                              {inv.status === "pending" && (
                                <span className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md text-xs font-bold border border-amber-200">
                                  <Clock className="w-3.5 h-3.5" /> Pending
                                </span>
                              )}
                              {inv.status === "accepted" && (
                                <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md text-xs font-bold border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                                </span>
                              )}
                              {inv.status === "declined" && (
                                <span className="inline-flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-md text-xs font-bold border border-red-200">
                                  <XCircle className="w-3.5 h-3.5" /> Declined
                                </span>
                              )}
                              {(inv.status === "pending" || inv.status === "declined") && (
                                <button
                                  onClick={() => handleDeleteSentInvite(inv.id)}
                                  className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                  title="Revoke / Delete Invite"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-amber-500/20 text-center">
                <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                  <Globe className="w-5 h-5 text-amber-500/70" />
                </div>
                <h3 className="text-lg font-bold text-[#3d200a] mb-2">Or share joining code</h3>
                <p className="text-sm text-[#8a5d33] mb-6 max-w-[300px] mx-auto">
                  Anyone with this code can automatically join your workspace.
                </p>
                
                <div className="flex flex-col items-center">
                  <div className="bg-[#fdf1df] border border-amber-500/30 rounded-xl px-8 py-4 mb-4 select-all font-mono text-2xl font-bold text-[#8B0000] tracking-[0.2em] shadow-inner">
                    {org.slug}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-amber-500/30 text-[#3d200a] rounded-xl font-bold text-sm hover:bg-[#fdf1df] transition-all shadow-sm"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#8a5d33]" />}
                    {copied ? "Copied!" : "Copy Joining Code"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-white/20 backdrop-blur-xl border-t border-white/35 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-center sm:justify-start gap-4 w-full sm:w-auto">
            <button
              onClick={() => step > 1 ? navigateToStep(step - 1) : router.push("/app")}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-[#8a5d33] font-bold hover:bg-amber-500/10 rounded-xl transition-colors w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4" /> {step > 1 ? "Back" : "Dashboard"}
            </button>

            {/* Desktop Auto-save indicator */}
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium transition-opacity duration-300 w-32">
              {autoSaveStatus === "saving" && (
                <span className="flex items-center gap-1.5 text-[#8a5d33] whitespace-nowrap">
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </span>
              )}
              {autoSaveStatus === "saved" && (
                <span className="flex items-center gap-1.5 text-emerald-600 animate-in fade-in zoom-in duration-300 whitespace-nowrap">
                  <Check className="w-4 h-4" /> Auto-saved
                </span>
              )}
            </div>
          </div>

          {step < 4 ? (
            <button
              onClick={() => navigateToStep(step + 1)}
              className="flex items-center justify-center gap-2 px-8 py-2.5 bg-[#8B0000] text-white rounded-xl font-bold shadow-md shadow-[#8B0000]/20 hover:bg-[#730000] transition-all w-full sm:w-auto mt-4 sm:mt-0"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="group flex flex-col items-center justify-center px-8 py-2 bg-[#8B0000] text-white rounded-xl font-bold shadow-md shadow-[#8B0000]/20 hover:bg-[#730000] transition-all w-full sm:w-auto mt-4 sm:mt-0 disabled:opacity-50 min-w-[200px]"
            >
              <div className="flex items-center gap-2 text-sm leading-tight">
                {saving ? "Finalizing Setup..." : "Go to Dashboard"}
                {!saving && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </div>
              <span className="text-[10px] text-white/70 font-medium">Skip / Finish Setup</span>
            </button>
          )}

          {/* Mobile Auto-save indicator */}
          <div className="sm:hidden flex items-center justify-center gap-2 text-sm font-medium h-6 mt-2">
            {autoSaveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-[#8a5d33] whitespace-nowrap">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-emerald-600 animate-in fade-in zoom-in duration-300 whitespace-nowrap">
                <Check className="w-4 h-4" /> Auto-saved
              </span>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
