import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { BRAND_CONTACT } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms & Conditions | Sai Ajantha Interior Solutions",
  description: "Commercial quotation, supply, and warranty terms for Sai Ajantha Interior Solutions.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <StorefrontSurface family="legal">
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <PageHeader title="Terms and conditions" section="Store policies" description="Commercial quotation, supply, and warranty terms." />
        <div className="sa-content-width py-7 sm:py-10">
          <article className="sa-card max-w-3xl mx-auto p-6 sm:p-9 space-y-5 text-sm leading-relaxed text-[#3D4F63]">
            <p className="text-xs font-medium text-[#5D6F82]">
              {BRAND_CONTACT.companyName} · {BRAND_CONTACT.address}
            </p>
            <div className="rounded-xl border border-[#F3D18E] bg-[#FFFBEB] px-4 py-3 text-xs text-[#78350F]">
              <strong>Draft Legal Notice (Pending Owner Sign-Off):</strong> Final seller
              billing terms, payment settlement rules, and SKU-level warranty schedules await owner approval.
            </div>
            <div className="space-y-4">
              <p>
                All product listings, technical datasheets, and list prices published on{" "}
                {BRAND_CONTACT.website} are subject to formal BOQ confirmation, stock
                availability, and applicable GST invoicing.
              </p>
              <h2 className="font-display text-lg font-bold text-[#0B1F35] pt-2">
                Specifications &amp; Quotations
              </h2>
              <p>
                Final pricing for custom extrusion cut-lengths, site installation packages,
                and institutional projects is confirmed via written proforma quotation issued
                by our Trichy Head Office.
              </p>
              <h2 className="font-display text-lg font-bold text-[#0B1F35] pt-2">
                Warranty Scope
              </h2>
              <p>
                Where applicable (including approved hydraulic door closers and floor springs),
                manufacturing defect warranty requires the original tax invoice and product
                inspection video, and excludes incorrect installation, misuse, or physical damage.
              </p>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
    </StorefrontSurface>
  );
}
