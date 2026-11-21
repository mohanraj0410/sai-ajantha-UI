import type { MetadataRoute } from "next";
import { BRAND_CONTACT } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/account",
        "/account/",
        "/checkout",
        "/checkout/",
        "/cart",
        "/cart/",
        "/dealer",
        "/dealer/",
        "/distributor",
        "/distributor/",
        "/api/",
        "/reset-password",
      ],
    },
    sitemap: `${BRAND_CONTACT.websiteUrl}/sitemap.xml`,
  };
}
