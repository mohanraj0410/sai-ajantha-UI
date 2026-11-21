"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Building,
  CheckCircle2,
  Clock,
  Compass,
  HardHat,
  Home,
  Info,
  Mail,
  MapPin,
  Package,
  Phone,
  User,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const CONTACT_ROLES = [
  "Select your role",
  "Homeowner / Property Owner",
  "Architect / Designer",
  "Builder / Project Head",
  "Interior Contractor / Fabricator",
  "Dealer / Trade Partner",
] as const;

// 4 Custom Icons for the Enquiry Purpose Buttons matching the reference exactly:
// 1. BOQ & Pricing: Document with lines / check
// 2. Sample Kit: 3D Isometric cube / open box
// 3. Site Consultation: Hard hat / site inspection
// 4. Dealer / Trade Desk: Two silhouettes / users
const ENQUIRY_PURPOSES = [
  {
    id: "boq",
    label: "BOQ & Pricing",
    icon: (props: any) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
    bannerText:
      "Get a detailed quotation, product recommendation and commercial details.",
  },
  {
    id: "samples",
    label: "Sample Kit",
    icon: (props: any) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    bannerText:
      "Request physical hardware samples, cut-section extrusions and finish swatches.",
  },
  {
    id: "site",
    label: "Site Consultation",
    icon: (props: any) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" />
        <path d="M10 15V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v9" />
        <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      </svg>
    ),
    bannerText:
      "Book an on-site technical inspection or measurement consultation with our experts.",
  },
  {
    id: "trade",
    label: "Dealer / Trade Desk",
    icon: (props: any) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    bannerText:
      "Connect with our trade sales team for dealership and bulk distributor supply.",
  },
] as const;

const PRODUCT_OR_SERVICES = [
  "Select product or service (e.g., Door Closers, Kitchen Baskets, etc.)",
  "Door Closers & Floor Springs",
  "Kitchen Baskets & Wardrobe Accessories",
  "Finished Insect Screens & Mesh",
  "Aluminium Sections & Extrusions",
  "Hardware & Accessories",
  "Ladders & Maintenance Equipment",
  "Rubber & PVC Beadings",
  "FDM Fittings & Channels",
  "Clips & Fasteners",
  "Frames & Channels",
  "Custom Architectural Solution",
] as const;

export function ContactDeskForm() {
  const [purpose, setPurpose] = useState<
    (typeof ENQUIRY_PURPOSES)[number]["id"]
  >("boq");

  const [formState, setFormState] = useState({
    name: "",
    role: "Select your role",
    organization: "",
    city: "",
    phone: "",
    email: "",
    division:
      "Select product or service (e.g., Door Closers, Kitchen Baskets, etc.)",
    notes: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const activePurpose =
    ENQUIRY_PURPOSES.find((p) => p.id === purpose) ?? ENQUIRY_PURPOSES[0];

  function validate(targetField?: string) {
    const errs: Record<string, string> = { ...fieldErrors };

    if (!targetField || targetField === "name") {
      if (!formState.name.trim()) {
        errs.name = "Full name is required.";
      } else if (formState.name.trim().length < 2) {
        errs.name = "Name must be at least 2 characters.";
      } else {
        delete errs.name;
      }
    }

    if (!targetField || targetField === "role") {
      if (!formState.role || formState.role === "Select your role") {
        errs.role = "Please select your role.";
      } else {
        delete errs.role;
      }
    }

    if (!targetField || targetField === "organization") {
      if (!formState.organization.trim()) {
        errs.organization = "Company / Organization is required.";
      } else {
        delete errs.organization;
      }
    }

    if (!targetField || targetField === "city") {
      if (!formState.city.trim()) {
        errs.city = "City or District is required.";
      } else {
        delete errs.city;
      }
    }

    if (!targetField || targetField === "phone") {
      const cleanPhone = formState.phone.replace(/[\s-]/g, "");
      if (!cleanPhone) {
        errs.phone = "Mobile number is required.";
      } else {
        const digits = cleanPhone.replace(/^\+91/, "");
        if (!/^[6-9]\d{9}$/.test(digits) && !/^\d{10}$/.test(digits)) {
          errs.phone = "Enter a valid 10-digit mobile number.";
        } else {
          delete errs.phone;
        }
      }
    }

    if (!targetField || targetField === "email") {
      if (!formState.email.trim()) {
        errs.email = "Email address is required.";
      } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())
      ) {
        errs.email = "Please enter a valid email address.";
      } else {
        delete errs.email;
      }
    }

    if (!targetField || targetField === "division") {
      if (
        !formState.division ||
        formState.division.startsWith("Select product")
      ) {
        errs.division = "Please select a product or service.";
      } else {
        delete errs.division;
      }
    }

    if (!targetField || targetField === "notes") {
      if (!formState.notes.trim()) {
        errs.notes = "Please describe your project or requirements.";
      } else {
        delete errs.notes;
      }
    }

    setFieldErrors(errs);
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrorMsg("Please fill in all required fields indicated with *");
      return;
    }

    setSubmitting(true);
    try {
      const purposeTag = `[${activePurpose.label}]`;
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          notes: `${purposeTag} ${formState.notes}`,
          source: "contact-page",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(
          data.error ||
            "Unable to submit your request right now. Please try again or call our desk."
        );
        return;
      }
      setSubmitted(true);
    } catch {
      setErrorMsg(
        "Network error while logging your request. Please call our desk directly."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      {/* ========================================================= */}
      {/* LEFT COLUMN: Head Office Card, Samples Card, Trade Desk   */}
      {/* ========================================================= */}
      <div className="lg:col-span-5 space-y-5">
        {/* Card 1: Head Office & Brand Desk */}
        <div className="bg-white rounded-2xl border border-[#E2EBF1] p-6 sm:p-7 shadow-[0_2px_12px_rgba(16,45,77,0.04)] relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#00A79F]">
              GET IN TOUCH
            </span>
            <span className="rounded-full bg-[#E8F8F7] px-2.5 py-0.5 text-[10px] font-bold text-[#00A79F] border border-[#C9EEEB]">
              MAIN OFFICE
            </span>
          </div>

          <h2 className="mt-2 text-xl font-extrabold text-[#102D4D]">
            Head Office &amp; Brand Desk
          </h2>
          <p className="mt-1 text-xs text-[#6B7D90] leading-relaxed">
            For product enquiries, quotations, project support
            <br className="hidden sm:inline" />
            and business partnerships.
          </p>

          <div className="mt-5 space-y-4">
            {/* Address */}
            <div className="flex items-start gap-3.5">
              <div className="h-9 w-9 rounded-xl bg-[#E8F8F7] border border-[#CEEDE9] flex items-center justify-center shrink-0 text-[#00A79F]">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-[#102D4D]">
                  Sai Ajantha Interior Solutions
                </p>
                <p className="text-[#657688] mt-0.5 leading-relaxed">
                  No. 23 A/A, Ramanathapuram Nagar,
                  <br />
                  Karur Bypass Road, Trichy – 620 003
                </p>
              </div>
            </div>

            {/* General Enquiries */}
            <div className="flex items-start gap-3.5">
              <div className="h-9 w-9 rounded-xl bg-[#E8F8F7] border border-[#CEEDE9] flex items-center justify-center shrink-0 text-[#00A79F]">
                <Phone className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="text-[11px] text-[#7E8F9F]">General Enquiries</p>
                <a
                  href="tel:+919842406588"
                  className="font-bold text-[#102D4D] hover:text-[#00A79F] transition-colors"
                >
                  +91 98424 06588
                </a>
              </div>
            </div>

            {/* Enquiry & Support */}
            <div className="flex items-start gap-3.5">
              <div className="h-9 w-9 rounded-xl bg-[#E8F8F7] border border-[#CEEDE9] flex items-center justify-center shrink-0 text-[#00A79F]">
                <Mail className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="text-[11px] text-[#7E8F9F]">Enquiry &amp; Support</p>
                <a
                  href="mailto:info@ajantainteriors.com"
                  className="font-bold text-[#102D4D] hover:text-[#00A79F] transition-colors"
                >
                  info@ajantainteriors.com
                </a>
              </div>
            </div>

            {/* Working Hours */}
            <div className="flex items-start gap-3.5">
              <div className="h-9 w-9 rounded-xl bg-[#E8F8F7] border border-[#CEEDE9] flex items-center justify-center shrink-0 text-[#00A79F]">
                <Clock className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="text-[11px] text-[#7E8F9F]">Working Hours</p>
                <p className="font-bold text-[#102D4D]">
                  Mon – Sat : 9:30 AM – 6:30 PM
                </p>
                <p className="text-[11px] text-[#8696A6] mt-0.5">
                  (Sunday : Closed)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Need Hardware or Extrusion Samples? */}
        <div
          onClick={() => setPurpose("samples")}
          className="group bg-white rounded-2xl border border-[#E2EBF1] p-4 sm:p-5 shadow-[0_2px_12px_rgba(16,45,77,0.04)] hover:border-[#00A79F] transition-all cursor-pointer flex items-center gap-4"
        >
          {/* Extrusion Thumbnail */}
          <div className="relative h-14 w-20 shrink-0 rounded-xl overflow-hidden bg-[#F2F6F9] border border-[#DCE6ED]">
            <Image
              src="/extrusion-samples.png"
              alt="Hardware or Extrusion Samples"
              fill
              className="object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#102D4D] leading-tight group-hover:text-[#00A79F] transition-colors">
              Need Hardware or
              <br />
              Extrusion Samples?
            </h3>
            <p className="mt-1 text-[11px] text-[#6B7D90] leading-snug">
              Get samples for evaluation, client approvals or project planning. Our team will assist you.
            </p>
          </div>

          <div className="h-7 w-7 rounded-full bg-[#E8F8F7] text-[#00A79F] flex items-center justify-center shrink-0 group-hover:bg-[#00A79F] group-hover:text-white transition-all">
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Card 3: Project & Trade Desk (Dark Cyan Gradient Card) */}
        <div
          className="rounded-2xl p-6 text-white shadow-md relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #022B34 0%, #06404B 50%, #0A5D6B 100%)",
          }}
        >
          {/* Subtle glow circle */}
          <div
            className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(0, 197, 180, 0.25) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />

          <div className="relative z-10">
            <div className="flex items-start gap-3">
              {/* Handshake/Trade Icon matching reference */}
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 text-[#24C6D0]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
                  <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.8-2.8L15 14" />
                  <path d="m2 13 6 6" />
                  <path d="m13 3 4.3 4.3a2 2 0 0 1 0 2.8L15 12" />
                </svg>
              </div>
              <div>
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#24C6D0]">
                  FOR PARTNERS &amp; BULK ENQUIRIES
                </span>
                <h3 className="text-lg font-extrabold text-white leading-tight mt-0.5">
                  Project &amp; Trade Desk
                </h3>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#B2D8DC] leading-relaxed">
              Dedicated support for bulk requirements, trade partnerships, and ongoing project coordination.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                href="/register?type=dealer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#02C5B4] hover:bg-[#00b2a2] text-[#01252C] px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <span>Become a Trade Partner</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/solutions"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/40 hover:border-white text-white px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer"
              >
                <span>View Guidelines</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: Interactive Consultation / BOQ Request Form */}
      {/* ========================================================= */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2EBF1] p-6 sm:p-9 shadow-[0_2px_14px_rgba(16,45,77,0.04)]">
        {submitted ? (
          <div className="py-12 text-center space-y-5">
            <div className="h-14 w-14 rounded-full bg-[#E8F8F7] text-[#00A79F] mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-[#102D4D]">
                Consultation Request Submitted!
              </h3>
              <p className="mt-2 text-sm text-[#5C6E82] max-w-md mx-auto">
                Thank you, <strong className="text-[#102D4D]">{formState.name}</strong>. Our technical desk in Trichy will review your{" "}
                <strong className="text-[#00A79F]">{activePurpose.label}</strong> requirements and respond promptly.
              </p>
            </div>
            <div className="pt-4">
              <Button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setFormState({
                    name: "",
                    role: "Select your role",
                    organization: "",
                    city: "",
                    phone: "",
                    email: "",
                    division:
                      "Select product or service (e.g., Door Closers, Kitchen Baskets, etc.)",
                    notes: "",
                  });
                }}
                className="rounded-full bg-[#00A79F] hover:bg-[#008f88] text-white px-6 font-bold"
              >
                Submit Another Request
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Header */}
            <div>
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#00A79F]">
                PLAN &bull; SPECIFY &bull; GET A BOQ
              </span>
              <h2 className="mt-1 text-2xl sm:text-[26px] font-extrabold text-[#102D4D] tracking-tight">
                Request Technical Consultation / BOQ
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#657688] leading-relaxed">
                Share your requirement and our technical team will get back with the right solution, recommendation and pricing.
              </p>
            </div>

            {/* Enquiry Purpose 4 Buttons */}
            <div>
              <label className="block text-xs font-bold text-[#102D4D] mb-2.5">
                Enquiry Purpose <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {ENQUIRY_PURPOSES.map((item) => {
                  const active = purpose === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPurpose(item.id)}
                      className={`group flex flex-col items-center justify-center p-3 sm:py-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? "bg-[#006870] border-[#006870] text-white shadow-sm"
                          : "bg-white border-[#D6E2EB] text-[#2C445C] hover:border-[#00A79F] hover:bg-[#F9FCFD]"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 mb-1.5 ${
                          active ? "text-white" : "text-[#00A79F]"
                        }`}
                      />
                      <span className="text-[11px] sm:text-xs">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Cyan banner under buttons matching reference */}
              <div className="mt-3 rounded-xl bg-[#DCF4F2] border border-[#BCE9E6] px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[#00605A]">
                <Info className="h-4 w-4 shrink-0 text-[#00A79F]" />
                <span className="text-[11px] sm:text-xs leading-tight">{activePurpose.bannerText}</span>
              </div>
            </div>

            {errorMsg && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Please check your entries</AlertTitle>
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {/* Row 1: Full Name & Your Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="full-name"
                  className="block text-xs font-bold text-[#102D4D] mb-1.5"
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696A6]">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="full-name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => {
                      setFormState({ ...formState, name: e.target.value });
                      if (fieldErrors.name) validate("name");
                    }}
                    onBlur={() => validate("name")}
                    placeholder="Enter your full name"
                    className={`w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border bg-white text-[#102D4D] placeholder:text-[#9AA8B7] focus:outline-none focus:ring-1 focus:ring-[#00A79F] focus:border-[#00A79F] transition-all ${
                      fieldErrors.name
                        ? "border-red-500 bg-red-50/20"
                        : "border-[#D6E2EB]"
                    }`}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="user-role"
                  className="block text-xs font-bold text-[#102D4D] mb-1.5"
                >
                  Your Role <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="user-role"
                    value={formState.role}
                    onChange={(e) => {
                      setFormState({ ...formState, role: e.target.value });
                      if (fieldErrors.role) validate("role");
                    }}
                    onBlur={() => validate("role")}
                    className={`w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border bg-white text-[#102D4D] focus:outline-none focus:ring-1 focus:ring-[#00A79F] focus:border-[#00A79F] transition-all appearance-none cursor-pointer ${
                      fieldErrors.role
                        ? "border-red-500 bg-red-50/20"
                        : "border-[#D6E2EB]"
                    }`}
                  >
                    {CONTACT_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#8696A6]">
                    <svg
                      className="h-4 w-4 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
                {fieldErrors.role && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {fieldErrors.role}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Company / Organization & City or District */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="company-org"
                  className="block text-xs font-bold text-[#102D4D] mb-1.5"
                >
                  Company / Organization <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696A6]">
                    <Building className="h-4 w-4" />
                  </div>
                  <input
                    id="company-org"
                    type="text"
                    required
                    value={formState.organization}
                    onChange={(e) => {
                      setFormState({
                        ...formState,
                        organization: e.target.value,
                      });
                      if (fieldErrors.organization) validate("organization");
                    }}
                    onBlur={() => validate("organization")}
                    placeholder="Enter company or organization name"
                    className={`w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border bg-white text-[#102D4D] placeholder:text-[#9AA8B7] focus:outline-none focus:ring-1 focus:ring-[#00A79F] focus:border-[#00A79F] transition-all ${
                      fieldErrors.organization
                        ? "border-red-500 bg-red-50/20"
                        : "border-[#D6E2EB]"
                    }`}
                  />
                </div>
                {fieldErrors.organization && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {fieldErrors.organization}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="city-district"
                  className="block text-xs font-bold text-[#102D4D] mb-1.5"
                >
                  City or District <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696A6]">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <input
                    id="city-district"
                    type="text"
                    required
                    value={formState.city}
                    onChange={(e) => {
                      setFormState({ ...formState, city: e.target.value });
                      if (fieldErrors.city) validate("city");
                    }}
                    onBlur={() => validate("city")}
                    placeholder="Enter city or district"
                    className={`w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border bg-white text-[#102D4D] placeholder:text-[#9AA8B7] focus:outline-none focus:ring-1 focus:ring-[#00A79F] focus:border-[#00A79F] transition-all ${
                      fieldErrors.city
                        ? "border-red-500 bg-red-50/20"
                        : "border-[#D6E2EB]"
                    }`}
                  />
                </div>
                {fieldErrors.city && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {fieldErrors.city}
                  </p>
                )}
              </div>
            </div>

            {/* Row 3: Mobile Number & Email Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="phone-number"
                  className="block text-xs font-bold text-[#102D4D] mb-1.5"
                >
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696A6]">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    id="phone-number"
                    type="tel"
                    required
                    value={formState.phone}
                    onChange={(e) => {
                      setFormState({ ...formState, phone: e.target.value });
                      if (fieldErrors.phone) validate("phone");
                    }}
                    onBlur={() => validate("phone")}
                    placeholder="Enter 10-digit mobile number"
                    className={`w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border bg-white text-[#102D4D] placeholder:text-[#9AA8B7] focus:outline-none focus:ring-1 focus:ring-[#00A79F] focus:border-[#00A79F] transition-all ${
                      fieldErrors.phone
                        ? "border-red-500 bg-red-50/20"
                        : "border-[#D6E2EB]"
                    }`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email-address"
                  className="block text-xs font-bold text-[#102D4D] mb-1.5"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696A6]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email-address"
                    type="email"
                    required
                    value={formState.email}
                    onChange={(e) => {
                      setFormState({ ...formState, email: e.target.value });
                      if (fieldErrors.email) validate("email");
                    }}
                    onBlur={() => validate("email")}
                    placeholder="Enter your email address"
                    className={`w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border bg-white text-[#102D4D] placeholder:text-[#9AA8B7] focus:outline-none focus:ring-1 focus:ring-[#00A79F] focus:border-[#00A79F] transition-all ${
                      fieldErrors.email
                        ? "border-red-500 bg-red-50/20"
                        : "border-[#D6E2EB]"
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Row 4: Product or Service Required */}
            <div>
              <label
                htmlFor="service-product"
                className="block text-xs font-bold text-[#102D4D] mb-1.5"
              >
                Product or Service Required <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696A6]">
                  <Package className="h-4 w-4" />
                </div>
                <select
                  id="service-product"
                  value={formState.division}
                  onChange={(e) => {
                    setFormState({ ...formState, division: e.target.value });
                    if (fieldErrors.division) validate("division");
                  }}
                  onBlur={() => validate("division")}
                  className={`w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm rounded-xl border bg-white text-[#102D4D] focus:outline-none focus:ring-1 focus:ring-[#00A79F] focus:border-[#00A79F] transition-all appearance-none cursor-pointer ${
                    fieldErrors.division
                      ? "border-red-500 bg-red-50/20"
                      : "border-[#D6E2EB]"
                  }`}
                >
                  {PRODUCT_OR_SERVICES.map((prod) => (
                    <option key={prod} value={prod}>
                      {prod}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#8696A6]">
                  <svg
                    className="h-4 w-4 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
              {fieldErrors.division && (
                <p className="mt-1 text-[11px] text-red-500">
                  {fieldErrors.division}
                </p>
              )}
            </div>

            {/* Row 5: What Do You Need? (Textarea) */}
            <div>
              <label
                htmlFor="user-notes"
                className="block text-xs font-bold text-[#102D4D] mb-1.5"
              >
                What Do You Need? <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <textarea
                  id="user-notes"
                  rows={4}
                  required
                  value={formState.notes}
                  onChange={(e) => {
                    setFormState({ ...formState, notes: e.target.value });
                    if (fieldErrors.notes) validate("notes");
                  }}
                  onBlur={() => validate("notes")}
                  placeholder="Tell us about your project – requirement, spec, quantity or any specific details..."
                  className={`w-full p-3 text-xs sm:text-sm rounded-xl border bg-white text-[#102D4D] placeholder:text-[#9AA8B7] focus:outline-none focus:ring-1 focus:ring-[#00A79F] focus:border-[#00A79F] transition-all resize-y ${
                    fieldErrors.notes
                      ? "border-red-500 bg-red-50/20"
                      : "border-[#D6E2EB]"
                  }`}
                />
              </div>
              {fieldErrors.notes && (
                <p className="mt-1 text-[11px] text-red-500">
                  {fieldErrors.notes}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-xl text-white font-bold text-sm tracking-wide shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background:
                    "linear-gradient(90deg, #00A79F 0%, #00877F 50%, #01565C 100%)",
                  boxShadow: "0 4px 14px rgba(0, 167, 159, 0.3)",
                }}
              >
                <span>
                  {submitting
                    ? "Submitting..."
                    : `Submit ${activePurpose.label} Request`}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
