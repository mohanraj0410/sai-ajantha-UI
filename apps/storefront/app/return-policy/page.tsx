import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { BRAND_CONTACT } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Return Policy | Sai Ajantha Interior Solutions",
  description:
    "Inspection, return, and replacement terms for materials supplied by Sai Ajantha Interior Solutions from Tiruchirappalli, Tamil Nadu.",
  alternates: { canonical: "/return-policy" },
};

export default function ReturnPolicyPage() {
  return (
    <StorefrontSurface family="legal">
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <PageHeader title="Return policy" section="Store policies" description="Seller-scoped return routing, inspection rules, and custom-cut extrusion exclusions." />
        <div className="sa-content-width py-7 sm:py-10">
          <article className="sa-card max-w-3xl mx-auto p-6 sm:p-9 space-y-5 text-sm leading-relaxed text-[#3D4F63]">
            <p className="text-xs font-medium text-[#5D6F82]">
              Central Dispatch Hub: {BRAND_CONTACT.address} &middot; Tiruchirappalli, Tamil Nadu
            </p>
            <div className="rounded-xl border border-[#F3D18E] bg-[#FFFBEB] px-4 py-3 text-xs text-[#78350F]">
              <strong>Draft Policy Notice (Pending Owner Legal Sign-Off):</strong> Final
              return windows, restocking fees, and cancellation cutoffs await legal approval
              from the Sai Ajantha management team.
            </div>

            <div className="space-y-6 pt-4 border-t border-[#E8EDF3]">
              <section className="space-y-2">
                <h2 className="font-display text-lg font-bold text-[#0B1F35]">
                  1. Seller-Scoped Return Routing &amp; Material Inspection
                </h2>
                <p>
                  Returns and defect replacements are handled strictly by the{" "}
                  <strong>seller shown on your order</strong> (either Sai Ajantha Direct for
                  our 9 direct supply lines, or the assigned Authorized Distributor for
                  resale orders). Receivers should inspect packaging and surface finish at
                  delivery and note visible transit damage on the delivery challan.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-bold text-[#0B1F35]">
                  2. Defect Reporting &amp; Seller Inspection Required Before Restock
                </h2>
                <p>
                  Defective, damaged, or mismatched items must be submitted for review via
                  your order detail page with invoice reference and photographic evidence, or
                  sent to{" "}
                  <a
                    href={`mailto:${BRAND_CONTACT.email}`}
                    className="font-semibold text-[#076864] underline"
                  >
                    {BRAND_CONTACT.email}
                  </a>{" "}
                  ({BRAND_CONTACT.phone}). Returned stock requires{" "}
                  <strong>mandatory physical inspection by the fulfilling seller</strong>{" "}
                  before any credit note, replacement dispatch, or refund authorization.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-bold text-[#0B1F35]">
                  3. Custom-Cut Extrusions, Insect Screens &amp; Installation Separation
                </h2>
                <p>
                  Aluminium extrusions, insect screens, and mesh cut to client-specific
                  aperture dimensions are non-returnable unless they deviate from the
                  confirmed specification. Site installation, if arranged via an independent
                  fabricator or contractor, is billed and governed separately from material supply.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-bold text-[#0B1F35]">
                  4. Resolution &amp; Site Support
                </h2>
                <p>
                  Approved replacement schedules are confirmed directly by Sai Ajantha (Trichy
                  Hub) or your fulfilling distributor after inspection verification.
                </p>
              </section>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
    </StorefrontSurface>
  );
}
