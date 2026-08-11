"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

type AdminSection = "users" | "organizations";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  organizationCount: number;
  superAdmin: boolean;
  configuredSuperAdmin: boolean;
  createdAt: string;
};

type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  isPublic: boolean;
  discoverable: boolean;
  memberCount: number;
  assetCount: number;
  scanCount: number;
};

type OrganizationMember = {
  id: string;
  userId: string;
  roleId: string;
  roleName: string;
  userName: string;
  userEmail: string;
};

type OrganizationRole = { id: string; name: string; permissions: string };

type MemberPanel = {
  organization: { id: string; name: string; slug: string };
  members: OrganizationMember[];
  roles: OrganizationRole[];
};

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 disabled:bg-slate-100";
const secondaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#8B0000] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#730000] disabled:cursor-not-allowed disabled:opacity-50";

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminConsole() {
  const [section, setSection] = useState<AdminSection>("users");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirm, setCreateConfirm] = useState("");

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirm, setEditConfirm] = useState("");

  const [editingOrg, setEditingOrg] = useState<AdminOrganization | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgPublic, setEditOrgPublic] = useState(false);
  const [editOrgDiscoverable, setEditOrgDiscoverable] = useState(false);

  const [memberPanel, setMemberPanel] = useState<MemberPanel | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState("member");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersData, organizationsData] = await Promise.all([
        jsonRequest("/api/admin/users", { cache: "no-store" }),
        jsonRequest("/api/admin/organizations", { cache: "no-store" }),
      ]);
      setCurrentUserId(usersData.currentUserId || "");
      setUsers(usersData.users || []);
      setOrganizations(organizationsData.organizations || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const notify = (text: string) => {
    setMessage(text);
    setError("");
    window.setTimeout(() => setMessage(""), 3500);
  };

  const openCreateModal = () => {
    setCreateName("");
    setCreateEmail("");
    setCreatePassword("");
    setCreateConfirm("");
    setError("");
    setCreateOpen(true);
  };

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await jsonRequest("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, email: createEmail, password: createPassword, confirmPassword: createConfirm }),
      });
      setCreateOpen(false);
      notify("Account created. It can sign in immediately.");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  };

  const openUserEditor = (user: AdminUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword("");
    setEditConfirm("");
    setError("");
  };

  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    setBusy(true);
    setError("");
    try {
      await jsonRequest("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingUser.id, name: editName, email: editEmail, password: editPassword, confirmPassword: editConfirm }),
      });
      setEditingUser(null);
      notify(editPassword ? "Account and password updated." : "Account updated.");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update account.");
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await jsonRequest("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      notify("Account deleted.");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete account.");
    } finally {
      setBusy(false);
    }
  };

  const setSuperAdmin = async (user: AdminUser, superAdmin: boolean) => {
    const action = superAdmin ? "grant super-admin access to" : "revoke super-admin access from";
    if (!window.confirm(`Are you sure you want to ${action} ${user.email}?`)) return;
    setBusy(true);
    setError("");
    try {
      await jsonRequest("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, action: "setSuperAdmin", superAdmin }),
      });
      notify(superAdmin ? "Super-admin access granted." : "Super-admin access revoked.");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update super-admin access.");
    } finally {
      setBusy(false);
    }
  };

  const openOrgEditor = (organization: AdminOrganization) => {
    setEditingOrg(organization);
    setEditOrgName(organization.name);
    setEditOrgPublic(organization.isPublic);
    setEditOrgDiscoverable(organization.discoverable);
    setError("");
  };

  const saveOrganization = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingOrg) return;
    setBusy(true);
    setError("");
    try {
      await jsonRequest("/api/admin/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: editingOrg.id, name: editOrgName, isPublic: editOrgPublic, discoverable: editOrgDiscoverable }),
      });
      setEditingOrg(null);
      notify("Organization settings updated.");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update organization.");
    } finally {
      setBusy(false);
    }
  };

  const loadMembers = async (organizationId: string) => {
    setMembersLoading(true);
    setError("");
    try {
      const data = await jsonRequest(`/api/admin/organizations/${organizationId}/members`, { cache: "no-store" });
      setMemberPanel(data);
      setAddUserId("");
      setAddRole("member");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load members.");
    } finally {
      setMembersLoading(false);
    }
  };

  const roleOptions = useMemo(() => {
    const custom = memberPanel?.roles || [];
    return [
      { id: "admin", name: "Administrator" },
      { id: "analyst", name: "Analyst" },
      { id: "auditor", name: "Auditor" },
      { id: "member", name: "Member" },
      ...custom.map((role) => ({ id: role.id, name: role.name })),
    ].filter((role, index, all) => all.findIndex((item) => item.id === role.id) === index);
  }, [memberPanel?.roles]);

  const availableUsers = useMemo(() => {
    const memberIds = new Set(memberPanel?.members.map((member) => member.userId) || []);
    return users.filter((user) => !memberIds.has(user.id));
  }, [memberPanel?.members, users]);

  const addMember = async () => {
    if (!memberPanel || !addUserId) return;
    setBusy(true);
    setError("");
    try {
      await jsonRequest(`/api/admin/organizations/${memberPanel.organization.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId, role: addRole }),
      });
      notify("Member added.");
      await loadMembers(memberPanel.organization.id);
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add member.");
    } finally {
      setBusy(false);
    }
  };

  const updateMember = async (member: OrganizationMember, role: string) => {
    if (!memberPanel) return;
    setBusy(true);
    setError("");
    try {
      await jsonRequest(`/api/admin/organizations/${memberPanel.organization.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, role }),
      });
      notify("Member role updated.");
      await loadMembers(memberPanel.organization.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update member.");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: OrganizationMember) => {
    if (!memberPanel || !window.confirm(`Remove ${member.userEmail} from this organization?`)) return;
    setBusy(true);
    setError("");
    try {
      await jsonRequest(`/api/admin/organizations/${memberPanel.organization.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      notify("Member removed.");
      await loadMembers(memberPanel.organization.id);
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove member.");
    } finally {
      setBusy(false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = users.filter((user) => !normalizedQuery || `${user.name} ${user.email}`.toLowerCase().includes(normalizedQuery));
  const filteredOrganizations = organizations.filter((organization) => !normalizedQuery || `${organization.name} ${organization.slug}`.toLowerCase().includes(normalizedQuery));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/app" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Administration</h1>
          <p className="mt-1 text-sm text-slate-600">Manage user access and organizations.</p>
        </div>
        <button type="button" onClick={loadOverview} className={secondaryButtonClass} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <nav aria-label="Admin sections" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button type="button" onClick={() => { setSection("users"); setQuery(""); }} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${section === "users" ? "bg-[#8B0000] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
          <Users className="h-4 w-4" /> Users <span className={section === "users" ? "text-white/70" : "text-slate-400"}>{users.length}</span>
        </button>
        <button type="button" onClick={() => { setSection("organizations"); setQuery(""); }} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${section === "organizations" ? "bg-[#8B0000] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
          <Building2 className="h-4 w-4" /> Organizations <span className={section === "organizations" ? "text-white/70" : "text-slate-400"}>{organizations.length}</span>
        </button>
      </nav>

      {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{section === "users" ? "Users" : "Organizations"}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {section === "users" ? "Create credentials and manage account access." : "Inspect workspaces, membership, and permissions."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${section}`} className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/10 sm:w-64" />
            </label>
            {section === "users" ? <button type="button" onClick={openCreateModal} className={primaryButtonClass}><Plus className="h-4 w-4" /> Create account</button> : null}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#8B0000]" /></div>
        ) : section === "users" ? (
          filteredUsers.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <tr><th className="px-5 py-3">User</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Organizations</th><th className="px-4 py-3">Created</th><th className="px-5 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4"><p className="font-medium text-slate-950">{user.name}</p><p className="mt-0.5 text-slate-500">{user.email}</p></td>
                      <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Verified</span>{user.superAdmin ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-[#8B0000]">Super admin</span> : null}</div></td>
                      <td className="px-4 py-4 text-slate-600">{user.organizationCount}</td>
                      <td className="px-4 py-4 text-slate-600">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" disabled={busy || user.configuredSuperAdmin || (user.superAdmin && user.id === currentUserId)} onClick={() => setSuperAdmin(user, !user.superAdmin)} className={secondaryButtonClass} title={user.configuredSuperAdmin ? "Configured administrator" : user.superAdmin ? "Revoke super-admin access" : "Make super admin"}><ShieldCheck className="h-4 w-4" /> {user.superAdmin ? "Revoke admin" : "Make admin"}</button><button type="button" onClick={() => openUserEditor(user)} className={secondaryButtonClass} title="Edit account"><Pencil className="h-4 w-4" /> Edit</button><button type="button" disabled={user.superAdmin || busy} onClick={() => deleteUser(user)} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30" title="Delete account"><Trash2 className="h-4 w-4" /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="px-6 py-16 text-center text-sm text-slate-500">No users match your search.</div>
        ) : filteredOrganizations.length ? (
          <div className="divide-y divide-slate-200">
            {filteredOrganizations.map((organization) => (
              <article key={organization.id} className="px-5 py-5 hover:bg-slate-50/70">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><h3 className="truncate font-semibold text-slate-950">{organization.name}</h3><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">{organization.slug}</span></div>
                    <p className="mt-2 text-sm text-slate-500">{organization.memberCount} members · {organization.assetCount} assets · {organization.scanCount} scans · Created {new Date(organization.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/app/${organization.slug}`} className={primaryButtonClass}><ExternalLink className="h-4 w-4" /> Open</Link>
                    <button type="button" onClick={() => loadMembers(organization.id)} className={secondaryButtonClass}><Users className="h-4 w-4" /> Members</button>
                    <Link href={`/app/${organization.slug}/roles`} className={secondaryButtonClass}><ShieldCheck className="h-4 w-4" /> Permissions</Link>
                    <button type="button" onClick={() => openOrgEditor(organization)} className={secondaryButtonClass}><Pencil className="h-4 w-4" /> Settings</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : organizations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Building2 className="mx-auto h-9 w-9 text-slate-300" />
            <h3 className="mt-4 font-semibold text-slate-950">No organizations have been created</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Organizations will appear here as soon as any user creates one.</p>
            <Link href="/app" className={`mt-5 ${primaryButtonClass}`}><Plus className="h-4 w-4" /> Create from dashboard</Link>
          </div>
        ) : <div className="px-6 py-16 text-center text-sm text-slate-500">No organizations match your search.</div>}
      </section>

      {createOpen ? (
        <Modal title="Create account" description="This account will be verified and can sign in with its password immediately." onClose={() => !busy && setCreateOpen(false)}>
          <form onSubmit={createUser} className="space-y-4 p-5">
            <label className="block text-sm font-medium text-slate-700">Full name<input autoFocus required value={createName} onChange={(event) => setCreateName(event.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            <label className="block text-sm font-medium text-slate-700">Email address<input required type="email" value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">Password<input required type="password" minLength={8} value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
              <label className="block text-sm font-medium text-slate-700">Retype password<input required type="password" minLength={8} value={createConfirm} onChange={(event) => setCreateConfirm(event.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            </div>
            {createConfirm && createPassword !== createConfirm ? <p className="text-sm text-red-700">Passwords do not match.</p> : null}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setCreateOpen(false)} className={secondaryButtonClass}>Cancel</button><button disabled={busy || createPassword !== createConfirm} className={primaryButtonClass}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create account</button></div>
          </form>
        </Modal>
      ) : null}

      {editingUser ? (
        <Modal title="Edit account" description="Update the account details or assign a new password." onClose={() => !busy && setEditingUser(null)}>
          <form onSubmit={saveUser} className="space-y-4 p-5">
            <label className="block text-sm font-medium text-slate-700">Full name<input required value={editName} onChange={(event) => setEditName(event.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            <label className="block text-sm font-medium text-slate-700">Email address<input required type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} disabled={editingUser.superAdmin} className={`mt-1.5 ${inputClass}`} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">New password<input type="password" minLength={8} value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder="Leave blank to keep" className={`mt-1.5 ${inputClass}`} /></label>
              <label className="block text-sm font-medium text-slate-700">Retype password<input type="password" minLength={8} value={editConfirm} onChange={(event) => setEditConfirm(event.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setEditingUser(null)} className={secondaryButtonClass}>Cancel</button><button disabled={busy || Boolean(editPassword) !== Boolean(editConfirm) || editPassword !== editConfirm} className={primaryButtonClass}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save changes</button></div>
          </form>
        </Modal>
      ) : null}

      {editingOrg ? (
        <Modal title="Organization settings" onClose={() => !busy && setEditingOrg(null)}>
          <form onSubmit={saveOrganization} className="space-y-4 p-5">
            <label className="block text-sm font-medium text-slate-700">Organization name<input required value={editOrgName} onChange={(event) => setEditOrgName(event.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={editOrgPublic} onChange={(event) => setEditOrgPublic(event.target.checked)} className="h-4 w-4 accent-[#8B0000]" /> Public organization</label>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={editOrgDiscoverable} onChange={(event) => setEditOrgDiscoverable(event.target.checked)} className="h-4 w-4 accent-[#8B0000]" /> Discoverable in explorer</label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setEditingOrg(null)} className={secondaryButtonClass}>Cancel</button><button disabled={busy} className={primaryButtonClass}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save settings</button></div>
          </form>
        </Modal>
      ) : null}

      {membersLoading ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35"><Loader2 className="h-8 w-8 animate-spin text-white" /></div> : null}
      {memberPanel ? (
        <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/45" onMouseDown={(event) => event.target === event.currentTarget && setMemberPanel(null)}>
          <aside role="dialog" aria-modal="true" aria-label={`${memberPanel.organization.name} members`} className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5"><div><h2 className="text-xl font-semibold text-slate-950">{memberPanel.organization.name}</h2><p className="mt-1 text-sm text-slate-500">Members and roles</p></div><button type="button" onClick={() => setMemberPanel(null)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <div className="space-y-6 p-6">
              <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-950">Add member</h3><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_170px_auto]"><select value={addUserId} onChange={(event) => setAddUserId(event.target.value)} className={inputClass}><option value="">Select account</option>{availableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} — {user.email}</option>)}</select><select value={addRole} onChange={(event) => setAddRole(event.target.value)} className={inputClass}>{roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button type="button" onClick={addMember} disabled={!addUserId || busy} className={primaryButtonClass}>Add</button></div></section>
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">{memberPanel.members.map((member) => { const protectedMember = member.roleId.toLowerCase() === "owner" || users.find((user) => user.id === member.userId)?.superAdmin; return <div key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-slate-950">{member.userName}</p><p className="text-sm text-slate-500">{member.userEmail}</p></div><div className="flex gap-2"><select defaultValue={member.roleId} disabled={Boolean(protectedMember) || busy} onChange={(event) => updateMember(member, event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"><option value={member.roleId}>{member.roleName}</option>{roleOptions.filter((role) => role.id !== member.roleId).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button type="button" disabled={Boolean(protectedMember) || busy} onClick={() => removeMember(member)} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div></div>; })}</div>
              <div className="flex flex-wrap gap-2"><Link href={`/app/${memberPanel.organization.slug}/team`} className={primaryButtonClass}>Open team workspace</Link><Link href={`/app/${memberPanel.organization.slug}/roles`} className={secondaryButtonClass}>Edit permissions</Link></div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
