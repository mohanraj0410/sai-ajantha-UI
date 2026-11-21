"use client";

import { useState } from "react";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BRAND_CONTACT } from "@/lib/brand";
import { TiltCard } from "./TiltCard";

const PRODUCT_CATEGORIES_OPTIONS = [
  "Finished Insect Screens",
  "Aluminium Sections",
  "Hardware & Accessories",
  "Ladders",
  "Rubber & PVC Beading",
  "FGM Fittings & Channels",
  "Clips & Fasteners",
  "Frames & Channels",
  "Mesh & Screening",
  "House of Ajantha - Door Closers",
  "House of Ajantha - Kitchen Baskets",
  "General Project BOQ Enquiry",
] as const;

/**
 * Checklist Requirement 2 & Phase 04 Section 07:
 * Contact Information & Specification Enquiry:
 * - Direct communication channels (Phone, WhatsApp, Email, Trichy showroom)
 * - Clickable links with real verified data
 * - Clean two-column architectural card with equal visual weight
 * - Robust client-side validation submitting to existing backend API
 * - Enhanced with architectural blueprint framing and accessible inputs.
 */
export function ContactEnquirySection() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>(PRODUCT_CATEGORIES_OPTIONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate() {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Full name is required.";
    if (!phone.trim()) {
      errors.phone = "Mobile number is required.";
    } else {
      const cleanPhone = phone.replace(/[\s-]/g, "");
      const digits = cleanPhone.replace(/^\+91/, "");
      if (!/^[6-9]\d{9}$/.test(digits) && !/^\d{10}$/.test(digits)) {
        errors.phone = "Enter a valid 10-digit mobile number.";
      }
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          division: category,
          notes: details.trim(),
          source: "homepage-contact-section",
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        setErrorMsg(
          `Unable to submit enquiry at the moment. Please contact our desk directly at ${BRAND_CONTACT.phone}.`
        );
      }
    } catch {
      setErrorMsg(
        `Network error submitting enquiry. Please call us directly at ${BRAND_CONTACT.phone}.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="contact-information"
      aria-labelledby="contact-heading"
      className="relative bg-white py-16 sm:py-24 lg:py-32 border-t border-[#E8EDF3] overflow-hidden"
    >
      {/* Background Architectural Blueprint Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025] bg-[radial-gradient(#102D4D_1px,transparent_1px)] [background-size:28px_28px]"
      />

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 space-y-12">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#079D9A]/30 bg-[#E5F7F6] px-4 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
            <Sparkles className="size-3.5" />
            <span>Direct Technical Consultation</span>
          </span>

          <h2
            id="contact-heading"
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0B1F35] leading-tight"
          >
            CONNECT WITH OUR TRICHY DESK
          </h2>

          <p className="text-sm sm:text-base text-[#5D6B7B] leading-relaxed">
            Reach our engineering consultation team directly for product availability,
            custom aperture specifications, or project BOQ verification.
          </p>
        </div>

        {/* Balanced Two-Column Architectural Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-[#E8EDF3] overflow-hidden shadow-2xl">
          {/* Left Column: Direct Communication Channels (Deep Navy) */}
          <div className="lg:col-span-5 bg-[#0B1F35] text-white p-8 sm:p-10 lg:p-12 flex flex-col justify-between space-y-8 relative overflow-hidden">
            {/* Subtle Blueprint Texture Accent */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[radial-gradient(#24C6D0_1px,transparent_1px)] [background-size:24px_24px]"
            />

            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#24C6D0] block">
                  Central Engineering Desk
                </span>
                <h3 className="font-display text-2xl font-bold text-white leading-snug">
                  Sai Ajantha Interior Solutions
                </h3>
                <p className="text-xs text-[#C6CAD5] leading-relaxed">
                  Established central warehouse and technical consultation desk in Tiruchirappalli, Tamil Nadu.
                </p>
              </div>

              {/* Direct Channels List */}
              <div className="space-y-5 text-sm pt-2">
                {/* Phone Call Link */}
                <div className="flex items-start gap-3.5 group">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#24C6D0] border border-white/10 group-hover:bg-[#24C6D0] group-hover:text-[#0B1F35] transition-colors shadow-2xs">
                    <Phone className="size-4" />
                  </span>
                  <div>
                    <p className="font-bold text-white">Telephone Support</p>
                    <a
                      href={BRAND_CONTACT.phoneHref}
                      className="mt-0.5 block font-semibold text-[#24C6D0] hover:text-white transition-colors"
                    >
                      {BRAND_CONTACT.phone}
                    </a>
                  </div>
                </div>

                {/* WhatsApp Chat Link */}
                <div className="flex items-start gap-3.5 group">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 group-hover:bg-[#25D366] group-hover:text-white transition-colors shadow-2xs">
                    <MessageCircle className="size-4" />
                  </span>
                  <div>
                    <p className="font-bold text-white">WhatsApp Business Desk</p>
                    <a
                      href="https://wa.me/919842406588?text=Hello%20Sai%20Ajantha%20Team%2C%20I%20have%20an%20interior%20solutions%20enquiry."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#25D366] hover:text-white transition-colors"
                    >
                      <span>+91 98424 06588 (Chat on WhatsApp)</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>

                {/* Email Link */}
                <div className="flex items-start gap-3.5 group">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#24C6D0] border border-white/10 group-hover:bg-[#24C6D0] group-hover:text-[#0B1F35] transition-colors shadow-2xs">
                    <Mail className="size-4" />
                  </span>
                  <div>
                    <p className="font-bold text-white">Official Email</p>
                    <a
                      href={`mailto:${BRAND_CONTACT.email}`}
                      className="mt-0.5 block font-semibold text-[#24C6D0] hover:text-white transition-colors"
                    >
                      {BRAND_CONTACT.email}
                    </a>
                  </div>
                </div>

                {/* Business Address */}
                <div className="flex items-start gap-3.5 group">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#24C6D0] border border-white/10 group-hover:bg-[#24C6D0] group-hover:text-[#0B1F35] transition-colors shadow-2xs">
                    <MapPin className="size-4" />
                  </span>
                  <div>
                    <p className="font-bold text-white">Commercial Facility</p>
                    <p className="mt-0.5 leading-relaxed text-[#C6CAD5]">
                      {BRAND_CONTACT.address}
                    </p>
                    <a
                      href="https://maps.google.com/?q=No+32+A/6+Ramamurthy+Nagar+Karur+By-pass+Road+Trichy+620003"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#24C6D0] hover:underline"
                    >
                      <span>Open in Google Maps</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                </div>

                {/* Working Schedule */}
                <div className="flex items-start gap-3.5">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#24C6D0] border border-white/10 shadow-2xs">
                    <Clock className="size-4" />
                  </span>
                  <div>
                    <p className="font-bold text-white">Inquiry Desk</p>
                    <p className="mt-0.5 text-[#C6CAD5]">
                      Tiruchirappalli, Tamil Nadu
                    </p>
                    <p className="text-[11px] text-[#24C6D0] mt-0.5">
                      Technical review &amp; BOQ matching by our Trichy desk
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tax & Commercial Compliance Pill */}
            <div className="p-4 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-[#C6CAD5] space-y-1 backdrop-blur-xs relative z-10">
              <p className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-[#24C6D0]" />
                <span>GST Registered Commercial Supplier</span>
              </p>
              <p className="text-[11px] text-[#A8B4C2] leading-relaxed">
                Official commercial tax invoicing and project BOQ documentation provided for trade contractors and institutional clients.
              </p>
            </div>
          </div>

          {/* Right Column: Direct Product / Project Enquiry Form */}
          <div className="lg:col-span-7 bg-white text-[#0B1F35] p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
            {submitted ? (
              <div className="py-10 space-y-6">
                <Alert variant="success" className="border-emerald-300 bg-emerald-50 text-emerald-900 p-6 rounded-2xl">
                  <CheckCircle2 className="size-6 text-emerald-600" />
                  <AlertTitle className="text-lg font-bold">Enquiry Submitted Successfully</AlertTitle>
                  <AlertDescription className="text-xs sm:text-sm leading-relaxed mt-2">
                    Thank you, <strong>{name}</strong>. Your enquiry regarding <strong>{category}</strong> has been logged with our Trichy technical desk. An engineering specialist will review your specifications and follow up at <strong>{phone}</strong>.
                  </AlertDescription>
                </Alert>

                <Button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setName("");
                    setPhone("");
                    setEmail("");
                    setDetails("");
                  }}
                  className="bg-[#0B1F35] hover:bg-[#079D9A] text-white text-xs font-bold uppercase tracking-wider rounded-xl py-3 px-6 transition-all hover:scale-[1.02] active:scale-98"
                >
                  Submit Another Enquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="space-y-1">
                  <h3 className="font-display text-2xl font-bold text-[#0B1F35]">
                    Request a Technical Consultation
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5D6B7B]">
                    Submit your requirement below. Our engineering desk will respond with technical clarity.
                  </p>
                </div>

                {errorMsg && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
                  </Alert>
                )}

                {/* Name Field */}
                <FormField
                  label="Full Name *"
                  htmlFor="enquiry-name"
                  error={fieldErrors.name}
                >
                  <Input
                    id="enquiry-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    placeholder="e.g. Ar. Rajesh Kumar"
                    className="bg-[#F8FAFC] border-[#E8EDF3] focus:bg-white focus:border-[#079D9A] rounded-xl h-11 text-xs"
                  />
                </FormField>

                {/* Phone & Email Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Mobile Number *"
                    htmlFor="enquiry-phone"
                    error={fieldErrors.phone}
                  >
                    <Input
                      id="enquiry-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      placeholder="e.g. 9842406588"
                      className="bg-[#F8FAFC] border-[#E8EDF3] focus:bg-white focus:border-[#079D9A] rounded-xl h-11 text-xs"
                    />
                  </FormField>

                  <FormField
                    label="Email Address (Optional)"
                    htmlFor="enquiry-email"
                    error={fieldErrors.email}
                  >
                    <Input
                      id="enquiry-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
                      }}
                      placeholder="e.g. rajesh@architecture.in"
                      className="bg-[#F8FAFC] border-[#E8EDF3] focus:bg-white focus:border-[#079D9A] rounded-xl h-11 text-xs"
                    />
                  </FormField>
                </div>

                {/* Product Category Selector */}
                <FormField
                  label="Product Category / Inquiry Division *"
                  htmlFor="enquiry-category"
                >
                  <Select value={category} onValueChange={(val) => setCategory(val)}>
                    <SelectTrigger
                      id="enquiry-category"
                      className="bg-[#F8FAFC] border-[#E8EDF3] focus:bg-white focus:border-[#079D9A] rounded-xl h-11 text-xs"
                    >
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 rounded-xl">
                      {PRODUCT_CATEGORIES_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                {/* Notes / Details */}
                <FormField
                  label="Project Apertures / BOQ Details (Optional)"
                  htmlFor="enquiry-details"
                >
                  <Textarea
                    id="enquiry-details"
                    rows={3}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Specify project location, estimated quantity, profile finishes, or door weights..."
                    className="bg-[#F8FAFC] border-[#E8EDF3] focus:bg-white focus:border-[#079D9A] rounded-xl text-xs resize-none"
                  />
                </FormField>

                {/* Submit Action */}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#0B1F35] hover:bg-[#079D9A] text-white text-xs font-bold uppercase tracking-[0.14em] py-6 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Submitting Enquiry...</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span>Submit Consultation Request</span>
                      <Send className="size-3.5" />
                    </span>
                  )}
                </Button>

                <p className="text-[11px] text-center text-[#526274]">
                  We treat project requirements confidentially per our Privacy Policy.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
