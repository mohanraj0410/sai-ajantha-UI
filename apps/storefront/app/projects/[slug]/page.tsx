import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProjectDetailView } from "@/components/ProjectDetailView";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import {
  fetchMedusaCatalogStrict,
  medusaCatalogProductToProductItem,
} from "@/lib/server/medusa";
import { FEATURED_PROJECTS } from "@/lib/solutionsAndProjects";

interface ProjectDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return FEATURED_PROJECTS.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: ProjectDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = FEATURED_PROJECTS.find((p) => p.slug === slug);
  if (!project) return { title: "Project Not Found" };

  return {
    title: `${project.title} | Sai Ajantha Projects`,
    description: "A planning example for selecting hardware and fittings. This is not a completed project.",
    alternates: { canonical: `/projects/${project.slug}` },
  };
}

async function ProjectDetailContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currentIndex = FEATURED_PROJECTS.findIndex((p) => p.slug === slug);
  if (currentIndex === -1) notFound();

  const project = FEATURED_PROJECTS[currentIndex];
  const prevProject =
    FEATURED_PROJECTS[
      (currentIndex - 1 + FEATURED_PROJECTS.length) % FEATURED_PROJECTS.length
    ];
  const nextProject =
    FEATURED_PROJECTS[(currentIndex + 1) % FEATURED_PROJECTS.length];


  await connection();
  const catalogRes = await fetchMedusaCatalogStrict();
  const relatedItems = catalogRes.ok
    ? catalogRes.products
        .map((mp) => medusaCatalogProductToProductItem(mp, mp.customerPriceInr))
        .filter((p) => project.systemsUsed.includes(p.category))
        .slice(0, 4)
    : [];

  return (
  
    <ProjectDetailView
      project={project}
      prevProject={prevProject}
      nextProject={nextProject}
      relatedItems={relatedItems}
    />
  );
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  return (
    <StorefrontSurface family="content">
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollProgressBar />
      <Header />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="p-16 text-center text-sm text-[#7B8896]">
              Loading project scope...
            </div>
          }
        >
          <ProjectDetailContent params={params} />
        </Suspense>
      </main>
      <Footer />
    </div>
    </StorefrontSurface>
  );
}
