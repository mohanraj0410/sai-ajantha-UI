import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { ProductCategoryExplorer } from "@/components/ProductCategoryExplorer";
import { HouseOfAjantaSection } from "@/components/HouseOfAjantaSection";
import { AboutCompanySection } from "@/components/AboutCompanySection";
import { CoreValuesSection } from "@/components/CoreValuesSection";
import { WhyChooseSection } from "@/components/WhyChooseSection";
import { ContactEnquirySection } from "@/components/ContactEnquirySection";
import { UsefulArticlesSection } from "@/components/UsefulArticlesSection";
import { DealerDistributorCTASection } from "@/components/DealerDistributorCTASection";
import { Footer } from "@/components/Footer";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { RevealOnScroll } from "@/components/RevealOnScroll";

/**
 * Sai Ajantha Interior Solutions - Modernized Architectural Homepage
 *
 * Implements the official Sai Ajantha Website UI Checklist:
 * 1. Main Navigation: Home, Shop by Category (9 direct-sale), House of Ajantha (distributor route), Contact, Search, Login, Cart
 * 2. Section 01: Hero Section (PROTECTED: 01 OVERVIEW and 02 PROMISE 100% UNCHANGED)
 * 3. Section 02: Shop by Category (Exactly nine direct-sale category tiles)
 * 4. Section 03: House of Ajantha (Dedicated brand showcase for Door Closers & Kitchen Baskets on distributor route)
 * 5. Section 04: About Sai Ajantha (Who we are, what we supply, whom we serve)
 * 6. Section 05: Core Values (Four owner-approved principles)
 * 7. Section 06: Why Sai Ajantha (Evidence-based quality, real product photos, verified specs, warranty terms)
 * 8. Section 07: Contact Information (Phone, WhatsApp, email, physical address, working hours, enquiry desk)
 * 9. Section 08: Useful Articles / Blog (Technical guides, read action, view all guides)
 * 10. Section 09: Dealer & Distributor Registration (Two separate panels & dedicated application forms, strictly pending admin approval)
 * 11. Section 10: Redesigned Modern Footer (Logo, description, main nav, 9 categories, House of Ajantha, contact, return & privacy policies)
 */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollProgressBar />

      {/* 1. Header Navigation */}
      <Header overlayHero />

      <main id="main-content" className="flex-1">
        {/* Section 01: Main Hero (PROTECTED: 01 OVERVIEW & 02 PROMISE EXACTLY AS ORIGINAL) */}
        <HeroSection />

        {/* Section 02: Shop by Category (9 Direct-Sale Categories) */}
        <RevealOnScroll>
          <ProductCategoryExplorer />
        </RevealOnScroll>

        {/* Section 03: House of Ajantha (Door Closers & Kitchen Baskets on Distributor Route) */}
        <RevealOnScroll>
          <HouseOfAjantaSection />
        </RevealOnScroll>

        {/* Section 04: About Sai Ajantha */}
        <RevealOnScroll>
          <AboutCompanySection />
        </RevealOnScroll>

        {/* Section 05: Core Values (4 Owner-Approved Principles) */}
        <RevealOnScroll>
          <CoreValuesSection />
        </RevealOnScroll>

        {/* Section 06: Why Sai Ajantha */}
        <RevealOnScroll>
          <WhyChooseSection />
        </RevealOnScroll>

        {/* Section 07: Contact Information */}
        <RevealOnScroll>
          <ContactEnquirySection />
        </RevealOnScroll>

        {/* Section 08: Blog / Useful Articles */}
        <RevealOnScroll>
          <UsefulArticlesSection />
        </RevealOnScroll>

        {/* Section 09: Dealer & Distributor Registration */}
        <RevealOnScroll>
          <DealerDistributorCTASection />
        </RevealOnScroll>
      </main>

      {/* Section 10: Footer */}
      <Footer />
    </div>
  );
}
