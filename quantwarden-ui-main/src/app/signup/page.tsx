"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "@/lib/auth-client";
import { Loader2, Shield, LogOut, LayoutDashboard, Mail, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import OtpInput from "@/components/ui/otp-input";

type InviteSignupDetails = {
  inviteId: string;
  email: string;
  organizationName: string;
  roleName: string;
  hasAccount: boolean;
  callbackUrl: string;
};

type AuthMethods = { email: boolean; username: boolean; usernameDomain: string };

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl");
  const inviteId = useMemo(() => {
    const directInviteId = searchParams.get("inviteId");
    if (directInviteId) return directInviteId;

    const match = rawCallbackUrl?.match(/^\/app\/invites\/([^/?]+)/);
    return match?.[1] || null;
  }, [rawCallbackUrl, searchParams]);
  const inviteCallbackUrl = useMemo(() => {
    if (inviteId) return `/app/invites/${inviteId}`;

    const match = rawCallbackUrl?.match(/^\/app\/invites\/([^/?]+)/);
    return match ? rawCallbackUrl : null;
  }, [inviteId, rawCallbackUrl]);
  const callbackUrl = inviteCallbackUrl || rawCallbackUrl || "/app";
  const { data: sessionData, isPending: sessionLoading } = useSession();
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [mode, setMode] = useState<"email" | "username">("username");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [otpScreen, setOtpScreen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [inviteDetails, setInviteDetails] = useState<InviteSignupDetails | null>(null);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteId));

  // Username + password signup
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loadingGuest, setLoadingGuest] = useState(false);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const emailError = emailTouched && email.length > 0 && !isValidEmail(email);
  const nameError = nameTouched && name.trim().length === 0;
  const isInviteSignup = Boolean(inviteId);

  // A username invitation carries a synthetic email ending with @<usernameDomain>.
  const inviteIsGuest = Boolean(
    inviteDetails && methods && inviteDetails.email.toLowerCase().endsWith(`@${methods.usernameDomain}`)
  );
  const inviteGuestUsername = inviteIsGuest ? inviteDetails!.email.split("@")[0] : "";

  // Which signup flow to show for a NON-invite signup.
  const effectiveMode: "email" | "username" = !methods?.username
    ? "email"
    : !methods?.email
      ? "username"
      : mode;

  useEffect(() => {
    fetch("/api/auth/methods")
      .then((r) => r.json())
      .then((m: AuthMethods) => {
        setMethods(m);
        if (!m.username && m.email) setMode("email");
      })
      .catch(() => setMethods({ email: false, username: true, usernameDomain: "guest.local" }));
  }, []);

  useEffect(() => {
    if (!inviteId) {
      setInviteDetails(null);
      setInviteLoading(false);
      return;
    }

    let cancelled = false;

    const loadInvite = async () => {
      setInviteLoading(true);
      setSubmitError("");

      try {
        const res = await fetch(`/api/orgs/invite/${inviteId}/signup`, { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          if (!cancelled) {
            setInviteDetails(null);
            setSubmitError(data.error || "Unable to load invitation details.");
          }
          return;
        }

        if (!cancelled) {
          setInviteDetails(data);
          setEmail(data.email);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setInviteDetails(null);
          setSubmitError("Unable to load invitation details.");
        }
      } finally {
        if (!cancelled) {
          setInviteLoading(false);
        }
      }
    };

    loadInvite();

    return () => {
      cancelled = true;
    };
  }, [inviteId]);

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (isInviteSignup) {
      if (!inviteId || !name.trim()) return;

      setSubmitError("");
      setLoadingMagic(true);

      try {
        const res = await fetch("/api/auth/complete-invite-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviteId,
            name: name.trim(),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSubmitError(data.error || "Unable to complete your invitation.");
          return;
        }

        setOtpScreen(true);
      } catch (error) {
        console.error(error);
        setSubmitError("Something went wrong. Please try again.");
      } finally {
        setLoadingMagic(false);
      }

      return;
    }

    if (!isValidEmail(normalizedEmail) || !name.trim()) return;

    setEmail(normalizedEmail);
    setSubmitError("");
    setLoadingMagic(true);
    try {
      const { error } = await signIn.magicLink({
        email: normalizedEmail,
        name: name.trim(),
        callbackURL: callbackUrl,
      });
      if (error) {
        setSubmitError(error.message || "Unable to send a verification code.");
        return;
      }
      setOtpScreen(true);
    } catch (error) {
      console.error(error);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setLoadingMagic(false);
    }
  };

  const handleGuestSignup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const uname = (inviteIsGuest ? inviteGuestUsername : username).trim().toLowerCase();
    if (!name.trim() || !uname || !password) return;

    setSubmitError("");
    setLoadingGuest(true);
    try {
      const res = await fetch("/api/auth/guest/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          username: uname,
          password,
          inviteId: inviteId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Unable to create your account.");
        return;
      }

      window.location.href = data.redirectTo || callbackUrl;
    } catch (error) {
      console.error(error);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setLoadingGuest(false);
    }
  };

  const handleResend = async () => {
    const { error } = await signIn.magicLink({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      callbackURL: callbackUrl,
    });
    if (error) {
      throw new Error(error.message || "Unable to resend the verification code.");
    }
  };

  const handleOtpVerified = (verifyUrl: string) => {
    window.location.href = verifyUrl;
  };

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.refresh();
        }
      }
    });
  };

  const nameField = (
    <div className="space-y-1.5">
      <label htmlFor="name" className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider px-1">
        Full Name <span className="text-red-600">*</span>
      </label>
      <input
        id="name"
        type="text"
        required
        value={name}
        onChange={e => {
          setName(e.target.value);
          setSubmitError("");
          if (!nameTouched) setNameTouched(true);
        }}
        onBlur={() => setNameTouched(true)}
        placeholder="Your Display Name"
        className={`w-full bg-white border rounded-xl px-4 py-3.5 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm ${
          nameError ? "border-red-400 focus:ring-red-400/50" : "border-amber-500/30 focus:ring-[#8B0000]/50"
        }`}
      />
      {nameError && (
        <p className="text-xs text-red-600 font-medium px-1 mt-1">Display name is required.</p>
      )}
    </div>
  );

  // Username signup form (also used for completing a username invitation).
  const guestForm = (
    <form onSubmit={handleGuestSignup} className="space-y-5">
      {nameField}

      <div className="space-y-1.5">
        <label htmlFor="username" className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider px-1">
          Username <span className="text-red-600">*</span>
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={inviteIsGuest ? inviteGuestUsername : username}
          disabled={inviteIsGuest}
          onChange={e => { setUsername(e.target.value); setSubmitError(""); }}
          placeholder="pick-a-username"
          className={`w-full bg-white border rounded-xl px-4 py-3.5 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/50 focus:border-transparent transition-all shadow-sm border-amber-500/30 ${
            inviteIsGuest ? "bg-[#fdf8f0] text-[#8a5d33] cursor-not-allowed" : ""
          }`}
        />
        <p className="text-xs text-[#8a5d33] font-medium px-1 mt-1">
          {inviteIsGuest
            ? "Your username is fixed by the invitation."
            : "Letters, numbers and . _ - only. No email required."}
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider px-1">
          Password <span className="text-red-600">*</span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => { setPassword(e.target.value); setSubmitError(""); }}
          placeholder="At least 8 characters"
          className="w-full bg-white border border-amber-500/30 rounded-xl px-4 py-3.5 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/50 focus:border-transparent transition-all shadow-sm"
        />
      </div>

      {submitError && (
        <p className="text-xs text-red-600 font-medium px-1 -mt-1">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={loadingGuest || !name.trim() || (!inviteIsGuest && !username) || password.length < 8}
        className="w-full flex items-center justify-center gap-2 bg-[#3d200a] text-white py-4 px-6 rounded-xl font-bold text-base hover:bg-[#2c1707] transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
      >
        {loadingGuest ? <Loader2 className="w-5 h-5 animate-spin" /> : (<><User className="w-5 h-5" /> {isInviteSignup ? "Join Organization" : "Create Account"}</>)}
      </button>
    </form>
  );

  // Email signup form (also used for completing an email invitation).
  const emailForm = (
    <form onSubmit={handleSendCode} className="space-y-5">
      {nameField}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider px-1">
          Email Address <span className="text-red-600">*</span>
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            setSubmitError("");
            if (!emailTouched) setEmailTouched(true);
          }}
          onBlur={() => setEmailTouched(true)}
          placeholder="you@example.com"
          disabled={isInviteSignup}
          className={`w-full bg-white border rounded-xl px-4 py-3.5 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm ${
            emailError ? "border-red-400 focus:ring-red-400/50" : "border-amber-500/30 focus:ring-[#8B0000]/50"
          } ${isInviteSignup ? "bg-[#fdf8f0] text-[#8a5d33] cursor-not-allowed" : ""}`}
        />
        {emailError && (
          <p className="text-xs text-red-600 font-medium px-1 mt-1">Please enter a valid email address.</p>
        )}
        {isInviteSignup && (
          <p className="text-xs text-[#8a5d33] font-medium px-1 mt-1">
            We will send a verification code to this invited address.
          </p>
        )}
      </div>

      {submitError && (
        <p className="text-xs text-red-600 font-medium px-1 -mt-1">{submitError}</p>
      )}

      {isInviteSignup && inviteDetails?.hasAccount && (
        <div className="rounded-xl border border-amber-500/20 bg-[#fdf8f0] p-4">
          <p className="text-sm text-[#8a5d33]">
            This email already has an account. Sign in to continue with your invitation.
          </p>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(inviteDetails.callbackUrl)}&email=${encodeURIComponent(inviteDetails.email)}`}
            className="mt-3 inline-flex font-bold text-[#8B0000] hover:underline"
          >
            Go to Sign In
          </Link>
        </div>
      )}

      <button
        type="submit"
        disabled={
          loadingMagic ||
          !name.trim() ||
          (isInviteSignup
            ? Boolean(inviteDetails?.hasAccount || !inviteDetails?.email)
            : !email || emailError)
        }
        className="w-full flex items-center justify-center bg-[#8B0000] text-white py-4 px-6 rounded-xl font-bold text-base hover:bg-[#730000] transition-all hover:shadow-lg hover:shadow-[#8B0000]/20 active:scale-[0.98] disabled:opacity-50"
      >
        {loadingMagic
          ? <Loader2 className="w-5 h-5 animate-spin" />
          : isInviteSignup
            ? "Continue to Invitation"
            : "Send Verification Code"}
      </button>
    </form>
  );

  // Pick the form to render.
  let signupBody: React.ReactNode;
  if (isInviteSignup) {
    signupBody = inviteIsGuest ? guestForm : emailForm;
  } else {
    signupBody = (
      <>
        {methods?.email && methods?.username && (
          <div className="grid grid-cols-2 gap-2 mb-2 p-1 bg-[#fdf1df] rounded-xl border border-amber-500/20">
            <button
              type="button"
              onClick={() => { setMode("username"); setSubmitError(""); }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                effectiveMode === "username" ? "bg-white text-[#3d200a] shadow-sm" : "text-[#8a5d33]"
              }`}
            >
              <User className="w-4 h-4" /> Username
            </button>
            <button
              type="button"
              onClick={() => { setMode("email"); setSubmitError(""); }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                effectiveMode === "email" ? "bg-white text-[#8B0000] shadow-sm" : "text-[#8a5d33]"
              }`}
            >
              <Mail className="w-4 h-4" /> Email
            </button>
          </div>
        )}
        {effectiveMode === "username" ? guestForm : emailForm}
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fffcf5] text-slate-900 font-sans selection:bg-[#8B0000] selection:text-white">

      {/* Left Column - Branding */}
      <div className="hidden lg:flex lg:flex-1 relative bg-[#8B0000] overflow-hidden flex-col justify-between p-12">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 border border-white/30 rounded-xl flex items-center justify-center bg-white/10 backdrop-blur-sm">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-extrabold text-xl tracking-tight leading-none uppercase">QuantWarden</h1>
            <p className="text-white/70 text-sm">Quantum-Proof Scanner</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <h2 className="text-5xl lg:text-6xl font-black text-white mb-6 leading-[1.1] tracking-tight">
            Secure the Future of Internet.
          </h2>
          <p className="text-white/80 text-lg leading-relaxed font-medium">
            Join thousands of organizations proactively evaluating post-quantum cryptography resistance and CBOM generation.
          </p>
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative">
        <div className="w-full max-w-md mx-auto">
          {sessionLoading || inviteLoading || !methods ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-10 h-10 animate-spin text-[#8B0000]" />
            </div>
          ) : sessionData?.session ? (
            <div className="text-center bg-white border border-amber-500/30 p-10 rounded-2xl shadow-xl shadow-amber-500/5">
              <div className="w-16 h-16 bg-[#8B0000]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-[#8B0000]" />
              </div>
              <h2 className="text-2xl font-black text-[#3d200a] mb-2 tracking-tight">Active Session</h2>
              <p className="text-[#8a5d33] mb-4 font-medium">
                You are already logged in as <br/>
                <strong className="text-[#8B0000] text-lg block mt-1">{sessionData.user.name ?? sessionData.user.email}</strong>
              </p>

              {callbackUrl.includes("/invites/") && (
                <div className="mb-8 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
                  Proceed to view your organization invitation.
                </div>
              )}
              {(!callbackUrl || !callbackUrl.includes("/invites/")) && (
                <div className="mb-8" />
              )}
              <div className="space-y-3">
                <Link
                  href={callbackUrl}
                  className="w-full flex items-center justify-center gap-2 bg-[#8B0000] text-white py-3.5 px-6 rounded-xl font-bold shadow-md shadow-[#8B0000]/20 hover:-translate-y-0.5 hover:bg-[#730000] transition-all"
                >
                  <LayoutDashboard className="w-5 h-5" /> Open App
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 bg-[#fffcf5] border border-amber-500/40 text-[#8B0000] py-3.5 px-6 rounded-xl font-bold hover:bg-white hover:-translate-y-0.5 shadow-sm transition-all"
                >
                  <LogOut className="w-4 h-4" /> Log out to switch
                </button>
              </div>
            </div>
          ) : otpScreen ? (
            /* OTP Verification Screen */
            <OtpInput
              email={email}
              onVerified={handleOtpVerified}
              onBack={() => setOtpScreen(false)}
              onResend={handleResend}
            />
          ) : (
            <>
              <div className="mb-10">
                <h2 className="text-3xl font-extrabold text-[#3d200a] mb-2">
                  {isInviteSignup ? "Complete Your Invitation" : "Create an Account"}
                </h2>
                <p className="text-[#8a5d33] text-sm">
                  {isInviteSignup && inviteDetails
                    ? `You were invited to join ${inviteDetails.organizationName} as ${inviteDetails.roleName}.`
                    : "Register your enterprise credentials to get started."}
                </p>
              </div>

              <div className="space-y-6">
                {signupBody}
              </div>

              {!isInviteSignup && (
                <p className="mt-8 text-sm text-[#8a5d33] text-center w-full">
                  Already have an account?{' '}
                  <Link href="/login" className="font-bold text-[#8B0000] hover:underline">
                    Sign In
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#fffcf5]">
        <Loader2 className="w-10 h-10 animate-spin text-[#8B0000]" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
