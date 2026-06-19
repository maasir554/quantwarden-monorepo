"use client";

import { useState, useEffect, useRef } from "react";
import { Info, Plus, Trash2, Save, XCircle, Shield, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

export default function RoleManagement({
  org,
  currentUserRole,
  canManageRoles,
}: {
  org: any;
  currentUserRole: string;
  canManageRoles: boolean;
}) {
  const router = useRouter();

  const defaultRoles = [
    { id: "owner", name: "Owner", permissions: { team: true, scan: true, asset: true }, isSystem: true, locked: ["team", "scan", "asset"] },
    { id: "admin", name: "Administrator", permissions: { team: true, scan: true, asset: true }, isSystem: true, locked: ["team", "scan", "asset"] },
    { id: "analyst", name: "Analyst", permissions: { team: false, scan: false, asset: false }, isSystem: true, locked: ["team"] },
    { id: "auditor", name: "Auditor", permissions: { team: false, scan: false, asset: false }, isSystem: true, locked: ["team", "scan", "asset"] }
  ];

  const prepareInitialRoles = () => {
    const rolesMap = new Map();
    // Default system roles
    defaultRoles.forEach(def => {
      const existing = org.roles?.find((r: any) => r.name.toLowerCase() === def.name.toLowerCase());
      if (existing) {
        rolesMap.set(def.name, { 
          ...def, 
          id: existing.id, 
          permissions: { ...def.permissions, ...existing.permissions } 
        });
      } else {
        rolesMap.set(def.name, def);
      }
    });

    // Custom roles
    org.roles?.forEach((r: any) => {
      if (!rolesMap.has(r.name) && r.name.toLowerCase() !== "owner" && r.name.toLowerCase() !== "administrator") {
        rolesMap.set(r.name, { id: r.id, name: r.name, permissions: r.permissions, isSystem: false, locked: [] });
      }
    });

    return Array.from(rolesMap.values());
  };

  const [roles, setRoles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  const initialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if clicked outside of color picker
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.color-picker-container')) {
        setActiveColorPicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) {
      setRoles(prepareInitialRoles());
      initialLoadRef.current = false;
    }
  }, [org.roles]);

  const triggerAutoSave = (updatedRoles: any[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    setSaving(true);
    setError("");

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/orgs/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: org.id,
            roles: updatedRoles
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update roles");
        }

        toast.success("Changes saved", {
          position: "bottom-right",
          className: "bg-emerald-50 border-emerald-200 text-emerald-600 font-medium",
          icon: <Shield className="w-4 h-4" />
        });
      } catch (e: any) {
        setError(e.message || "An error occurred while saving.");
      } finally {
        setSaving(false);
      }
    }, 800); // 800ms debounce
  };

  const handleRoleToggle = (roleId: string, permission: "team" | "scan" | "asset") => {
    if (!canManageRoles) return;
    const newRoles = roles.map((r) => {
      if (r.id === roleId) {
        if (r.isSystem && r.locked?.includes(permission)) return r;
        return {
          ...r,
          permissions: { ...r.permissions, [permission]: !r.permissions[permission] }
        };
      }
      return r;
    });
    setRoles(newRoles);
    triggerAutoSave(newRoles);
  };

  const handleAddRole = () => {
    if (!canManageRoles) return;
    const newId = crypto.randomUUID();
    const newRoles = [...roles, { id: newId, name: "New Role", permissions: { team: false, scan: false, asset: false }, isSystem: false, locked: [] }];
    setRoles(newRoles);
    triggerAutoSave(newRoles);

    setTimeout(() => {
      const el = document.getElementById(`role-input-${newId}`) as HTMLInputElement;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
        el.select();
      }
    }, 100);
  };

  const handleRoleNameChange = (roleId: string, name: string) => {
    if (!canManageRoles) return;
    const newRoles = roles.map((r) => r.id === roleId && !r.isSystem ? { ...r, name } : r);
    setRoles(newRoles);
    triggerAutoSave(newRoles);
  };

  const handleRoleColorChange = (roleId: string, color: string) => {
    if (!canManageRoles) return;
    const newRoles = roles.map((r) => r.id === roleId ? { ...r, permissions: { ...r.permissions, color } } : r);
    setRoles(newRoles);
    triggerAutoSave(newRoles);
  };

  const handleRemoveRole = (roleId: string) => {
    if (!canManageRoles) return;
    const newRoles = roles.filter(r => r.id !== roleId);
    setRoles(newRoles);
    triggerAutoSave(newRoles);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 lg:gap-3 max-w-[1000px] w-full">
      {/* Page Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#3d200a] tracking-tight">Manage Roles</h1>
          <p className="text-[#8a5d33] font-medium mt-1">Configure default and custom role permissions for members within {org.name}.</p>
        </div>
        {canManageRoles && (
          <div className="flex items-center gap-3 shrink-0">
            {saving && <span className="text-[#8a5d33] text-sm font-bold flex items-center gap-1.5"><LoaderCircle className="w-4 h-4 animate-spin" /> Saving...</span>}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      <div className="border border-amber-500/20 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col flex-1 h-full max-h-[70vh]">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 relative">
          <table className="w-full text-left font-medium min-w-[500px]">
            <thead className="bg-[#fdf1df] sticky top-0 z-20">
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
                        disabled={!canManageRoles}
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
                      <span className="font-bold text-[#3d200a] leading-none">{r.name}</span>
                    ) : (
                      <input
                        id={`role-input-${r.id}`}
                        type="text"
                        value={r.name}
                        readOnly={!canManageRoles}
                        onChange={(e) => handleRoleNameChange(r.id, e.target.value)}
                        className="bg-transparent border-b border-amber-500/30 focus:border-[#8B0000]/50 outline-none text-[#3d200a] font-bold px-1 py-0.5 w-[140px]"
                      />
                    )}
                  </div>
                  {r.name.toLowerCase() === "owner" && (
                    <div className="text-[10px] text-[#8a5d33]/70 font-semibold mt-1 ml-6 relative -top-0.5">Highest Priority (Implicit)</div>
                  )}
                </td>
                {["team", "scan", "asset"].map((perm: any) => (
                  <td key={perm} className="py-3 px-4 text-center">
                    <button
                      type="button"
                      disabled={!canManageRoles || (r.isSystem && r.locked?.includes(perm))}
                      onClick={() => handleRoleToggle(r.id, perm)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        r.permissions[perm] ? "bg-[#8B0000]" : "bg-amber-500/20"
                      } ${!canManageRoles || (r.isSystem && r.locked?.includes(perm)) ? "opacity-50 cursor-not-allowed" : "hover:bg-[#730000]"}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          r.permissions[perm] ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </td>
                ))}
                <td className="py-3 px-4 text-right">
                  {!r.isSystem && canManageRoles && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(r.id)}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
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
        {canManageRoles && (
          <div className="p-4 bg-amber-500/5 border-t border-amber-500/10 text-center shrink-0">
            <button
              onClick={handleAddRole}
              disabled={roles.length >= 20}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#8a5d33] hover:text-[#8B0000] transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Custom Role {roles.length >= 20 && "(Limit reached)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
