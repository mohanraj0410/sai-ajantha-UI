import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { BRAND_CONTACT } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy | Sai Ajantha Interior Solutions",
  description: "Privacy and enquiry data handling policy for Sai Ajantha Interior Solutions.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <StorefrontSurface family="legal">
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <PageHeader title="Privacy policy" section="Store policies" description="How we handle personal and project information." />
        <div className="sa-content-width py-7 sm:py-10">
          <article className="sa-card max-w-3xl mx-auto p-6 sm:p-9 space-y-5 text-sm leading-relaxed text-[#3D4F63]">
            <p className="text-xs font-medium text-[#5D6F82]">
              {BRAND_CONTACT.companyName} · {BRAND_CONTACT.address}
            </p>
            <div className="rounded-xl border border-[#F3D18E] bg-[#FFFBEB] px-4 py-3 text-xs text-[#78350F]">
              <strong>Draft Legal Notice (Pending Owner Sign-Off):</strong> Statutory GSTIN,
              data officer details, and binding privacy terms will be finalized upon owner legal confirmation.
            </div>
            <div className="space-y-4">
              <p>
                {BRAND_CONTACT.companyName} respects the confidentiality of project drawings,
                commercial and residential BOQ schedules, and contact details shared through our
                digital catalogue and consultation forms.
              </p>
              <h2 className="font-display text-lg font-bold text-[#0B1F35] pt-2">
                Information Collected
              </h2>
              <p>
                When you submit a consultation enquiry, sample dispatch request, or BOQ
                order, we collect only the contact, organization, GSTIN, and site delivery
                details required to prepare technical recommendations, quotations, and
                statutory tax invoices.
              </p>
              <h2 className="font-display text-lg font-bold text-[#0B1F35] pt-2">
                Use &amp; Retention
              </h2>
              <p>
                Information is used exclusively for project coordination, warranty servicing,
                and trade desk communication. For data access or updates, write to{" "}
                <a href={`mailto:${BRAND_CONTACT.email}`} className="font-semibold text-[#076864] underline">
                  {BRAND_CONTACT.email}
                </a>.
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

