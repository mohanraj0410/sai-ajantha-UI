"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND_CONTACT } from "@/lib/brand";
import { BrandLogo } from "./BrandLogo";

const MAIN_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop by Category", href: "/products" },
  { label: "House of Ajantha", href: "/#house-of-ajantha" },
  { label: "About Sai Ajantha", href: "/about" },
  { label: "Contact Us", href: "/contact" },
] as const;

/**
 * 9 Direct-Sale Product Categories
 */
const FOOTER_DIRECT_SALE_CATEGORIES = [
  { label: "Finished Insect Screens", href: "/products?category=Insect+Screens" },
  { label: "Aluminium Sections", href: "/products?category=Aluminium" },
  { label: "Hardware & Accessories", href: "/products?category=Hardware" },
  { label: "Ladders", href: "/products?category=Ladder" },
  { label: "Rubber & PVC Beading", href: "/products?category=Rubber+%26+PVC" },
  { label: "FGM Fittings & Channels", href: "/products?category=FGM+Fittings" },
  { label: "Clips & Fasteners", href: "/products?category=Clip" },
  { label: "Frames & Channels", href: "/products?category=Frames+%26+Channels" },
  { label: "Mesh & Screening", href: "/products?category=Mesh" },
] as const;

/**
 * House of Ajantha Ranges (Distributor Route)
 */
const FOOTER_HOUSE_OF_AJANTHA = [
  {
    label: "Door Closers & Floor Springs",
    href: "/products?category=Door+Closer+%26+Floor+Spring",
  },
  {
    label: "Kitchen Baskets & Wireware",
    href: "/products?category=Kitchen+Basket",
  },
] as const;

const PARTNER_LINKS = [
  { label: "Apply as Dealer", href: "/register?type=dealer" },
  { label: "Apply as Distributor", href: "/register?type=distributor" },
  { label: "Trade Partner Login", href: "/login" },
  { label: "Saved BOQ Shortlist", href: "/wishlist" },
] as const;

const POLICY_LINKS = [
  { label: "Return Policy", href: "/return-policy" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms" },
] as const;

/**
 * Checklist Requirement 4 & Phase 04 Section 10:
 * Redesigned Modern Architectural Footer:
 * - Refactored 5-column layout with spacious rhythm
 * - Sai Ajantha official logo on dark surface
 * - 9 direct-sale categories + House of AjantHa distinction
 * - Verified business contact channels
 * - Accessible hover/focus & smooth Back to Top action
 */
export function Footer() {
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <footer className="relative bg-[#071524] text-white border-t border-white/10 font-sans overflow-hidden">
      {/* Top Luminous Cyan Architectural Rule */}
      <div
        aria-hidden="true"
        className="h-1 bg-gradient-to-r from-transparent via-[#24C6D0]/60 to-transparent"
      />

      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12 pt-16 pb-10 space-y-12">
        {/* Top Grid: 5 Structured Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 pb-12 border-b border-white/10">
          {/* Column 1: Brand & Identity (4 Cols) */}
          <div className="lg:col-span-4 space-y-5">
            <BrandLogo surface="onDark" size="md" />

            <p className="text-xs sm:text-sm text-[#C6CAD5] leading-relaxed max-w-sm">
              Sai Ajantha Interior Solutions is a premier architectural hardware
              and insect screens supplier serving homeowners, commercial complexes,
              fabricators, builders, and trade partners across Tiruchirappalli and
              Tamil Nadu since {BRAND_CONTACT.foundedYear}.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href="https://wa.me/919842406588?text=Hello%20Sai%20Ajantha%20Team%2C%20I%20have%20an%20interior%20solutions%20enquiry."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366] text-white border border-[#25D366]/40 px-3.5 py-2 text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-98 group"
              >
                <MessageCircle className="size-4 text-[#25D366] group-hover:text-white transition-colors" />
                <span>WhatsApp Desk</span>
                <ExternalLink className="size-3 opacity-70" />
              </a>

              <a
                href={BRAND_CONTACT.phoneHref}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 px-3.5 py-2 text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-98"
              >
                <Phone className="size-4 text-[#24C6D0]" />
                <span>{BRAND_CONTACT.phone}</span>
              </a>
            </div>
          </div>

          {/* Column 2: Navigation (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-[#24C6D0]">
              Navigation
            </h3>
            <ul className="space-y-2.5">
              {MAIN_NAV_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-xs text-[#C6CAD5] hover:text-[#24C6D0] hover:translate-x-0.5 transition-all inline-block"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: 9 Direct-Sale Product Categories (3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-[#24C6D0]">
              Direct Categories (9)
            </h3>
            <ul className="space-y-2">
              {FOOTER_DIRECT_SALE_CATEGORIES.map((cat) => (
                <li key={cat.label}>
                  <Link
                    href={cat.href}
                    className="text-xs text-[#C6CAD5] hover:text-white hover:underline underline-offset-4 transition-colors"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: House of Ajantha & Trade Network (3 Cols) */}
          <div className="lg:col-span-3 space-y-5">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-[#24C6D0]">
                House of Ajantha
              </h3>
              <ul className="space-y-2 mt-3">
                {FOOTER_HOUSE_OF_AJANTHA.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-xs text-[#C6CAD5] hover:text-[#24C6D0] transition-colors block"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li className="pt-1 text-[11px] text-[#24C6D0] font-medium flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#24C6D0]" />
                  <span>Distributor Sales Route</span>
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-white/10">
              <h3 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-[#24C6D0]">
                Trade Network
              </h3>
              <ul className="space-y-2 mt-3">
                {PARTNER_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-[#C6CAD5] hover:text-[#24C6D0] transition-colors inline-flex items-center gap-1.5"
                    >
                      <span>{link.label}</span>
                      <ArrowRight className="size-3 text-[#24C6D0]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Contact Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#C6CAD5] pb-6 border-b border-white/10">
          <div className="flex items-start gap-3">
            <MapPin className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Central Warehouse &amp; Facility</p>
              <p className="mt-0.5 leading-relaxed">{BRAND_CONTACT.address}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Technical Consultation &amp; BOQ</p>
              <a href={`mailto:${BRAND_CONTACT.email}`} className="mt-0.5 block hover:text-white transition-colors">
                {BRAND_CONTACT.email}
              </a>
              <p className="text-[11px] text-[#A8B4C2] mt-0.5">Direct engineering &amp; sales desk</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Official Channels &amp; Seller Clarity</p>
              <p className="mt-0.5 text-[#C6CAD5] text-[11px]">Each order shows the responsible seller &amp; return terms before payment.</p>
              <p className="text-[11px] text-[#24C6D0] mt-0.5">Official Social Channels: Confirm via WhatsApp / Email</p>
            </div>
          </div>
        </div>

        {/* Bottom Tier: Policies, Copyright & Back to Top */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A8B4C2]">
          <p className="text-center sm:text-left">
            &copy; 2026 {BRAND_CONTACT.companyName}. All rights reserved. Central Hub: Tiruchirappalli, Tamil Nadu.
          </p>

          <div className="flex flex-wrap items-center gap-5 text-xs">
            {POLICY_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="hover:text-white hover:underline underline-offset-4 transition-colors"
              >
                {item.label}
              </Link>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={scrollToTop}
              className="border-white/20 bg-white/5 text-white hover:bg-[#24C6D0] hover:text-[#0B1F35] transition-all rounded-xl ml-2 cursor-pointer hover:scale-[1.03] active:scale-95"
            >
              <span>Back to Top</span>
              <ArrowUp className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
