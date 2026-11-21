"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Store,
  Truck,
  User,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useStore } from "@/components/StoreProvider";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { BRAND_CONTACT } from "@/lib/brand";

type SignupRole = "CUSTOMER" | "DEALER" | "DISTRIBUTOR";

const ROLES: Array<{
  id: SignupRole;
  label: string;
  subtitle: string;
  approvalNote: string;
  immediateAccess: boolean;
  icon: typeof User;
}> = [
  {
    id: "CUSTOMER",
    label: "Buyer",
    subtitle: "Homeowner / Direct",
    approvalNote: "Instant account activation for retail orders, saved addresses, and BOQ quotes.",
    immediateAccess: true,
    icon: User,
  },
  {
    id: "DEALER",
    label: "Dealer",
    subtitle: "Hardware Shop / Contractor",
    approvalNote:
      "Trade accounts require administrator approval before sign-in. Dealer pricing unlocks only after approval.",
    immediateAccess: false,
    icon: Store,
  },
  {
    id: "DISTRIBUTOR",
    label: "Distributor",
    subtitle: "Regional Wholesale Stock",
    approvalNote:
      "Trade accounts require administrator approval & territory assignment before sign-in or House of Ajantha stock POs.",
    immediateAccess: false,
    icon: Truck,
  },
];

function parseRole(param: string | null): SignupRole {
  const upper = (param || "").toUpperCase();
  if (upper === "DEALER" || upper === "DISTRIBUTOR") return upper;
  return "CUSTOMER";
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshAuthAndCatalog, showToast } = useStore();

  const [role, setRole] = useState<SignupRole>(() =>
    parseRole(searchParams.get("role") || searchParams.get("type"))
  );
  const [showOptionalBusiness, setShowOptionalBusiness] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingSuccess, setPendingSuccess] = useState<{ role: string; message: string } | null>(
    null
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    organization: "",
    gstin: "",
    businessCity: "Trichy",
    preferredPins: "",
    website_hp: "",
  });

  const isTrade = role === "DEALER" || role === "DISTRIBUTOR";
  const activeRole = ROLES.find((r) => r.id === role) || ROLES[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.name.trim() || !form.email.trim()) {
      setErrorMsg("Please enter your full name and email address.");
      return;
    }
    if (form.password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }
    if (isTrade && (!form.organization.trim() || !form.phone.trim())) {
      setErrorMsg("Company / Shop name and mobile number are required for trade applications.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          role,
          organization: form.organization.trim(),
          gstin: form.gstin.trim().toUpperCase() || undefined,
          businessCity: form.businessCity.trim() || "Trichy",
          preferredPins: form.preferredPins.trim() || undefined,
          website_hp: form.website_hp,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data.error || "Unable to complete registration. Please check your details.");
        return;
      }

      if (data.pendingApproval) {
        setPendingSuccess({
          role: data.role || role,
          message:
            data.message ||
            "Your trade account application has been submitted and is awaiting admin approval.",
        });
        showToast("Trade application submitted for review.");
        return;
      }

      await refreshAuthAndCatalog();
      showToast("Account created! Welcome to Sai Ajantha.");
      router.push("/account");
    } catch {
      setErrorMsg("Network error while creating your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StorefrontSurface family="auth">
      <div className="min-h-screen flex flex-col bg-[#F5F7FA]">
        <header className="bg-white border-b border-[#DCE5EE]">
          <div className="sa-content-width h-16 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Sai Ajantha Interior Solutions Home">
              <BrandLogo size="sm" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="min-h-[38px] inline-flex items-center rounded-lg px-3 text-xs font-semibold text-[#076864] hover:bg-[#E9F6F5] transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/"
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-[#C5D3E0] bg-white px-3 text-xs font-semibold text-[#0B1F35] hover:border-[#076864]"
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
              {/* Left Guidance Column */}
              <div className="lg:col-span-5 bg-gradient-to-br from-[#091A2E] via-[#102D4D] to-[#134263] text-white p-7 sm:p-9 flex flex-col justify-between gap-8">
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#58DDE2]">
                    Account Onboarding
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
                    Choose the right account for your projects.
                  </h1>
                  <p className="text-xs sm:text-sm text-[#C4D5E5] leading-relaxed">
                    Whether you are renovating a home, managing a hardware retail counter, or
                    operating a regional stockist warehouse, we route your pricing and ordering
                    cleanly.
                  </p>

                  <div className="pt-2 space-y-2.5 text-xs">
                    {ROLES.map((r) => (
                      <div
                        key={r.id}
                        className={`rounded-xl border p-3.5 transition-colors ${
                          role === r.id
                            ? "border-[#58DDE2]/50 bg-white/10"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">
                            {r.label} · {r.subtitle}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7EE2E6]">
                            {r.immediateAccess ? "Instant" : "Admin Review"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#C4D5E5] leading-relaxed">
                          {r.approvalNote}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-[#B7CADE]">
                  <span>Questions on dealership?</span>
                  <Link
                    href="/contact"
                    className="font-semibold text-[#58DDE2] hover:underline inline-flex items-center gap-1"
                  >
                    Talk to Trade Desk
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Right Form Column */}
              <div className="lg:col-span-7 p-6 sm:p-9 lg:p-10">
                {pendingSuccess ? (
                  <div className="py-8 space-y-5">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-[#FEF7E6] border border-[#F4D38B] text-[#92400E]">
                      <Clock className="size-6" />
                    </div>
                    <div className="space-y-2">
                      <p className="sa-group-label">Application Received</p>
                      <h2 className="font-display text-2xl font-bold text-[#0B1F35]">
                        Your {pendingSuccess.role} Account Is Pending Approval
                      </h2>
                      <p className="text-sm text-[#526477] leading-relaxed">
                        {pendingSuccess.message}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#DCE5EE] bg-[#F8FAFC] p-4 text-xs text-[#3D4F63] space-y-1.5">
                      <p className="font-bold text-[#0B1F35]">What happens next?</p>
                      <p>
                        Our Trichy verification team checks your business details and territory
                        alignment. Wholesale pricing and trade portal access unlock only after admin
                        approval.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Link
                        href="/products"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0B1F35] px-5 text-xs font-semibold text-white hover:bg-[#076864]"
                      >
                        Browse Public Catalogue
                        <ArrowRight className="size-4" />
                      </Link>
                      <Link
                        href="/login"
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-[#C5D3E0] bg-white px-5 text-xs font-semibold text-[#0B1F35] hover:border-[#076864]"
                      >
                        Go to Sign In
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <h2 className="font-display text-2xl font-bold text-[#0B1F35]">
                        Create Your Account
                      </h2>
                      <p className="text-xs sm:text-sm text-[#5D6F82]">
                        Select your account type below to configure the right onboarding form.
                      </p>
                    </div>

                    {/* Account Type Selector */}
                    <div
                      role="radiogroup"
                      aria-label="Account Type"
                      className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                    >
                      {ROLES.map((item) => {
                        const active = role === item.id;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                              setRole(item.id);
                              setErrorMsg(null);
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
                            <p className="text-[11px] text-[#5D6F82]">{item.subtitle}</p>
                          </button>
                        );
                      })}
                    </div>

                    {isTrade && (
                      <div className="mt-4 rounded-xl border border-[#F3D18E] bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#78350F]">
                        <strong>Admin Approval Required:</strong> {activeRole.approvalNote}
                      </div>
                    )}

                    {errorMsg && (
                      <div
                        role="alert"
                        className="mt-4 rounded-xl border border-[#F5B8B8] bg-[#FEF2F2] p-3.5 flex items-start gap-2 text-xs text-[#991B1B]"
                      >
                        <AlertCircle className="size-4 shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
                      {/* Honeypot field */}
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.website_hp}
                        onChange={(e) => setForm({ ...form, website_hp: e.target.value })}
                        className="hidden"
                        aria-hidden="true"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label htmlFor="reg-name" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Full Name *
                          </label>
                          <input
                            id="reg-name"
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Ramesh Kumar"
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="reg-phone" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Mobile Number {isTrade ? "*" : "(Recommended)"}
                          </label>
                          <input
                            id="reg-phone"
                            type="tel"
                            required={isTrade}
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="10-digit mobile number"
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm text-[#0B1F35]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label htmlFor="reg-email" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Email Address *
                          </label>
                          <input
                            id="reg-email"
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="name@company.com"
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="reg-city" className="block text-xs font-semibold text-[#354B62] mb-1">
                            City / District *
                          </label>
                          <input
                            id="reg-city"
                            type="text"
                            required
                            value={form.businessCity}
                            onChange={(e) => setForm({ ...form, businessCity: e.target.value })}
                            placeholder="e.g. Trichy, Madurai"
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm text-[#0B1F35]"
                          />
                        </div>
                      </div>

                      {/* Progressive disclosure: always shown for Trade roles, optional toggle for Buyer */}
                      {!isTrade && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowOptionalBusiness((v) => !v)}
                            className="text-xs font-semibold text-[#076864] hover:underline cursor-pointer"
                          >
                            {showOptionalBusiness
                              ? "− Hide optional company / GSTIN details"
                              : "+ Add optional company name or GSTIN for invoicing"}
                          </button>
                        </div>
                      )}

                      {(isTrade || showOptionalBusiness) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-xl border border-[#E4ECF3] bg-[#F9FBFD] p-3.5">
                          <div>
                            <label htmlFor="reg-org" className="block text-xs font-semibold text-[#354B62] mb-1">
                              Company / Shop Name {isTrade ? "*" : "(Optional)"}
                            </label>
                            <input
                              id="reg-org"
                              type="text"
                              required={isTrade}
                              value={form.organization}
                              onChange={(e) => setForm({ ...form, organization: e.target.value })}
                              placeholder="Firm or shop name"
                              className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35]"
                            />
                          </div>
                          <div>
                            <label htmlFor="reg-gst" className="block text-xs font-semibold text-[#354B62] mb-1">
                              GSTIN {role === "DISTRIBUTOR" ? "(Recommended)" : "(Optional)"}
                            </label>
                            <input
                              id="reg-gst"
                              type="text"
                              value={form.gstin}
                              onChange={(e) =>
                                setForm({ ...form, gstin: e.target.value.toUpperCase() })
                              }
                              placeholder="33XXXXX0000X1Z5"
                              className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm font-mono text-[#0B1F35]"
                            />
                          </div>
                          {isTrade && (
                            <div className="sm:col-span-2">
                              <label htmlFor="reg-pins" className="block text-xs font-semibold text-[#354B62] mb-1">
                                Operating / Preferred PIN Codes (Optional)
                              </label>
                              <input
                                id="reg-pins"
                                type="text"
                                value={form.preferredPins}
                                onChange={(e) =>
                                  setForm({ ...form, preferredPins: e.target.value })
                                }
                                placeholder="e.g. 620001, 620002, 620018"
                                className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35]"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <label htmlFor="reg-pass" className="block text-xs font-semibold text-[#354B62] mb-1">
                          Account Password *
                        </label>
                        <div className="relative">
                          <input
                            id="reg-pass"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            required
                            minLength={8}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="Minimum 8 characters"
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white pl-3.5 pr-11 text-sm text-[#0B1F35]"
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

                      <p className="text-[11px] text-[#5D6F82]">
                        By creating an account, you agree to our{" "}
                        <Link href="/terms" className="font-semibold text-[#076864] underline">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy-policy" className="font-semibold text-[#076864] underline">
                          Privacy Policy
                        </Link>
                        .
                      </p>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#076864] px-5 text-sm font-semibold text-white hover:bg-[#05524F] disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {submitting
                          ? "Submitting..."
                          : isTrade
                            ? `Submit ${activeRole.label} Application`
                            : "Create Buyer Account"}
                        <ArrowRight className="size-4" />
                      </button>
                    </form>

                    <div className="mt-5 pt-4 border-t border-[#E7EEF4] flex items-center justify-between text-xs text-[#5D6F82]">
                      <span>Already registered?</span>
                      <Link href="/login" className="font-bold text-[#076864] hover:underline">
                        Sign In →
                      </Link>
                    </div>
                  </>
                )}
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F7FA]" />}>
      <RegisterContent />
    </Suspense>
  );
}
