"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Store,
  Truck,
  User,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useStore } from "@/components/StoreProvider";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { BRAND_CONTACT } from "@/lib/brand";

type PortalPersona = "CUSTOMER" | "DEALER" | "DISTRIBUTOR";

const PERSONAS: Array<{
  id: PortalPersona;
  label: string;
  tag: string;
  summary: string;
  redirect: string;
  icon: typeof User;
}> = [
  {
    id: "CUSTOMER",
    label: "Buyer",
    tag: "Homeowner / Direct",
    summary: "Track direct orders, manage saved delivery addresses, and view BOQ quotes.",
    redirect: "/account",
    icon: User,
  },
  {
    id: "DEALER",
    label: "Dealer",
    tag: "Trade Account",
    summary: "Access approved wholesale pricing, guided RFQ builder, and trade orders.",
    redirect: "/dealer",
    icon: Store,
  },
  {
    id: "DISTRIBUTOR",
    label: "Distributor",
    tag: "Wholesale Stock",
    summary: "Manage House of Ajantha Buy Stock POs, warehouse stock, and territory routing.",
    redirect: "/distributor",
    icon: Truck,
  },
];

function parseInitialRole(param: string | null): PortalPersona {
  const upper = (param || "").toUpperCase();
  if (upper === "DEALER" || upper === "DISTRIBUTOR") return upper;
  return "CUSTOMER";
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshAuthAndCatalog, showToast } = useStore();

  const [persona, setPersona] = useState<PortalPersona>(() =>
    parseInitialRole(searchParams.get("role"))
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorState, setErrorState] = useState<{
    title: string;
    message: string;
    tone: "error" | "warning";
  } | null>(null);

  const activePersona = PERSONAS.find((p) => p.id === persona) || PERSONAS[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorState(null);

    if (!email.trim() || !password) {
      setErrorState({
        title: "Missing Credentials",
        message: "Please enter both your registered email address and password.",
        tone: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          portalRole: persona,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const isPending = data.code === "ACCOUNT_PENDING_APPROVAL";
        setErrorState({
          title: data.title || (isPending ? "Account Approval Pending" : "Unable to Sign In"),
          message:
            data.error || "Invalid email or password. Please check your credentials and try again.",
          tone: isPending ? "warning" : "error",
        });
        return;
      }

      await refreshAuthAndCatalog();
      showToast(`Signed in as ${data.user?.name || "member"}.`);

      const nextParam = searchParams.get("next");
      if (nextParam && nextParam.startsWith("/")) {
        router.push(nextParam);
        return;
      }
      const role = (data.user?.role || persona).toUpperCase();
      if (role === "DISTRIBUTOR") router.push("/distributor");
      else if (role === "DEALER") router.push("/dealer");
      else if (role === "ADMIN") router.push("/admin");
      else router.push("/account");
    } catch {
      setErrorState({
        title: "Connection Error",
        message: "Could not reach the authentication server. Please try again in a moment.",
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StorefrontSurface family="auth">
      <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
        {/* Top Minimal Utility Bar */}
        <header className="bg-white border-b border-[#DCE5EE]">
          <div className="sa-content-width h-16 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Sai Ajantha Interior Solutions Home">
              <BrandLogo size="sm" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/register"
                className="min-h-[38px] inline-flex items-center rounded-lg px-3 text-xs font-semibold text-[#076864] hover:bg-[#E9F6F5] transition-colors"
              >
                Create Account
              </Link>
              <Link
                href="/"
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-[#C5D3E0] bg-white px-3 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                <span className="hidden sm:inline">Back to Storefront</span>
                <span className="sm:hidden">Home</span>
              </Link>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 flex items-center py-8 sm:py-12">
          <div className="sa-content-width">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 rounded-2xl overflow-hidden border border-[#DCE5EE] bg-white shadow-[0_14px_38px_-18px_rgba(11,31,53,0.16)]">
              {/* Left Architectural Brand Column */}
              <div className="lg:col-span-5 bg-gradient-to-br from-[#091A2E] via-[#102D4D] to-[#134263] text-white p-7 sm:p-9 flex flex-col justify-between gap-8">
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#58DDE2]">
                    Sai Ajantha · Est. {BRAND_CONTACT.foundedYear}
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
                    Architectural Hardware &amp; Trade Access
                  </h1>
                  <p className="text-xs sm:text-sm text-[#C4D5E5] leading-relaxed">
                    Sign in to your role-specific workspace to manage direct orders, approved trade
                    quotations, or regional House of Ajantha stock operations.
                  </p>

                  <div className="pt-2 space-y-2.5">
                    {[
                      {
                        icon: ShieldCheck,
                        title: "Role-Verified Pricing Privacy",
                        desc: "Customer, Dealer, and Distributor tiers stay strictly isolated server-side.",
                      },
                      {
                        icon: Building2,
                        title: "Unified Order & BOQ Records",
                        desc: "Saved delivery sites, printable proformas, and Trichy desk support.",
                      },
                    ].map((feat) => (
                      <div
                        key={feat.title}
                        className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-3.5"
                      >
                        <feat.icon className="size-4 text-[#58DDE2] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-white">{feat.title}</p>
                          <p className="mt-0.5 text-[11px] text-[#B7CADE] leading-relaxed">
                            {feat.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-[#B7CADE]">
                  <span>Need account assistance?</span>
                  <Link
                    href="/contact"
                    className="font-semibold text-[#58DDE2] hover:underline inline-flex items-center gap-1"
                  >
                    Contact Desk
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Right Interactive Sign-In Form */}
              <div className="lg:col-span-7 p-6 sm:p-9 lg:p-10">
                <div className="space-y-1.5">
                  <h2 className="font-display text-2xl font-bold text-[#0B1F35]">
                    Sign In to Your Account
                  </h2>
                  <p className="text-xs sm:text-sm text-[#5D6F82]">
                    Choose your account portal and enter your registered credentials.
                  </p>
                </div>

                {/* Role Selector */}
                <div className="mt-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#526477] mb-2">
                    Select Portal
                  </p>
                  <div
                    role="radiogroup"
                    aria-label="Account portal type"
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                  >
                    {PERSONAS.map((item) => {
                      const active = persona === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => {
                            setPersona(item.id);
                            setErrorState(null);
                          }}
                          className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                            active
                              ? "border-[#076864] bg-[#F0FAF9] ring-1 ring-[#076864]"
                              : "border-[#DCE5EE] bg-white hover:border-[#9EB4C8]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`flex size-8 items-center justify-center rounded-lg ${
                                active
                                  ? "bg-[#076864] text-white"
                                  : "bg-[#F1F5F9] text-[#475569]"
                              }`}
                            >
                              <Icon className="size-4" />
                            </span>
                            {active && <CheckCircle2 className="size-4 text-[#076864]" />}
                          </div>
                          <p className="mt-2 text-xs font-bold text-[#0B1F35]">{item.label}</p>
                          <p className="text-[11px] text-[#5D6F82]">{item.tag}</p>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2.5 text-xs text-[#526477]">{activePersona.summary}</p>
                </div>

                {errorState && (
                  <div
                    role="alert"
                    className={`mt-5 rounded-xl border p-3.5 flex items-start gap-2.5 text-xs ${
                      errorState.tone === "warning"
                        ? "border-[#F3D18E] bg-[#FFFBEB] text-[#78350F]"
                        : "border-[#F5B8B8] bg-[#FEF2F2] text-[#991B1B]"
                    }`}
                  >
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">{errorState.title}</p>
                      <p className="mt-0.5 leading-relaxed">{errorState.message}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold text-[#354B62] mb-1.5"
                    >
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#7B8FA3]" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full min-h-[46px] rounded-xl border border-[#C5D3E0] bg-white pl-10 pr-3.5 text-sm text-[#0B1F35] focus:border-[#076864]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="login-password"
                        className="text-xs font-semibold text-[#354B62]"
                      >
                        Password *
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-xs font-semibold text-[#076864] hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#7B8FA3]" />
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full min-h-[46px] rounded-xl border border-[#C5D3E0] bg-white pl-10 pr-11 text-sm text-[#0B1F35] focus:border-[#076864]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-lg text-[#64748B] hover:text-[#0B1F35] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#076864] px-5 text-sm font-semibold text-white hover:bg-[#05524F] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {submitting ? "Signing In..." : `Sign In as ${activePersona.label}`}
                    <ArrowRight className="size-4" />
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-[#E7EEF4] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#5D6F82]">
                  <span>New to Sai Ajantha?</span>
                  <Link
                    href={`/register?role=${persona}`}
                    className="font-bold text-[#076864] hover:underline"
                  >
                    Create a {activePersona.label} Account →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="py-5 text-center text-xs text-[#64748B] border-t border-[#DCE5EE] bg-white">
          © {BRAND_CONTACT.foundedYear}–{new Date().getFullYear()} {BRAND_CONTACT.companyName}. All
          rights reserved.
        </footer>
      </div>
    </StorefrontSurface>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F7FA]" />}>
      <LoginContent />
    </Suspense>
  );
}
