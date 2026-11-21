"use client";

import Link from "next/link";
import { ArrowRight, Check, Store, Users } from "lucide-react";

export function DealerDistributorCTASection() {
  return (
    <section
      id="partner-registration"
      aria-labelledby="partner-heading"
      className="relative overflow-hidden bg-gradient-to-b from-[#F4F9FB] via-[#EDF8F7] to-[#E5F6F4] py-16 sm:py-22"
    >
      {/* Smooth Flowing Aqua Side Wave Accents matching target design */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-[#14D5C6]/18 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-8 h-80 w-80 rounded-full bg-[#14D5C6]/18 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 space-y-10">
        {/* Centered Header */}
        <div className="mx-auto max-w-2xl text-center space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#00A89A]">
            Partner With Us
          </p>
          <h2
            id="partner-heading"
            className="font-display text-3xl sm:text-[38px] font-extrabold tracking-tight text-[#071E36] leading-tight"
          >
            Grow Your Business With Sai Ajantha
          </h2>
          <p className="text-sm text-[#5B7086] leading-relaxed">
            Expand your portfolio with a trusted and growing range of architectural hardware and
            interior solutions. Partner with us as a dealer or distributor (admin approval
            required).
          </p>
        </div>

        {/* Centered 2-Column Side-by-Side Role Cards: White Dealer Card vs Dark Navy Distributor Card */}
        <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Dealer (Clean White) */}
          <article className="rounded-2xl border border-[#DCE8F0] bg-white p-7 sm:p-8 shadow-[0_14px_34px_-16px_rgba(7,26,47,0.14)] flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="flex items-start gap-3.5">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E2F7F5] text-[#009688]">
                  <Users className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-[#071E36]">
                    Apply to Become a Dealer
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    For hardware counters, fabricators &amp; contractors
                  </p>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs sm:text-[13px] text-[#475569] pl-1">
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-[#00A89A] shrink-0" />
                  <span>Access to approved dealer pricing across 9 direct categories</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-[#00A89A] shrink-0" />
                  <span>Project BOQ tools &amp; Trichy technical support</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-[#00A89A] shrink-0" />
                  <span>Dedicated Dealer Portal &amp; priority dispatch</span>
                </li>
              </ul>
            </div>

            <div className="pt-2 flex flex-col items-center gap-2.5">
              <Link
                href="/register?type=dealer"
                className="group w-full sm:w-auto min-w-[210px] min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full border border-[#CBD8E4] bg-white px-6 text-xs font-bold text-[#071E36] hover:border-[#00A89A] hover:text-[#009688] transition-colors"
              >
                <span>Apply to Become a Dealer</span>
                <ArrowRight className="size-3.5 text-[#00A89A] transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login?role=DEALER"
                className="text-[11px] font-semibold text-[#5B7086] hover:text-[#009688] transition-colors"
              >
                Already approved? Sign in &rarr;
              </Link>
            </div>
          </article>

          {/* Card 2: Distributor (Deep Navy) */}
          <article className="rounded-2xl border border-[#163B5E] bg-gradient-to-br from-[#071D35] via-[#0A2746] to-[#0E3459] text-white p-7 sm:p-8 shadow-[0_16px_38px_-16px_rgba(7,26,47,0.38)] flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="flex items-start gap-3.5">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#14D5C6]">
                  <Store className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Apply to Become a Distributor
                  </h3>
                  <p className="mt-0.5 text-xs text-[#9BB3C9]">
                    For regional House of Ajantha stockists
                  </p>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs sm:text-[13px] text-[#DCE7F2] pl-1">
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-[#14D5C6] shrink-0" />
                  <span>Exclusive PIN territory coverage opportunities in your region</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-[#14D5C6] shrink-0" />
                  <span>Priority stock allocation, Buy Stock POs &amp; UTR tracking</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="size-4 text-[#14D5C6] shrink-0" />
                  <span>Long-term, growth-focused wholesale partnership</span>
                </li>
              </ul>
            </div>

            <div className="pt-2 flex flex-col items-center gap-2.5">
              <Link
                href="/register?type=distributor"
                className="group w-full sm:w-auto min-w-[220px] min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00A89A] to-[#12CFC0] px-6 text-xs font-bold text-white shadow-[0_8px_20px_-8px_rgba(0,196,180,0.75)] hover:from-[#009386] hover:to-[#00B8A9] transition-all"
              >
                <span>Apply to Become a Distributor</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login?role=DISTRIBUTOR"
                className="text-[11px] font-semibold text-[#9BB3C9] hover:text-[#14D5C6] transition-colors"
              >
                Already approved? Sign in &rarr;
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
