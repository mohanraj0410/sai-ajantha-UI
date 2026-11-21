import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Compass,
  HardHat,
  Home,
  Store,
} from "lucide-react";
import { ContactDeskForm } from "@/components/ContactDeskForm";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";

export const metadata: Metadata = {
  title: "Contact Us | Sai Ajantha Interior Solutions",
  description:
    "Get expert support, product details, pricing, samples or a custom BOQ. Our team is here to help you choose the right solutions.",
  alternates: { canonical: "/contact" },
};

const COORDINATION_DESKS = [
  {
    title: "Homeowners & Shop Owners",
    detail:
      "Choose the right interior hardware and space solutions for your home, shop or renovation needs.",
    // Exact icon 1: House outline
    icon: Home,
  },
  {
    title: "Architects & Consultants",
    detail:
      "Get product specifications, technical guidance and compliant solutions for your designs.",
    // Exact icon 2: Drafting compass / calipers
    icon: Compass,
  },
  {
    title: "Builders & Project Heads",
    detail:
      "Project-wise product selection, BOQ support and reliable supply for smooth execution.",
    // Exact icon 3: High-rise building / architectural block
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
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01" />
        <path d="M16 6h.01" />
        <path d="M12 6h.01" />
        <path d="M12 10h.01" />
        <path d="M12 14h.01" />
        <path d="M16 10h.01" />
        <path d="M16 14h.01" />
        <path d="M8 10h.01" />
        <path d="M8 14h.01" />
      </svg>
    ),
  },
  {
    title: "Dealers & Fabricators",
    detail:
      "Trade enquiries, bulk pricing, sample support and long-term business collaboration.",
    // Exact icon 4: Factory / warehouse building with sawtooth roof
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
        <path d="M2 20h20" />
        <path d="M20 20V8l-6 4V8l-6 4V4H2v16" />
        <path d="M6 8h.01" />
        <path d="M6 12h.01" />
        <path d="M6 16h.01" />
      </svg>
    ),
  },
] as const;

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#102D4D]">
      <ScrollProgressBar />
      <Header />

      <main className="flex-1">
        {/* ========================================================= */}
        {/* HERO SECTION - PIXEL PERFECT TO REFERENCE DESIGN          */}
        {/* ========================================================= */}
        <section className="relative overflow-hidden bg-[#012538] text-white">
          {/* Background banner image aligned to the right side */}
          <div className="absolute inset-y-0 right-0 w-full lg:w-[62%] pointer-events-none select-none">
            <Image
              src="/contact-banner.jpg"
              alt="Sai Ajantha Architectural Showroom & Consultation Desk"
              fill
              priority
              className="object-cover object-right"
              sizes="(min-width: 1024px) 62vw, 100vw"
            />
            {/* Smooth dark blue gradient overlay on the left */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, #012538 0%, rgba(1, 37, 56, 0.95) 24%, rgba(1, 37, 56, 0.62) 48%, rgba(1, 37, 56, 0.12) 100%)",
              }}
            />
          </div>

          {/* Cyan angled geometric accent stripe at bottom center */}
          <div
            className="hidden lg:block absolute bottom-0 left-[34%] w-[190px] h-[6px] pointer-events-none z-10"
            style={{
              background: "linear-gradient(90deg, #00A79F 0%, #24C6D0 100%)",
              transform: "skewX(-36deg)",
              boxShadow: "0 0 16px rgba(0, 167, 159, 0.65)",
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-12 lg:py-14">
            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="flex items-center gap-1.5 text-xs text-[#95B2C8]">
                <li className="flex items-center gap-1">
                  <Home className="h-3.5 w-3.5 text-[#95B2C8]" />
                  <Link href="/" className="hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                <li className="text-[#6285A0]">&gt;</li>
                <li className="text-[#E0EBF3] font-medium" aria-current="page">
                  Contact Us
                </li>
              </ol>
            </nav>

            {/* Hero Copy */}
            <div className="max-w-xl">
              <span className="block text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.2em] text-[#00D0C7]">
                CONTACT US
              </span>
              <h1 className="mt-2 text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white leading-[1.12]">
                Let&apos;s Talk About
                <br />
                Your Project
              </h1>
              <p className="mt-3 text-xs sm:text-[13px] text-[#C2D4E4] leading-relaxed max-w-lg">
                Get expert support, product details, pricing, samples or a custom
                BOQ. Our team is here to help you choose the right solutions.
              </p>

              <div className="mt-6">
                <a
                  href="#consultation-form"
                  className="inline-flex items-center gap-2 rounded-full bg-[#00A79F] hover:bg-[#008f88] text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md shadow-[#00a79f]/20 transition-all hover:gap-3 cursor-pointer"
                >
                  <span>Send an Enquiry</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* MAIN WORKBENCH SECTION (Cards & Interactive BOQ Form)     */}
        {/* ========================================================= */}
        <section id="consultation-form" className="py-9 sm:py-12 bg-white">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
            <ContactDeskForm />
          </div>
        </section>

        {/* ========================================================= */}
        {/* HOW WE CAN HELP - 4 AUDIENCE COLUMNS                      */}
        {/* ========================================================= */}
        <section
          className="py-12 sm:py-16 border-t border-[#E8EFF5]"
          style={{
            background:
              "linear-gradient(180deg, #FFFFFF 0%, #F5F9FD 35%, #EAF3FA 100%)",
          }}
        >
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header: Title left, subtext right */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-9">
              <div>
                <span className="block text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#00A79F]">
                  SOLUTIONS FOR EVERY PROJECT
                </span>
                <h2 className="mt-1 text-2xl sm:text-[28px] font-extrabold text-[#102D4D]">
                  How We Can Help
                </h2>
              </div>
              <p className="max-w-md text-xs sm:text-[13px] text-[#5C6E82] leading-relaxed">
                Whether you&apos;re planning a new project, sourcing the right products or
                need technical guidance, our team is ready to support you.
              </p>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              {COORDINATION_DESKS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="group bg-white rounded-2xl p-6 sm:p-7 border border-[#E3ECF3] shadow-[0_2px_12px_rgba(16,45,77,0.04)] hover:shadow-[0_8px_24px_rgba(0,167,159,0.12)] transition-all duration-300 flex flex-col items-start"
                  >
                    {/* Teal Pill Icon Container */}
                    <div className="h-11 w-11 rounded-xl bg-[#E8F8F7] border border-[#C6ECE9] flex items-center justify-center text-[#00A79F] group-hover:scale-105 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>

                    <h3 className="mt-5 text-[15px] font-bold text-[#102D4D] leading-snug">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs text-[#627589] leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
