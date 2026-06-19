"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, ArrowLeft, RotateCw, ShieldCheck } from "lucide-react";

interface OtpInputProps {
  email: string;
  onVerified: (verifyUrl: string) => void;
  onBack: () => void;
  onResend: () => Promise<void>;
}

export default function OtpInput({ email, onVerified, onBack, onResend }: OtpInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(600); // 10 minutes
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleVerify = useCallback(async (code: string) => {
    setVerifying(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed.");
        setVerifying(false);
        // Clear OTP and refocus first input
        setOtp(Array(6).fill(""));
        setTimeout(() => inputsRef.current[0]?.focus(), 100);
        return;
      }

      // Redirect through the magic link verify URL (sets session cookies)
      onVerified(data.verifyUrl);
    } catch {
      setError("Network error. Please try again.");
      setVerifying(false);
    }
  }, [email, onVerified]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    setError("");
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullCode = newOtp.join("");
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    // Allow Enter to submit if all filled
    if (e.key === "Enter") {
      const fullCode = otp.join("");
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);

    // Focus the next empty input or the last one
    const nextIndex = Math.min(pasted.length, 5);
    inputsRef.current[nextIndex]?.focus();

    // Auto-submit if 6 digits pasted
    if (pasted.length === 6) {
      handleVerify(pasted);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      await onResend();
      setCountdown(600);
      setOtp(Array(6).fill(""));
      inputsRef.current[0]?.focus();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to resend the verification code.");
    } finally {
      setResending(false);
    }
  };

  const isExpired = countdown <= 0;

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-[#8a5d33] hover:text-[#8B0000] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Use a different email
      </button>

      {/* Header */}
      <div>
        <div className="w-14 h-14 bg-[#8B0000]/10 rounded-xl flex items-center justify-center mb-5">
          <ShieldCheck className="w-7 h-7 text-[#8B0000]" />
        </div>
        <h2 className="text-2xl font-extrabold text-[#3d200a] mb-2 tracking-tight">Check your inbox</h2>
        <p className="text-sm text-[#8a5d33] leading-relaxed">
          We sent a 6-digit verification code to{" "}
          <strong className="text-[#8B0000]">{email}</strong>
        </p>
      </div>

      {/* OTP Input Boxes */}
      <div>
        <label className="text-xs font-bold text-[#8a5d33] uppercase tracking-wider px-1 mb-3 block">
          Verification Code <span className="text-red-600">*</span>
        </label>
        <div className="flex gap-3 justify-center" onPaste={handlePaste}>
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => { inputsRef.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              disabled={verifying || isExpired}
              className={`w-13 h-14 text-center text-2xl font-black rounded-xl border-2 outline-none transition-all shadow-sm
                ${error
                  ? "border-red-400 bg-red-50/50 text-red-700 animate-[shake_0.3s_ease-in-out]"
                  : digit
                    ? "border-[#8B0000]/40 bg-[#fdf1df]/50 text-[#8B0000]"
                    : "border-amber-500/30 bg-white text-[#3d200a]"
                }
                focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/20
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-600 font-medium text-center mt-3">{error}</p>
        )}
      </div>

      {/* Timer + Resend */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-[#8a5d33]">
          {isExpired ? (
            <span className="text-red-600 font-medium">Code expired</span>
          ) : (
            <>Expires in <span className="font-bold text-[#3d200a]">{formatTime(countdown)}</span></>
          )}
        </div>
        <button
          onClick={handleResend}
          disabled={resending}
          className="flex items-center gap-1.5 text-xs font-bold text-[#8B0000] hover:text-[#730000] transition-colors disabled:opacity-50"
        >
          {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
          Resend code
        </button>
      </div>

      {/* Verify button (backup, auto-submits anyway) */}
      <button
        onClick={() => handleVerify(otp.join(""))}
        disabled={verifying || otp.join("").length < 6 || isExpired}
        className="w-full flex items-center justify-center bg-[#8B0000] text-white py-4 px-6 rounded-xl font-bold text-base hover:bg-[#730000] transition-all hover:shadow-lg hover:shadow-[#8B0000]/20 active:scale-[0.98] disabled:opacity-50"
      >
        {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Sign In"}
      </button>

      {/* Info */}
      <p className="text-xs text-[#8a5d33] text-center leading-relaxed">
        You can also click the <strong>magic link</strong> in the email to sign in directly.
      </p>
    </div>
  );
}
