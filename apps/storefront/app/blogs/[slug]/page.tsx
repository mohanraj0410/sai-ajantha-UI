import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { USEFUL_ARTICLES } from "@/lib/articles";

interface BlogDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return USEFUL_ARTICLES.map((a) => ({
    slug: a.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = USEFUL_ARTICLES.find((a) => a.slug === slug);
  if (!article) {
    return { title: "Article Not Found | Sai Ajantha" };
  }
  return {
    title: `${article.title} | Sai Ajantha`,
    description: article.excerpt,
    alternates: { canonical: `/blogs/${article.slug}` },
  };
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const article = USEFUL_ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();

  return (
    <StorefrontSurface family="editorial">
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1">
        <PageHeader title={article.title} section="Product guide" description={article.excerpt} parents={[{ label: "Product guides", href: "/blogs" }]} />
        <article className="sa-legal-body">

          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="teal">{article.category}</Badge>
              <Badge variant="outline">{article.tag}</Badge>
            </div>



            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-[#F8FAFC] border border-[#E8EDF3]">
              <Image
                src={article.imageSrc}
                alt={article.title}
                fill
                sizes="(max-width: 900px) 100vw, 800px"
                className="object-contain p-6"
              />
            </div>

            <div className="space-y-4 text-sm sm:text-base text-[#102D4D] leading-relaxed pt-2">
              {article.content.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            <div className="sa-editorial-links pt-6 border-t border-[#E8EDF3] flex flex-wrap items-center justify-between gap-4">
              <Button asChild variant="outline">
                <Link href="/blogs">
                  <ArrowLeft className="size-4" /> All guides
                </Link>
              </Button>

              <div className="min-w-0 flex flex-wrap gap-3">
                <Button asChild variant="outline-navy">
                  <Link href="/quotes">Ask for a quote</Link>
                </Button>
                <Button asChild variant="teal">
                  <Link href={article.productLink}>
                    Explore {article.relatedCategoryLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
    </StorefrontSurface>
  );
}
