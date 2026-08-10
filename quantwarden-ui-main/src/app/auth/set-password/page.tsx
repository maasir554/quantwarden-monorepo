"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, LockKeyhole, Shield } from "lucide-react";
import { useSession } from "@/lib/auth-client";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: sessionData, isPending: sessionLoading } = useSession();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusLoading, setStatusLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const callbackUrl = useMemo(() => {
    const requested = searchParams.get("callbackUrl") || "/app";
    return requested.startsWith("/") && !requested.startsWith("//") ? requested : "/app";
  }, [searchParams]);

  useEffect(() => {
    if (!sessionLoading && !sessionData?.session) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    if (!sessionData?.session) return;

    fetch("/api/user/password", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load password status.");
        if (data.hasPassword) router.replace(callbackUrl);
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setStatusLoading(false));
  }, [callbackUrl, router, sessionData?.session, sessionLoading]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not set password.");
      router.replace(callbackUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not set password.");
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading || statusLoading) {
    return <Loader2 className="h-9 w-9 animate-spin text-[#8B0000]" />;
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-amber-500/25 bg-white p-7 shadow-2xl shadow-[#8B0000]/10">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8B0000]/10">
        <LockKeyhole className="h-6 w-6 text-[#8B0000]" />
      </div>
      <h1 className="text-2xl font-black tracking-tight text-[#3d200a]">Add a password?</h1>
      <p className="mt-2 text-sm leading-6 text-[#8a5d33]">
        Your email is verified. A password is optional—you can always continue using email codes.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#8a5d33]">Password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => { setNewPassword(event.target.value); setError(""); }}
            className="w-full rounded-xl border border-amber-500/30 bg-white px-4 py-3 text-[#3d200a] outline-none focus:ring-2 focus:ring-[#8B0000]/35"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#8a5d33]">Retype password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }}
            className="w-full rounded-xl border border-amber-500/30 bg-white px-4 py-3 text-[#3d200a] outline-none focus:ring-2 focus:ring-[#8B0000]/35"
            placeholder="Enter the same password again"
          />
        </div>

        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={saving || newPassword.length < 8 || confirmPassword.length < 8}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B0000] px-4 py-3 font-bold text-white hover:bg-[#730000] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Set password and continue
        </button>
        <button
          type="button"
          onClick={() => router.replace(callbackUrl)}
          disabled={saving}
          className="w-full rounded-xl px-4 py-2.5 font-semibold text-[#8a5d33] hover:bg-[#fdf1df] disabled:opacity-50"
        >
          Skip for now
        </button>
      </form>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fffcf5] p-6">
      <div className="absolute inset-x-0 top-0 h-2 bg-[#8B0000]" />
      <div className="absolute left-8 top-8 flex items-center gap-2 text-[#8B0000]">
        <Shield className="h-6 w-6" />
        <span className="font-black uppercase tracking-tight">QuantWarden</span>
      </div>
      <Suspense fallback={<Loader2 className="h-9 w-9 animate-spin text-[#8B0000]" />}>
        <SetPasswordForm />
      </Suspense>
    </main>
  );
}
