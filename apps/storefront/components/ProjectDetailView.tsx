"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Maximize2,
  Printer,
  Share2,
} from "lucide-react";
import { PageHeader } from "@/components/non-home/PageHeader";
import { BrandProductCard } from "@/components/BrandProductCard";
import { useStore } from "@/components/StoreProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { ProductItem } from "@/lib/products";
import type { ProjectCaseStudy } from "@/lib/solutionsAndProjects";

const PROJECT_DETAIL_IMAGES: Record<string, string> = {
  "residential-apartment-screens-and-hardware": `/products/${encodeURIComponent(
    "Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-80-002]-img.jpg"
  )}`,
  "commercial-glass-facade-entrance-package": `/products/${encodeURIComponent(
    "Door-closer-&-Floor-spring-Floor-spring-[SA-I-FS-TON110-008]-img.jpg"
  )}`,
  "educational-acoustic-fenestration-package": `/products/${encodeURIComponent(
    "Aluminium-[A-2trk-b-12-022]-two-track-bottom.jpg"
  )}`,
  "institutional-pantry-and-utility-fitout": `/products/${encodeURIComponent(
    "Kitchen-Basket-thali-img.jpg"
  )}`,
};

const PACKAGE_CODES: Record<string, string> = {
  "residential-apartment-screens-and-hardware": "PKG-HC-01",
  "commercial-glass-facade-entrance-package": "PKG-CM-02",
  "educational-acoustic-fenestration-package": "PKG-ED-03",
  "institutional-pantry-and-utility-fitout": "PKG-UT-04",
};

const ROLE_OPTIONS = ["Architect / Consultant", "Builder / Project Head", "Procurement Manager", "Dealer / Interior Contractor"] as const;

interface ProjectDetailViewProps {
  project: ProjectCaseStudy;
  prevProject: ProjectCaseStudy;
  nextProject: ProjectCaseStudy;
  relatedItems: ProductItem[];
}

export function ProjectDetailView({
  project,
  prevProject,
  nextProject,
  relatedItems,
}: ProjectDetailViewProps) {
  const { showToast } = useStore();

  const [copiedLink, setCopiedLink] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // BOQ Consultation Dialog state
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    name: "",
    role: "Architect / Consultant",
    organization: "",
    phone: "",
    email: "",
    city: "Trichy",
    notes: "",
  });

  const packageCode = PACKAGE_CODES[project.slug];

  const showcaseImage = PROJECT_DETAIL_IMAGES[project.slug] ?? project.image;

  // Prefilled WhatsApp Message
  const waMessage = useMemo(() => {
    const text = [
      `Hello Sai Ajantha Technical Desk,`,
      ``,
      `I am reviewing your Project Reference example:`,
      `• Case Study: ${project.title}`,
      `• Package Code: ${packageCode}`,
      `• Sector: ${project.sector}`,
      `• Systems: ${project.systemsUsed.join(", ")}`,
      ``,
      `We have a similar requirement in Tamil Nadu. Please share specification sheets and trade BOQ estimation guidance.`,
    ].join("\n");
    return encodeURIComponent(text);
  }, [project.title, packageCode, project.sector, project.systemsUsed]);

  const waHref = `https://wa.me/919842406588?text=${waMessage}`;

  function handleShareLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href).catch(() => { });
      setCopiedLink(true);
      showToast("Project case study URL copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  async function handleQuoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuoteError(null);
    if (!quoteForm.name.trim() || (!quoteForm.phone.trim() && !quoteForm.email.trim())) {
      setQuoteError("Please enter your name and phone number or work email.");
      return;
    }

    setQuoteSubmitting(true);
    try {
      const formattedNotes = [
        `[Project Case Study BOQ Inquiry]`,
        `Reference Package: ${project.title} (${packageCode})`,
        `Category: ${project.category}`,
        `Sector: ${project.sector}`,
        `Location Target: ${quoteForm.city}`,
        `Systems: ${project.systemsUsed.join(", ")}`,
        quoteForm.notes ? `Project Notes: ${quoteForm.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quoteForm.name,
          role: quoteForm.role,
          organization: quoteForm.organization,
          phone: quoteForm.phone,
          email: quoteForm.email,
          city: quoteForm.city,
          division: project.category,
          notes: formattedNotes,
          source: "project-detail-modal",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setQuoteError(data.error || "Unable to submit your request. Please call our desk.");
        return;
      }

      setQuoteSubmitted(true);
      showToast("Project BOQ inquiry logged with Trichy Desk");
    } catch {
      setQuoteError("Network error submitting your inquiry. Please try again.");
    } finally {
      setQuoteSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title={project.title} section="Planning example" description="Use this example to plan your own site. It does not describe a completed project." parents={[{ label: "Projects", href: "/projects" }]}>
        <button type="button" className="mt-4 min-h-11 rounded-lg bg-[#c7f2f2] px-4 text-sm font-bold text-[#0b1f35] hover:bg-white" onClick={() => setQuoteDialogOpen(true)}>Ask for a quote</button>
      </PageHeader>
      <div className="sa-content-width py-7 sm:py-10 space-y-8">
        <section className="sa-detail-panel grid grid-cols-1 md:grid-cols-2 gap-5 p-5 sm:p-8 items-center" aria-label="Example hardware">
          <button type="button" aria-label="Enlarge sample product photo" onClick={() => setIsLightboxOpen(true)} className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-[#f4f6f9]">
            <Image src={showcaseImage} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain p-4" />
            <Maximize2 className="absolute bottom-3 right-3 size-6 rounded border bg-white p-1" aria-hidden="true" />
          </button>
          <div className="space-y-4">
            <p className="sa-group-label">{project.category} · {packageCode}</p>
            <h2 className="text-2xl font-bold text-[#0b1f35]">Products to consider</h2>
            <p className="text-sm sm:text-base">Check measurements, load limits and fit before choosing parts for your site.</p>
            <ul className="space-y-1.5">
              {project.systemsUsed.map((name) => <li key={name}><Link className="inline-flex min-h-9 items-center text-sm font-semibold text-[#076864] underline underline-offset-4" href={`/products?category=${encodeURIComponent(name)}`}>{name}</Link></li>)}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={handleShareLink}><Share2 className="size-4" />{copiedLink ? "Link copied" : "Copy link"}</Button>
              <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="size-4" />Print</Button>
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#076864] underline">Ask on WhatsApp</a>
            </div>
          </div>
        </section>

        {/* Related products */}
        <section className="pt-10 border-t border-[#EAF0F6]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                Specified Catalogue Components
              </span>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#102D4D]">
                Key Product Systems Used
              </h2>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#079D9A] hover:underline"
            >
              Browse all products
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedItems.map((item) => (
              <BrandProductCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        {/* Previous / Next Case Study Navigation */}
        <section className="pt-8 border-t border-[#EAF0F6] grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href={`/projects/${prevProject.slug}`}
            className="group rounded-2xl border border-[#EAF0F6] bg-[#F8FAFC] p-5 flex items-center justify-between gap-4 hover:border-[#079D9A] hover:bg-white transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#DCE4EE] text-[#102D4D] group-hover:border-[#079D9A] group-hover:text-[#079D9A]">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7B8896]">
                  Previous Package
                </p>
                <p className="mt-0.5 truncate font-display text-sm font-bold text-[#102D4D] group-hover:text-[#079D9A]">
                  {prevProject.title}
                </p>
              </div>
            </div>
          </Link>

          <Link
            href={`/projects/${nextProject.slug}`}
            className="group rounded-2xl border border-[#EAF0F6] bg-[#F8FAFC] p-5 flex items-center justify-end gap-4 hover:border-[#079D9A] hover:bg-white transition-all text-right"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7B8896]">
                  Next Package
                </p>
                <p className="mt-0.5 truncate font-display text-sm font-bold text-[#102D4D] group-hover:text-[#079D9A]">
                  {nextProject.title}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#DCE4EE] text-[#102D4D] group-hover:border-[#079D9A] group-hover:text-[#079D9A]">
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        </section>
      </div>

      {/* Fullscreen Lightbox Inspection Dialog */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-4xl p-6 sm:p-8 bg-white border border-[#EAF0F6] rounded-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#079D9A]">
                Product image
              </span>
              <Badge variant="secondary" className="font-mono">
                {packageCode}
              </Badge>
            </div>
            <DialogTitle className="font-display text-xl font-bold text-[#102D4D]">
              {project.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5D6B7B]">
              Product image for this planning example
            </DialogDescription>
          </DialogHeader>

          <div className="relative aspect-video w-full my-4 rounded-2xl bg-[#F8FAFC] border border-[#EAF0F6] flex items-center justify-center overflow-hidden">
            <Image
              src={showcaseImage}
              alt={project.title}
              fill
              sizes="(max-width: 1200px) 90vw, 900px"
              className="object-contain p-6"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5D6B7B] pt-2 border-t border-[#EAF0F6]">
            <span>
              Sector: <strong className="text-[#102D4D]">{project.sector}</strong>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLightboxOpen(false)}
            >
              Close Lightbox
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BOQ Consultation & Quote Request Dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-lg p-6 sm:p-8 bg-white border border-[#EAF0F6] rounded-3xl">
          <DialogHeader>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#079D9A]">
              Project Estimation Intake
            </span>
            <DialogTitle className="font-display text-xl font-bold text-[#102D4D]">
              Request Similar Project BOQ
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5D6B7B]">
              Reference: <strong>{project.title}</strong> ({packageCode})
            </DialogDescription>
          </DialogHeader>

          {quoteSubmitted ? (
            <div className="py-6 space-y-4">
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>BOQ Request Logged</AlertTitle>
                <AlertDescription>
                  Thank you, <strong>{quoteForm.name}</strong>. Your inquiry for{" "}
                  <strong>{project.title}</strong> has been logged with our Trichy technical desk.
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                className="w-full sa-btn-gradient text-white font-semibold"
                onClick={() => {
                  setQuoteSubmitted(false);
                  setQuoteDialogOpen(false);
                }}
              >
                Close Dialog
              </Button>
            </div>
          ) : (
            <form onSubmit={handleQuoteSubmit} noValidate className="space-y-4 pt-2">
              {quoteError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{quoteError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Full Name" htmlFor="p-name" required>
                  <Input
                    id="p-name"
                    required
                    value={quoteForm.name}
                    onChange={(e) => setQuoteForm({ ...quoteForm, name: e.target.value })}
                    placeholder="Your name"
                  />
                </FormField>
                <FormField label="Your Role" htmlFor="p-role">
                  <Select
                    value={quoteForm.role}
                    onValueChange={(val) => setQuoteForm({ ...quoteForm, role: val })}
                  >
                    <SelectTrigger id="p-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Organization / Shop / Firm" htmlFor="p-org">
                  <Input
                    id="p-org"
                    value={quoteForm.organization}
                    onChange={(e) => setQuoteForm({ ...quoteForm, organization: e.target.value })}
                    placeholder="Shop, firm, or company name"
                  />
                </FormField>
                <FormField label="Project City / District" htmlFor="p-city">
                  <Input
                    id="p-city"
                    value={quoteForm.city}
                    onChange={(e) => setQuoteForm({ ...quoteForm, city: e.target.value })}
                    placeholder="e.g. Trichy, Madurai, Salem"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Phone Number" htmlFor="p-phone" required>
                  <Input
                    id="p-phone"
                    type="tel"
                    required
                    value={quoteForm.phone}
                    onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })}
                    placeholder="+91 98XXX XXXXX"
                  />
                </FormField>
                <FormField label="Work Email" htmlFor="p-email">
                  <Input
                    id="p-email"
                    type="email"
                    value={quoteForm.email}
                    onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                    placeholder="name@company.com"
                  />
                </FormField>
              </div>

              <FormField label="Project Scope / Aperture Counts" htmlFor="p-notes">
                <Textarea
                  id="p-notes"
                  rows={3}
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  placeholder="Share door count, glass thickness, extrusion lengths, or project completion schedule..."
                />
              </FormField>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuoteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={quoteSubmitting}
                  className="sa-btn-gradient text-white font-bold"
                >
                  {quoteSubmitting ? "Submitting..." : "Submit BOQ Request"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
