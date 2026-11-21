"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StateFeedback } from "@/components/StateFeedback";
import type { ProjectCaseStudy } from "@/lib/solutionsAndProjects";

export function ProjectsExplorer({ projects }: { projects: readonly ProjectCaseStudy[] }) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const categories = [...new Set(projects.map((project) => project.category))];
  const query = search.toLowerCase().trim();
  const filtered = projects.filter((project) =>
    (category === "All" || project.category === category) &&
    [project.title, project.sector, project.category, ...project.systemsUsed].some(item => item.toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-5">
      <div className="sa-detail-panel flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-4 sm:p-5">
        <div className="space-y-2">
          <p className="sa-group-label" id="reference-types">Type of space</p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="reference-types">
            {["All", ...categories].map(item => (
              <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}
                className="min-h-10 cursor-pointer rounded-lg border border-[#dce5ec] px-3 text-sm font-medium hover:border-[#076864] aria-pressed:bg-[#0b1f35] aria-pressed:text-white">
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="relative sm:max-w-64">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4" />
          <Input type="search" aria-label="Search project examples" placeholder="Search examples" value={search} onChange={event => setSearch(event.target.value)} className="bg-white pl-9" />
        </div>
      </div>
      <p role="status" className="text-sm font-medium">{filtered.length} {filtered.length === 1 ? "example" : "examples"}</p>
      {filtered.length === 0 ? (
        <StateFeedback kind="empty" title="No examples found" description="Try a different search." actionLabel="Clear filters" onAction={() => { setSearch(""); setCategory("All"); }} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {filtered.map(project => (
            <article key={project.slug} className="sa-reference-card sa-enter flex flex-col">
              <Link href={`/projects/${project.slug}`} className="group relative aspect-[16/8] overflow-hidden bg-[#edf3f7]" aria-label={`View ${project.title}`}>
                <Image src={project.image} alt="" fill sizes="(max-width: 640px) 100vw, 50vw" className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.03]" />
              </Link>
              <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                <p className="sa-group-label">{project.category}</p>
                <h3 className="text-xl font-semibold text-[#0b1f35]">{project.title}</h3>
                <p className="text-sm">{project.systemsUsed.join(" · ")}</p>
                <Link className="mt-auto inline-flex min-h-10 w-fit items-center gap-2 font-semibold text-[#076864] underline-offset-4 hover:underline" href={`/projects/${project.slug}`}>View example <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
