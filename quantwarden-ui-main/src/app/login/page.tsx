"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "@/lib/auth-client";
import { Loader2, Shield, LogOut, LayoutDashboard, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import OtpInput from "@/components/ui/otp-input";

type AuthMethods = { email: boolean; guest: boolean };

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/app";
  const prefilledEmail = searchParams.get("email") || "";
  const { data: sessionData, isPending: sessionLoading } = useSession();
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [email, setEmail] = useState(prefilledEmail);
  const [emailTouched, setEmailTouched] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [otpScreen, setOtpScreen] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Guest (username + password) login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [guestError, setGuestError] = useState("");

  useEffect(() => {
    fetch("/api/auth/methods")
      .then((r) => r.json())
      .then((m: AuthMethods) => setMethods(m))
      .catch(() => setMethods({ email: true, guest: true }));
  }, []);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const emailError = emailTouched && email.length > 0 && !isValidEmail(email);

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) return;

    setSubmitError("");
    setEmail(normalizedEmail);
    setLoadingMagic(true);

    try {
      const res = await fetch("/api/auth/request-login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          callbackURL: callbackUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Unable to send a verification code.");
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

  const handleResend = async () => {
    const res = await fetch("/api/auth/request-login-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        callbackURL: callbackUrl,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Unable to resend the verification code.");
    }
  };

  const handleGuestLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const uname = username.trim().toLowerCase();
    if (!uname || !password) return;

    setGuestError("");
    setLoadingGuest(true);
    try {
      const { error } = await signIn.username({ username: uname, password });
      if (error) {
        setGuestError(error.message || "Invalid username or password.");
        return;
      }
      window.location.href = callbackUrl;
    } catch (err) {
      console.error(err);
      setGuestError("Something went wrong. Please try again.");
    } finally {
      setLoadingGuest(false);
    }
  };

  const handleOtpVerified = (verifyUrl: string) => {
    // Navigate to the magic link verify URL which sets the session
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
          <div className="inline-block px-3 py-1 mb-6 border border-white/30 rounded-full bg-white/10 backdrop-blur-sm">
            <span className="text-white text-xs font-bold uppercase tracking-wider">Enterprise Edition</span>
          </div>
          <h2 className="text-5xl lg:text-6xl font-black text-white mb-6 leading-[1.1] tracking-tight">
            Secure the Future of Internet.
          </h2>
          <p className="text-white/80 text-lg leading-relaxed font-medium">
            Proactively identify deprecated cryptography algorithms, measure transition readiness, and intuitively manage CertIn-compliant CBOMs.
          </p>
        </div>
      </div>

      {/* Right Column - Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative">
        <div className="w-full max-w-md mx-auto">
          {sessionLoading || !methods ? (
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
                <h2 className="text-3xl font-extrabold text-[#3d200a] mb-2">Welcome Back</h2>
                <p className="text-[#8a5d33] text-sm">Enter your credentials to access the scanner portal.</p>
              </div>

              <div className="space-y-6">
                {methods.email && (
                  <form onSubmit={handleSendCode} className="space-y-5">
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
                        className={`w-full bg-white border rounded-xl px-4 py-3.5 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm ${
                          emailError ? "border-red-400 focus:ring-red-400/50" : "border-amber-500/30 focus:ring-[#8B0000]/50"
                        }`}
                      />
                      {emailError && (
                        <p className="text-xs text-red-600 font-medium px-1 mt-1">Please enter a valid email address.</p>
                      )}
                      {!emailError && submitError && (
                        <p className="text-xs text-red-600 font-medium px-1 mt-1">{submitError}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loadingMagic || !email || emailError}
                      className="w-full flex items-center justify-center bg-[#8B0000] text-white py-4 px-6 rounded-xl font-bold text-base hover:bg-[#730000] transition-all hover:shadow-lg hover:shadow-[#8B0000]/20 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loadingMagic ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Verification Code"}
                    </button>
                  </form>
                )}

                {methods.email && methods.guest && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-amber-500/20"></span>
                    </div>
                    <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
                      <span className="bg-[#fffcf5] px-3 text-[#8a5d33]">Email not configured? Use a guest account</span>
                    </div>
                  </div>
                )}

                {methods.guest && (
                  <form onSubmit={handleGuestLogin} className="space-y-5">
                    <div className="space-y-1.5">
                      <label htmlFor="username" className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider px-1">
                        Guest Username <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={e => { setUsername(e.target.value); setGuestError(""); }}
                        placeholder="your-username"
                        className="w-full bg-white border border-amber-500/30 rounded-xl px-4 py-3.5 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/50 focus:border-transparent transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="password" className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider px-1">
                        Password <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setGuestError(""); }}
                        placeholder="••••••••"
                        className="w-full bg-white border border-amber-500/30 rounded-xl px-4 py-3.5 text-[#3d200a] placeholder:text-[#8a5d33]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/50 focus:border-transparent transition-all shadow-sm"
                      />
                      {guestError && (
                        <p className="text-xs text-red-600 font-medium px-1 mt-1">{guestError}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loadingGuest || !username || !password}
                      className="w-full flex items-center justify-center gap-2 bg-[#3d200a] text-white py-4 px-6 rounded-xl font-bold text-base hover:bg-[#2c1707] transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                    >
                      {loadingGuest ? <Loader2 className="w-5 h-5 animate-spin" /> : (<><User className="w-5 h-5" /> Continue as Guest</>)}
                    </button>
                  </form>
                )}
              </div>

              <p className="mt-8 text-sm text-[#8a5d33] text-center w-full">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-bold text-[#8B0000] hover:underline">
                  Register here
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#fffcf5]">
        <Loader2 className="w-10 h-10 animate-spin text-[#8B0000]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
