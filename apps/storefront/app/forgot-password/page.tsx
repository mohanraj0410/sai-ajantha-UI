"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { BRAND_CONTACT } from "@/lib/brand";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid registered email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Unable to initiate password reset right now.");
        return;
      }
      setSubmitted(true);
    } catch {
      setErrorMsg("Network error while requesting password reset. Please try again.");
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
              {submitted ? (
                <div className="space-y-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[#E6F6F2] text-[#065F46]">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <h1 className="font-display text-2xl font-bold text-[#0B1F35]">
                    Check Your Inbox
                  </h1>
                  <p className="text-sm text-[#526477] leading-relaxed">
                    If an account exists for <strong>{email}</strong>, password recovery
                    instructions have been sent. You can also contact our Trichy desk at{" "}
                    <a
                      href={BRAND_CONTACT.phoneHref}
                      className="font-semibold text-[#076864] underline"
                    >
                      {BRAND_CONTACT.phone}
                    </a>{" "}
                    for assistance.
                  </p>
                  <Link
                    href="/login"
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1F35] text-sm font-semibold text-white hover:bg-[#076864]"
                  >
                    Return to Sign In
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <p className="sa-group-label">Account Recovery</p>
                    <h1 className="font-display text-2xl font-bold text-[#0B1F35]">
                      Forgot Your Password?
                    </h1>
                    <p className="text-xs sm:text-sm text-[#5D6F82]">
                      Enter your registered email address and we will send you a secure reset link.
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
                      <label htmlFor="fp-email" className="block text-xs font-semibold text-[#354B62] mb-1.5">
                        Registered Email Address *
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#7B8FA3]" />
                        <input
                          id="fp-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="w-full min-h-[46px] rounded-xl border border-[#C5D3E0] bg-white pl-10 pr-3.5 text-sm text-[#0B1F35]"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#076864] text-sm font-semibold text-white hover:bg-[#05524F] disabled:opacity-60 cursor-pointer"
                    >
                      {submitting ? "Sending Reset Link..." : "Send Recovery Link"}
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
