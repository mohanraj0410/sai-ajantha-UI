import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { BRAND_CONTACT } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Shipping & Return Policy | Sai Ajantha Interior Solutions",
  description: "Site dispatch, freight coordination, and lot replacement policy for Sai Ajantha Interior Solutions.",
  alternates: { canonical: "/shipping-policy" },
};

export default function ShippingPolicyPage() {
  return (
    <StorefrontSurface family="legal">
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <PageHeader title="Shipping and returns" section="Store policies" description="Delivery coordination, freight terms, and transit inspection guidelines." />
        <div className="sa-content-width py-7 sm:py-10">
          <article className="sa-card max-w-3xl mx-auto p-6 sm:p-9 space-y-5 text-sm leading-relaxed text-[#3D4F63]">
            <p className="text-xs font-medium text-[#5D6F82]">
              Dispatch Hub: {BRAND_CONTACT.address}
            </p>
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-[#0B1F35] pt-2">
                Site Dispatch &amp; Logistics
              </h2>
              <p>
                Material dispatch across {BRAND_CONTACT.serviceArea} is coordinated from our
                Trichy hub according to agreed project timelines and BOQ delivery schedules.
                Freight charges depend on order volume, extrusion lengths, and site location.
              </p>
              <h2 className="font-display text-lg font-bold text-[#0B1F35] pt-2">
                Inspection &amp; Replacement
              </h2>
              <p>
                Any transit damage or specification discrepancy must be reported upon site
                receipt with invoice reference and supporting photos/video to{" "}
                <a href={`mailto:${BRAND_CONTACT.email}`} className="font-semibold text-[#076864] underline">
                  {BRAND_CONTACT.email}
                </a>{" "}
                or {BRAND_CONTACT.phone}.
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

