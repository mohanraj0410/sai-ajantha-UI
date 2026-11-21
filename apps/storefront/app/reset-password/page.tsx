"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!token) {
      setErrorMsg("Reset token is missing or invalid. Please request a fresh recovery link.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("New password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email: emailParam, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "Unable to update password. The link may have expired.");
        return;
      }
      setDone(true);
    } catch {
      setErrorMsg("Network error while resetting password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StorefrontSurface family="auth">
      <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
        <header className="bg-white border-b border-[#DCE5EE]">
          <div className="sa-content-width h-16 flex items-center justify-between gap-4">
            <Link href="/" aria-label="Sai Ajantha Interior Solutions Home">
              <BrandLogo size="sm" />
            </Link>
            <Link
              href="/login"
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-[#C5D3E0] bg-white px-3 text-xs font-semibold text-[#0B1F35] hover:border-[#076864]"
            >
              <ArrowLeft className="size-3.5" />
              Back to Sign In
            </Link>
          </div>
        </header>

        <main id="main-content" className="flex-1 flex items-center py-12">
          <div className="sa-content-width">
            <div className="max-w-md mx-auto sa-card p-7 sm:p-9 space-y-6">
              {done ? (
                <div className="space-y-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[#E6F6F2] text-[#065F46]">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <h1 className="font-display text-2xl font-bold text-[#0B1F35]">
                    Password Updated
                  </h1>
                  <p className="text-sm text-[#526477]">
                    Your password has been updated. You can now sign in with your new credentials.
                  </p>
                  <Link
                    href="/login"
                    className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#076864] text-sm font-semibold text-white hover:bg-[#05524F]"
                  >
                    Sign In Now
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <p className="sa-group-label">Security Update</p>
                    <h1 className="font-display text-2xl font-bold text-[#0B1F35]">
                      Set a New Password
                    </h1>
                    <p className="text-xs sm:text-sm text-[#5D6F82]">
                      Choose a strong password with at least 8 characters.
                    </p>
                  </div>

                  {errorMsg && (
                    <div
                      role="alert"
                      className="rounded-xl border border-[#F5B8B8] bg-[#FEF2F2] p-3.5 flex items-start gap-2 text-xs text-[#991B1B]"
                    >
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div>
                      <label htmlFor="rp-new" className="block text-xs font-semibold text-[#354B62] mb-1.5">
                        New Password *
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#7B8FA3]" />
                        <input
                          id="rp-new"
                          type={showPass ? "text" : "password"}
                          required
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          className="w-full min-h-[46px] rounded-xl border border-[#C5D3E0] bg-white pl-10 pr-11 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass((v) => !v)}
                          aria-label={showPass ? "Hide password" : "Show password"}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-lg text-[#64748B] cursor-pointer"
                        >
                          {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="rp-confirm" className="block text-xs font-semibold text-[#354B62] mb-1.5">
                        Confirm New Password *
                      </label>
                      <input
                        id="rp-confirm"
                        type={showPass ? "text" : "password"}
                        required
                        minLength={8}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full min-h-[46px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#076864] text-sm font-semibold text-white hover:bg-[#05524F] disabled:opacity-60 cursor-pointer"
                    >
                      {submitting ? "Updating Password..." : "Update Password"}
                      <ArrowRight className="size-4" />
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </StorefrontSurface>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F7FA]" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
