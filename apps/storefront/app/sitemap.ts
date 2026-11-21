import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { BRAND_CONTACT } from "@/lib/brand";
import { fetchMedusaCatalogStrict } from "@/lib/server/medusa";
import { FEATURED_PROJECTS, SOLUTIONS } from "@/lib/solutionsAndProjects";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const baseUrl = BRAND_CONTACT.websiteUrl;
  const staticRoutes = [
    "",
    "/about",
    "/solutions",
    "/products",
    "/projects",
    "/contact",
    "/search",
    "/wishlist",
    "/privacy-policy",
    "/terms",
    "/shipping-policy",
    "/return-policy",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));

  const solutionRoutes = SOLUTIONS.map((sol) => ({
    url: `${baseUrl}/solutions/${sol.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  const projectRoutes = FEATURED_PROJECTS.map((proj) => ({
    url: `${baseUrl}/projects/${proj.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const catalogRes = await fetchMedusaCatalogStrict();
  const productRoutes = catalogRes.ok
    ? catalogRes.products.map((prod) => ({
        url: `${baseUrl}/products/${prod.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
    : [];

  return [...staticRoutes, ...solutionRoutes, ...projectRoutes, ...productRoutes];
}
