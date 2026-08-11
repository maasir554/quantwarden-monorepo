"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  organizationCount: number;
  superAdmin: boolean;
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

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export default function AdminConsole() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await jsonRequest("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          password: createPassword,
          confirmPassword: createConfirm,
        }),
      });
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateConfirm("");
      notify("Verified credential account created.");
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
        body: JSON.stringify({
          userId: editingUser.id,
          name: editName,
          email: editEmail,
          password: editPassword,
          confirmPassword: editConfirm,
        }),
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
        body: JSON.stringify({
          organizationId: editingOrg.id,
          name: editOrgName,
          isPublic: editOrgPublic,
          discoverable: editOrgDiscoverable,
        }),
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

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-[#3d200a] p-7 text-white shadow-xl">
        <ShieldCheck className="absolute -right-6 -top-8 h-40 w-40 text-white/5" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Protected operations</p>
          <h1 className="mt-2 text-3xl font-black">Super Admin Console</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/70">
            Provision verified credentials, inspect organizations, and manage membership and permissions.
          </p>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Accounts", users.length, Users],
          ["Organizations", organizations.length, Building2],
          ["Assets", organizations.reduce((sum, org) => sum + org.assetCount, 0), ShieldCheck],
        ].map(([label, value, Icon]) => {
          const MetricIcon = Icon as typeof Users;
          return (
            <div key={String(label)} className="rounded-2xl border border-amber-500/20 bg-white p-5 shadow-sm">
              <MetricIcon className="h-5 w-5 text-[#8B0000]" />
              <p className="mt-3 text-3xl font-black text-[#3d200a]">{String(value)}</p>
              <p className="text-sm font-semibold text-[#8a5d33]">{String(label)}</p>
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border border-amber-500/20 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#3d200a]">Create verified credentials</h2>
            <p className="text-sm text-[#8a5d33]">These accounts can sign in immediately without OTP.</p>
          </div>
          <KeyRound className="h-6 w-6 text-[#8B0000]" />
        </div>
        <form onSubmit={createUser} className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <input required value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Full name" className="rounded-xl border border-amber-500/25 px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#8B0000]/25" />
          <input required type="email" value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} placeholder="Email address" className="rounded-xl border border-amber-500/25 px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#8B0000]/25" />
          <input required type="password" minLength={8} value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} placeholder="Password" className="rounded-xl border border-amber-500/25 px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#8B0000]/25" />
          <input required type="password" minLength={8} value={createConfirm} onChange={(event) => setCreateConfirm(event.target.value)} placeholder="Retype password" className="rounded-xl border border-amber-500/25 px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#8B0000]/25" />
          <button disabled={busy || createPassword !== createConfirm} className="lg:col-span-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B0000] px-4 py-3 font-bold text-white hover:bg-[#730000] disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Create account
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-amber-500/20 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-amber-500/15 p-5">
          <h2 className="text-xl font-black text-[#3d200a]">Accounts</h2>
          <button onClick={loadOverview} className="rounded-lg p-2 text-[#8B0000] hover:bg-[#8B0000]/5" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
        </div>
        {loading ? <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-[#8B0000]" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-205 text-sm">
              <thead className="bg-[#fdf8f0] text-left text-xs uppercase tracking-wider text-[#8a5d33]"><tr><th className="p-3">User</th><th className="p-3">Access</th><th className="p-3">Organizations</th><th className="p-3">Created</th><th className="p-3 text-right">Actions</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-amber-500/10">
                    <td className="p-3"><p className="font-bold text-[#3d200a]">{user.name}</p><p className="text-[#8a5d33]">{user.email}</p></td>
                    <td className="p-3"><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">Verified</span>{user.superAdmin ? <span className="ml-2 rounded-full bg-[#8B0000]/10 px-2 py-1 text-xs font-bold text-[#8B0000]">Super Admin</span> : null}</td>
                    <td className="p-3 font-semibold text-[#6f4827]">{user.organizationCount}</td>
                    <td className="p-3 text-[#6f4827]">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="p-3"><div className="flex justify-end gap-2"><button onClick={() => openUserEditor(user)} className="rounded-lg border border-amber-500/25 p-2 text-[#6f4827] hover:bg-[#fdf1df]" title="Edit or reset password"><Pencil className="h-4 w-4" /></button><button disabled={user.superAdmin || busy} onClick={() => deleteUser(user)} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-30" title="Delete"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-amber-500/20 bg-white shadow-sm">
        <div className="border-b border-amber-500/15 p-5"><h2 className="text-xl font-black text-[#3d200a]">Organizations</h2><p className="text-sm text-[#8a5d33]">Open operational data or manage users and roles.</p></div>
        <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-2">
          {organizations.map((organization) => (
            <article key={organization.id} className="rounded-xl border border-amber-500/20 bg-[#fffaf2] p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-[#3d200a]">{organization.name}</h3><p className="text-sm font-mono text-[#8a5d33]">{organization.slug}</p></div><button onClick={() => openOrgEditor(organization)} className="rounded-lg p-2 text-[#6f4827] hover:bg-white"><Pencil className="h-4 w-4" /></button></div>
              <div className="my-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-white p-2"><p className="font-black text-[#3d200a]">{organization.memberCount}</p><p className="text-xs text-[#8a5d33]">Members</p></div><div className="rounded-lg bg-white p-2"><p className="font-black text-[#3d200a]">{organization.assetCount}</p><p className="text-xs text-[#8a5d33]">Assets</p></div><div className="rounded-lg bg-white p-2"><p className="font-black text-[#3d200a]">{organization.scanCount}</p><p className="text-xs text-[#8a5d33]">Scans</p></div></div>
              <div className="flex flex-wrap gap-2"><Link href={`/app/${organization.slug}`} className="inline-flex items-center gap-1 rounded-lg bg-[#8B0000] px-3 py-2 text-sm font-bold text-white"><ExternalLink className="h-4 w-4" /> Open data</Link><button onClick={() => loadMembers(organization.id)} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-white px-3 py-2 text-sm font-bold text-[#6f4827]"><Users className="h-4 w-4" /> Members</button><Link href={`/app/${organization.slug}/roles`} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-white px-3 py-2 text-sm font-bold text-[#6f4827]"><ShieldCheck className="h-4 w-4" /> Permissions</Link></div>
            </article>
          ))}
        </div>
      </section>

      {editingUser ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4"><form onSubmit={saveUser} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h3 className="text-xl font-black text-[#3d200a]">Edit account</h3><p className="text-sm text-[#8a5d33]">Leave password blank to keep it unchanged.</p></div><button type="button" onClick={() => setEditingUser(null)}><X className="h-5 w-5" /></button></div><div className="space-y-3"><input required value={editName} onChange={(event) => setEditName(event.target.value)} className="w-full rounded-xl border border-amber-500/25 px-3 py-2.5" placeholder="Full name" /><input required type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} disabled={editingUser.superAdmin} className="w-full rounded-xl border border-amber-500/25 px-3 py-2.5 disabled:bg-slate-100" placeholder="Email" /><input type="password" minLength={8} value={editPassword} onChange={(event) => setEditPassword(event.target.value)} className="w-full rounded-xl border border-amber-500/25 px-3 py-2.5" placeholder="New password (optional)" /><input type="password" minLength={8} value={editConfirm} onChange={(event) => setEditConfirm(event.target.value)} className="w-full rounded-xl border border-amber-500/25 px-3 py-2.5" placeholder="Retype new password" /></div><button disabled={busy || Boolean(editPassword) !== Boolean(editConfirm) || editPassword !== editConfirm} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B0000] px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Save changes</button></form></div>
      ) : null}

      {editingOrg ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4"><form onSubmit={saveOrganization} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h3 className="text-xl font-black text-[#3d200a]">Organization settings</h3><button type="button" onClick={() => setEditingOrg(null)}><X className="h-5 w-5" /></button></div><input required value={editOrgName} onChange={(event) => setEditOrgName(event.target.value)} className="w-full rounded-xl border border-amber-500/25 px-3 py-2.5" /><label className="mt-4 flex items-center gap-3 text-sm font-semibold text-[#6f4827]"><input type="checkbox" checked={editOrgPublic} onChange={(event) => setEditOrgPublic(event.target.checked)} /> Public organization</label><label className="mt-3 flex items-center gap-3 text-sm font-semibold text-[#6f4827]"><input type="checkbox" checked={editOrgDiscoverable} onChange={(event) => setEditOrgDiscoverable(event.target.checked)} /> Discoverable in explorer</label><button disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B0000] px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Save settings</button></form></div>
      ) : null}

      {membersLoading ? <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40"><Loader2 className="h-10 w-10 animate-spin text-white" /></div> : null}
      {memberPanel ? (
        <div className="fixed inset-0 z-90 flex justify-end bg-black/45"><div className="h-full w-full max-w-2xl overflow-y-auto bg-[#fffcf5] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-2xl font-black text-[#3d200a]">{memberPanel.organization.name}</h3><p className="text-sm text-[#8a5d33]">Membership control</p></div><button onClick={() => setMemberPanel(null)} className="rounded-lg p-2 hover:bg-white"><X className="h-5 w-5" /></button></div><div className="my-6 rounded-xl border border-amber-500/20 bg-white p-4"><h4 className="font-bold text-[#3d200a]">Add existing account</h4><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto]"><select value={addUserId} onChange={(event) => setAddUserId(event.target.value)} className="rounded-lg border border-amber-500/25 px-3 py-2"><option value="">Select account</option>{availableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} — {user.email}</option>)}</select><select value={addRole} onChange={(event) => setAddRole(event.target.value)} className="rounded-lg border border-amber-500/25 px-3 py-2">{roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button onClick={addMember} disabled={!addUserId || busy} className="rounded-lg bg-[#8B0000] px-4 py-2 font-bold text-white disabled:opacity-50">Add</button></div></div><div className="space-y-3">{memberPanel.members.map((member) => { const protectedMember = member.roleId.toLowerCase() === "owner" || users.find((user) => user.id === member.userId)?.superAdmin; return <div key={member.id} className="rounded-xl border border-amber-500/20 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-[#3d200a]">{member.userName}</p><p className="text-sm text-[#8a5d33]">{member.userEmail}</p></div><div className="flex gap-2"><select defaultValue={member.roleId} disabled={Boolean(protectedMember) || busy} onChange={(event) => updateMember(member, event.target.value)} className="rounded-lg border border-amber-500/25 px-3 py-2 text-sm disabled:bg-slate-100"><option value={member.roleId}>{member.roleName}</option>{roleOptions.filter((role) => role.id !== member.roleId).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button disabled={Boolean(protectedMember) || busy} onClick={() => removeMember(member)} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div></div></div>; })}</div><div className="mt-6 flex gap-2"><Link href={`/app/${memberPanel.organization.slug}/team`} className="rounded-lg bg-[#3d200a] px-4 py-2 font-bold text-white">Open team workspace</Link><Link href={`/app/${memberPanel.organization.slug}/roles`} className="rounded-lg border border-amber-500/25 bg-white px-4 py-2 font-bold text-[#6f4827]">Edit permissions</Link></div></div></div>
      ) : null}
    </div>
  );
}
