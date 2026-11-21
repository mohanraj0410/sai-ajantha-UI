import type { Metadata } from "next";
import localFont from "next/font/local";
import { CartDrawer } from "@/components/CartDrawer";
import { SmoothScroll } from "@/components/SmoothScroll";
import { StoreProvider } from "@/components/StoreProvider";
import { BRAND_CONTACT } from "@/lib/brand";
import { serializeJsonLd } from "@/lib/security";
import "./globals.css";

const poppins = localFont({
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

const muktaMalar = localFont({
  src: [
    { path: "./fonts/mukta-400-tamil.woff2", weight: "400", style: "normal" },
    { path: "./fonts/mukta-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/mukta-600-tamil.woff2", weight: "600", style: "normal" },
    { path: "./fonts/mukta-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/mukta-700-tamil.woff2", weight: "700", style: "normal" },
    { path: "./fonts/mukta-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mukta",
  display: "swap",
  fallback: ["Noto Sans Tamil", "Anek Tamil", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_CONTACT.websiteUrl),
  icons: {
    icon: [
      { url: "/Sai_Ajantha_Favicon.ico", type: "image/x-icon" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: ["/Sai_Ajantha_Favicon.ico"],
    apple: [
      { url: "/Sai_Ajantha_Favicon.ico" },
    ],
  },
  title: {
    default: `${BRAND_CONTACT.companyName} | ${BRAND_CONTACT.tagline}`,
    template: `%s | ${BRAND_CONTACT.shortName}`,
  },
  description:
    "Direct Architectural Hardware, Insect Screens & Extruded Aluminium Profiles across Trichy and Tamil Nadu since 1994. Heavy-duty door closers, floor springs, partition sections, and kitchen fittings.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: BRAND_CONTACT.websiteUrl,
    siteName: BRAND_CONTACT.companyName,
    title: `${BRAND_CONTACT.companyName} | ${BRAND_CONTACT.tagline}`,
    description:
      "Architectural Hardware, Finished Insect Screens & Aluminium Sections in Trichy and Tamil Nadu since 1994.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_CONTACT.companyName} | ${BRAND_CONTACT.tagline}`,
    description:
      "Architectural Hardware, Finished Insect Screens & Aluminium Sections in Trichy and Tamil Nadu since 1994.",
  },
};

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND_CONTACT.companyName,
  url: BRAND_CONTACT.websiteUrl,
  email: BRAND_CONTACT.email,
  telephone: BRAND_CONTACT.phone,
  foundingDate: BRAND_CONTACT.foundedYear,
  taxID: BRAND_CONTACT.gstin,
  address: {
    "@type": "PostalAddress",
    streetAddress: "No 32 A/6, Ramamurthy Nagar, Karur By-pass Road",
    addressLocality: "Tiruchirappalli",
    addressRegion: "Tamil Nadu",
    postalCode: "620003",
    addressCountry: "IN",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${muktaMalar.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[#153C66] selection:bg-[#12878F] selection:text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2.5 focus:bg-[#102D4D] focus:text-white focus:font-medium focus:text-sm focus:rounded-lg focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#079D9A]"
        >
          Skip to main content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(ORGANIZATION_SCHEMA),
          }}
        />
        <StoreProvider>
          <SmoothScroll />
          {children}
          <CartDrawer />
        </StoreProvider>
      </body>
    </html>
  );
}
