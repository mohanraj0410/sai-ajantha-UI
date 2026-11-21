"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  BRAND_CONTACT,
  CUSTOMER_SEGMENTS,
  VISION_MISSION,
} from "@/lib/brand";
import { MagneticWrapper } from "./MotionPrimitives";
import { SectionHeading } from "./SectionHeading";

const CTA_SECTORS = [
  "Screens & Mosquito Protection",
  "Commercial Interiors",
  "Acoustic Solutions",
  "Ceiling & Wall Systems",
  "Aluminium & Hardware BOQ",
] as const;

const REFERENCE_DOSSIERS = [
  "BOQ Schedules",
  "Datasheets & Sample Kits",
  "Authorization Docs",
] as const;

export function TestimonialsSection() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="relative sa-surface-gradient py-8 sm:py-10 lg:py-11 border-t border-[#E8EDF3]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Who We Serve & Partner Confidence"
            title="Trusted by Institutional & Trade Decision-Makers"
            description="Every engagement is built around the real priorities of homeowners, fabricators, contractors, and building-material dealers."
            titleId="testimonials-heading"
          />
          <span className="inline-flex items-center gap-2 self-start lg:self-auto rounded-lg border border-[#C6CAD5] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#102D4D] shadow-xs">
            <span className="h-2 w-2 rounded-full bg-[#079D9A]" />
            {VISION_MISSION.promise.join(" · ")}
          </span>
        </div>

        {/* Verified Partner Segment B2B Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {CUSTOMER_SEGMENTS.map((seg, idx) => {
            const isInstitutional = idx === 0;
            const ctaHref = isInstitutional ? "/contact" : "/register";
            const ctaText = isInstitutional
              ? "Request Institutional BOQ Quote"
              : "Apply for Trade / Dealer Account";

            return (
              <motion.article
                key={seg.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.42, delay: idx * 0.08 }}
                className="group sa-border-gradient sa-card-accent-top sa-hover-lift flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[#C6CAD5] bg-white p-5 sm:p-7 space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge
                      variant="teal"
                      className="bg-gradient-to-r from-[#079D9A] to-[#174B78] text-white border-0"
                    >
                      {seg.label}
                    </Badge>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#E5F7F6] text-[#079D9A]">
                      {isInstitutional ? (
                        <Building2 className="size-4.5" />
                      ) : (
                        <ShieldCheck className="size-4.5" />
                      )}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-[#102D4D]">
                      {seg.title}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#079D9A]">
                      {seg.roles}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E8EDF3] text-xs leading-relaxed">
                    <div className="rounded-xl bg-[#F3F6FA] p-3.5 border border-[#E8EDF3]">
                      <p className="font-bold text-[#102D4D]">
                        Project Requirement
                      </p>
                      <p className="mt-1 text-[#5D6B7B]">{seg.trigger}</p>
                    </div>
                    <div className="rounded-xl bg-[#F3F6FA] p-3.5 border border-[#E8EDF3]">
                      <p className="font-bold text-[#102D4D]">Risks Addressed</p>
                      <p className="mt-1 text-[#5D6B7B]">{seg.painPoints}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#E5F7F6]/70 p-3.5 border border-[#079D9A]/30 text-xs leading-relaxed">
                    <p className="font-bold text-[#102D4D]">
                      Sai Ajantha Assurance
                    </p>
                    <p className="mt-1 text-[#102D4D]">{seg.assurance}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#EAF0F6] flex items-center justify-between gap-2">
                  <Link
                    href={ctaHref}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.09em] text-[#079D9A] hover:text-[#102D4D] transition-colors"
                  >
                    <span>{ctaText}</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* Institutional & Trade Reference Desk */}
        <div className="sa-dark-radial-panel rounded-2xl border border-[#174B78] p-5 sm:p-6 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-lg">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#24C6D0]">
                <FileText className="size-3.5" />
                Institutional &amp; Trade Reference Desk
              </span>
              <div className="flex flex-wrap gap-1.5">
                {REFERENCE_DOSSIERS.map((doc) => (
                  <span
                    key={doc}
                    className="rounded-md border border-white/15 bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-[#E5F7F6]"
                  >
                    {doc}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm font-semibold text-white">
              Project reference dossiers, completed site evaluations, and
              technical authorization documents are furnished directly for
              institutional bids.
            </p>
            <p className="text-xs text-[#C6CAD5]">
              Homeowners, builders, fabricators, and dealers may request
              Tiruchirappalli and Tamil Nadu product documentation via our
              consultation desk.
            </p>
          </div>
          <Button
            asChild
            className="shrink-0 bg-gradient-to-r from-[#079D9A] to-[#24C6D0] text-[#0B1F35] font-bold hover:from-white hover:to-[#E8EDF3]"
          >
            <Link href="/contact">
              <span>Request Project References</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ContactCTASection() {
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [sector, setSector] = useState<string>("Finished Insect Screens");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(targetField?: string) {
    const errs: Record<string, string> = { ...fieldErrors };

    if (!targetField || targetField === "name") {
      if (!name.trim()) {
        errs.name = "Your name is required.";
      } else if (name.trim().length < 2) {
        errs.name = "Name must be at least 2 characters.";
      } else {
        delete errs.name;
      }
    }

    if (!targetField || targetField === "contactInfo") {
      const cleanContact = contactInfo.trim();
      if (!cleanContact) {
        errs.contactInfo = "Phone or work email is required.";
      } else if (cleanContact.includes("@")) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanContact)) {
          errs.contactInfo = "Enter a valid email address.";
        } else {
          delete errs.contactInfo;
        }
      } else {
        const digits = cleanContact.replace(/[\s-]/g, "").replace(/^\+91/, "");
        if (!/^\d{10}$/.test(digits)) {
          errs.contactInfo = "Enter a valid 10-digit phone or email.";
        } else {
          delete errs.contactInfo;
        }
      }
    }

    setFieldErrors(errs);
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const errs = validate();
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const isEmail = contactInfo.includes("@");
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          organization: organization.trim(),
          phone: isEmail ? "" : contactInfo.trim(),
          email: isEmail ? contactInfo.trim() : "",
          division: sector,
          notes: message.trim(),
          source: "homepage-cta",
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setErrorMsg(
          `Could not submit enquiry right now. Please call ${BRAND_CONTACT.phone} directly.`
        );
      }
    } catch {
      setErrorMsg(
        `Network error submitting enquiry. Please call ${BRAND_CONTACT.phone} directly.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="contact"
      aria-labelledby="cta-heading"
      className="relative bg-white py-8 sm:py-10 lg:py-11 border-t border-[#E8EDF3]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="rounded-3xl border border-[#174B78] sa-dark-radial-panel text-white overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Copy & Direct Contact Channels */}
            <div className="lg:col-span-6 relative p-6 sm:p-8 lg:p-9 flex flex-col justify-between gap-5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 brand-grid-accent-dark opacity-70"
              />

              <div className="relative z-10 space-y-4">
                <Badge
                  variant="teal"
                  className="bg-gradient-to-r from-[#079D9A] to-[#24C6D0] text-[#0B1F35] border-0 font-bold"
                >
                  Technical Consultation Desk
                </Badge>
                <h2
                  id="cta-heading"
                  className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.08] tracking-[-0.025em] text-white"
                >
                  Let&apos;s Build Your Next Project With{" "}
                  <span className="sa-gradient-text-light">Confidence.</span>
                </h2>
                <p className="text-sm sm:text-[15px] leading-relaxed text-[#C6CAD5] max-w-lg">
                  Share your window measurements, site requirements, or order
                  quantities. Our Trichy technical team provides clear product
                  recommendations and direct wholesale pricing.
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Finished Insect Screens",
                    "Aluminium Sections",
                    "Door Hardware & Closers",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#E5F7F6]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="pt-1 flex flex-wrap gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-gradient-to-r from-[#079D9A] to-[#24C6D0] text-[#0B1F35] font-bold hover:from-white hover:to-[#E8EDF3]"
                  >
                    <Link href="/contact">
                      Request a Consultation <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="border-white/35 bg-white/5 text-white hover:bg-white hover:text-[#102D4D] hover:border-white backdrop-blur-sm"
                  >
                    <a href={BRAND_CONTACT.phoneHref}>
                      <Phone className="size-3.5" /> Call {BRAND_CONTACT.phone}
                    </a>
                  </Button>
                </div>
              </div>

              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 border-t border-white/15 text-xs text-[#C6CAD5]">
                <div className="flex items-start gap-2.5">
                  <MapPin className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Head Office · Trichy</p>
                    <p className="mt-0.5 leading-relaxed">
                      {BRAND_CONTACT.address}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <a
                    href={`mailto:${BRAND_CONTACT.email}`}
                    className="inline-flex items-center gap-2 text-white font-bold hover:text-[#24C6D0] transition-colors"
                  >
                    <Mail className="size-3.5 text-[#24C6D0]" />
                    <span>{BRAND_CONTACT.email}</span>
                  </a>
                  <div className="flex items-start gap-2 text-[11px] text-[#C6CAD5]/85">
                    <Clock className="size-3.5 text-[#24C6D0] shrink-0 mt-0.5" />
                    <span>{BRAND_CONTACT.slaNote}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Interactive White Enquiry Form */}
            <div className="lg:col-span-6 bg-white text-[#102D4D] p-6 sm:p-8 lg:p-9">
              {submitted ? (
                <div className="h-full flex flex-col justify-center items-start space-y-4">
                  <Alert variant="success">
                    <CheckCircle2 className="size-4" />
                    <AlertTitle>Enquiry Logged</AlertTitle>
                    <AlertDescription>
                      Thank you, {name}. Your <strong>{sector}</strong> enquiry
                      has been prepared for {BRAND_CONTACT.email}. Reach us
                      immediately on <strong>{BRAND_CONTACT.phone}</strong>.
                    </AlertDescription>
                  </Alert>
                  <Button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setName("");
                      setOrganization("");
                      setContactInfo("");
                      setMessage("");
                    }}
                  >
                    Submit Another Enquiry
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#102D4D]">
                      Project &amp; BOQ Enquiry Form
                    </h3>
                    <p className="mt-1 text-xs text-[#5D6B7B]">
                      Direct routing to {BRAND_CONTACT.companyName}, Trichy.
                    </p>
                  </div>

                  {/* Quick One-Tap Sector Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {CTA_SECTORS.map((s) => {
                      const active = sector === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSector(s)}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors cursor-pointer ${
                            active
                              ? "border-[#079D9A] bg-[#E5F7F6] text-[#079D9A]"
                              : "border-[#E8EDF3] bg-[#F3F6FA] text-[#5D6B7B] hover:border-[#C6CAD5] hover:text-[#102D4D]"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  {errorMsg && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertDescription>{errorMsg}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Your Name" htmlFor="cta-name" required error={fieldErrors.name}>
                      <Input
                        id="cta-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (fieldErrors.name) validate("name");
                        }}
                        onBlur={() => validate("name")}
                        placeholder="Full name"
                        className={`bg-[#F3F6FA] ${
                          fieldErrors.name
                            ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-red-200"
                            : "border-[#C6CAD5] focus:bg-white focus:border-[#079D9A]"
                        }`}
                      />
                    </FormField>
                    <FormField label="Company / Shop Name" htmlFor="cta-org">
                      <Input
                        id="cta-org"
                        type="text"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="Shop, firm, or business name"
                        className="bg-[#F3F6FA] border-[#C6CAD5] focus:bg-white focus:border-[#079D9A]"
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Phone or Work Email"
                      htmlFor="cta-contact"
                      required
                      error={fieldErrors.contactInfo}
                    >
                      <Input
                        id="cta-contact"
                        type="text"
                        required
                        value={contactInfo}
                        onChange={(e) => {
                          setContactInfo(e.target.value);
                          if (fieldErrors.contactInfo) validate("contactInfo");
                        }}
                        onBlur={() => validate("contactInfo")}
                        placeholder="+91 ... or name@company.in"
                        className={`bg-[#F3F6FA] ${
                          fieldErrors.contactInfo
                            ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-red-200"
                            : "border-[#C6CAD5] focus:bg-white focus:border-[#079D9A]"
                        }`}
                      />
                    </FormField>
                    <FormField
                      label="Requirement Division"
                      htmlFor="cta-sector"
                    >
                      <Select value={sector} onValueChange={setSector}>
                        <SelectTrigger id="cta-sector">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CTA_SECTORS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>

                  <FormField
                    label="Project Scope / SKU Notes"
                    htmlFor="cta-msg"
                  >
                    <Textarea
                      id="cta-msg"
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Briefly describe site location, timeline, or SKU specifications..."
                      className="bg-[#F3F6FA] border-[#C6CAD5] focus:bg-white focus:border-[#079D9A]"
                    />
                  </FormField>

                  <MagneticWrapper strength={4} className="w-full">
                    <Button
                      type="submit"
                      disabled={submitting}
                      size="lg"
                      className="sa-btn-gradient w-full border-0 font-bold text-white"
                    >
                      {submitting ? "Submitting..." : "Contact Our Team"}
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </MagneticWrapper>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
