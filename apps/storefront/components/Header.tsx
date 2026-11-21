"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BrandLogo } from "./BrandLogo";
import { ProductSearchModal } from "./ProductSearchModal";
import { useStore } from "./StoreProvider";

interface HeaderProps {
  overlayHero?: boolean;
  showResources?: boolean;
}

const RESOURCE_LINKS = [
  { label: "Guides & Articles", href: "/blogs" },
  { label: "Solutions", href: "/solutions" },
  { label: "Projects", href: "/projects" },
] as const;

/**
 * Checklist Requirement 1:
 * Main menu:
 * - Home
 * - Shop by Category (nine direct-sale categories)
 * - House of Ajantha (Door Closers & Kitchen Baskets on distributor sales route)
 * - Contact
 * Right-side:
 * - Search
 * - Login / Account
 * - Cart
 */
export const NINE_DIRECT_SALE_CATEGORIES = [
  {
    name: "Finished Insect Screens",
    query: "Insect Screens",
    href: "/products?category=Insect+Screens",
    badge: "Vector Barrier",
    img: "/products/finshed-Inset-screens-[SA-IS-duro-pleated-014]-img.jpg",
  },
  {
    name: "Aluminium Sections",
    query: "Aluminium",
    href: "/products?category=Aluminium",
    badge: "Architectural Extrusions",
    img: "/products/Aluminium-[A-Interlock-12-028]-interlock.jpg",
  },
  {
    name: "Hardware",
    query: "Hardware",
    href: "/products?category=Hardware",
    badge: "Fittings & Accessories",
    img: "/products/Hardware-[RA-HW-007]-18-i-max.jpg",
  },
  {
    name: "Ladders",
    query: "Ladder",
    href: "/products?category=Ladder",
    badge: "Industrial Access",
    img: "/products/Ladder-A-type-6-20-A-type-ladder_.jpg",
  },
  {
    name: "Rubber & PVC Beading",
    query: "Rubber & PVC",
    href: "/products?category=Rubber+%26+PVC",
    badge: "Weather Seals",
    img: "/products/Rubber-&PVC-[MA-R-DRubber-005]-Partition-Rubber.jpg",
  },
  {
    name: "FGM Fittings & Channels",
    query: "FGM Fittings",
    href: "/products?category=FGM+Fittings",
    badge: "Frameless Glass",
    img: "/products/FGM-Fittings-[FGM-center-alu-005]-center-aluminium.jpg",
  },
  {
    name: "Clips",
    query: "Clip",
    href: "/products?category=Clip",
    badge: "Precision Fasteners",
    img: "/products/clip-clip.jpg",
  },
  {
    name: "Frames & Channels",
    query: "Frames & Channels",
    href: "/products?category=Frames+%26+Channels",
    badge: "Drywall & Perimeter",
    img: "/products/finshed-Inset-screens-[SA-IS-Box-frame-002]-WhatsApp-Image-2026-10-29-at-5.53.45-PM.jpeg",
  },
  {
    name: "Mesh",
    query: "Mesh",
    href: "/products?category=Mesh",
    badge: "Screen Mesh",
    img: "/products/workbook/mesh-ma-d-mesh-black-3-001.png",
  },
] as const;

export const HOUSE_OF_AJANTHA_RANGES = [
  {
    name: "Door Closers",
    query: "Door Closer & Floor Spring",
    href: "/products?category=Door+Closer+%26+Floor+Spring",
    badge: "Distributor Route",
    desc: "Hydraulic surface door closers supplied via authorized distributors. (Floor springs: quote-only pending sales-route confirmation).",
    img: "/products/Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-60-001]-img.jpg",
  },
  {
    name: "Kitchen Baskets & Wireware",
    query: "Kitchen Basket",
    href: "/products?category=Kitchen+Basket",
    badge: "Distributor Route",
    desc: "Pull-out wire baskets, thali organizers, and soft-close slide runners supplied via authorized distributors.",
    img: "/products/Kitchen-Basket-plan-basket-img.jpg",
  },
] as const;

export const HOUSE_OF_AJANTA_RANGES = HOUSE_OF_AJANTHA_RANGES;

export function Header({
  overlayHero = false,
  showResources = false,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { cartCount, wishlistIds, session, setCartOpen } = useStore();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
    setSearchOpen(false);
  }

  const accountHref = session
    ? session.role === "ADMIN"
      ? "/admin"
      : session.role === "DISTRIBUTOR" && session.approvalStatus === "APPROVED"
        ? "/distributor"
        : session.role === "DEALER" && session.approvalStatus === "APPROVED"
          ? "/dealer"
          : "/account"
    : "/login";

  const accountLabel = session
    ? session.role === "ADMIN"
      ? "Admin Desk"
      : session.role === "DISTRIBUTOR" && session.approvalStatus === "APPROVED"
        ? "Distributor Portal"
        : session.role === "DEALER" && session.approvalStatus === "APPROVED"
          ? "Dealer Portal"
          : session.name.split(" ")[0]
    : "Login";

  const isTransparentHero = overlayHero && !scrolled && !mobileOpen;

  return (
    <>
      <header
        className={`${
          overlayHero ? "fixed top-0 left-0 right-0" : "sticky top-0"
        } z-40 w-full transition-all duration-300 ${
          isTransparentHero
            ? "bg-white/95 backdrop-blur-md border-b border-[#C6CAD5]/45 shadow-2xs"
            : "bg-white/98 backdrop-blur-md border-b border-[#C6CAD5]/80 shadow-xs"
        }`}
      >
        <div className="mx-auto max-w-[1440px] px-3 sm:px-8 lg:px-12">
          <div className="flex h-16 sm:h-[72px] items-center justify-between gap-2 sm:gap-4">
            {/* Left: Official Sai Ajantha Logo */}
            <Link
              href="/"
              aria-label="Sai Ajantha Interior Solutions Home"
              className="min-w-0 shrink focus:outline-none focus-visible:ring-2 focus-visible:ring-[#079D9A] rounded-md transition-transform duration-200 hover:opacity-95"
            >
              <span className="sm:hidden">
                <BrandLogo size="sm" />
              </span>
              <span className="hidden sm:inline-flex">
                <BrandLogo size="md" />
              </span>
            </Link>

            {/* Center: Main Navigation Menu (Strictly: Home, Shop by Category, House of Ajantha, Contact) */}
            <NavigationMenu className="hidden lg:flex">
              <NavigationMenuList className="gap-1.5">
                {/* 1. Home */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/"
                      className={`relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] tracking-tight transition-all duration-200 ${
                        pathname === "/"
                          ? "bg-[#0B1F35] text-white font-bold shadow-xs"
                          : "text-[#153C66] hover:text-[#079D9A] hover:bg-[#F3F6FA] font-semibold"
                      }`}
                    >
                      <span>Home</span>
                      {pathname === "/" && (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-[#24C6D0]"
                        />
                      )}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* 2. Shop by Category (Nine Direct-Sale Categories ONLY) */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    onClick={() => router.push("/products")}
                    className={`relative rounded-full px-4 py-2 text-[13px] tracking-tight transition-all duration-200 cursor-pointer ${
                      pathname.startsWith("/products") &&
                      !pathname.includes("Door+Closer") &&
                      !pathname.includes("Kitchen+Basket")
                        ? "bg-[#0B1F35] text-white font-bold shadow-xs"
                        : "text-[#153C66] hover:text-[#079D9A] hover:bg-[#F3F6FA] font-semibold"
                    }`}
                  >
                    <span>Shop by Category</span>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="p-0">
                    <div className="w-[940px] xl:w-[980px] p-6 grid grid-cols-12 gap-6 bg-white">
                      <div className="col-span-4 border-r border-[#E8EDF3] pr-5 flex flex-col justify-between">
                        <div>
                          <Badge
                            variant="teal"
                            className="text-[10px] font-bold uppercase tracking-wider"
                          >
                            Direct Sales
                          </Badge>
                          <h3 className="mt-2.5 font-display text-lg font-bold text-[#102D4D] leading-snug">
                            Nine Core Product Categories
                          </h3>
                          <p className="mt-2 text-xs leading-relaxed text-[#5D6B7B]">
                            Verified architectural materials available for
                            direct quotation, ordering, and project site
                            dispatch.
                          </p>
                        </div>
                        <div className="pt-4 border-t border-[#E8EDF3]">
                          <NavigationMenuLink asChild>
                            <Link
                              href="/products"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#079D9A] hover:text-[#102D4D] transition-colors"
                            >
                              <span>Browse Complete Catalogue</span>
                              <ArrowRight className="size-3.5" />
                            </Link>
                          </NavigationMenuLink>
                        </div>
                      </div>

                      {/* 9 Category Tiles Grid */}
                      <div className="col-span-8 grid grid-cols-3 gap-2.5">
                        {NINE_DIRECT_SALE_CATEGORIES.map((cat) => (
                          <NavigationMenuLink key={cat.query} asChild>
                            <Link
                              href={cat.href}
                              className="group flex items-center gap-2.5 rounded-xl border border-[#E8EDF3] bg-[#F8FAFC] p-2.5 hover:border-[#079D9A] hover:bg-white transition-all shadow-2xs"
                            >
                              <div className="relative h-11 w-11 shrink-0 rounded-lg bg-white border border-[#E8EDF3] p-1 overflow-hidden">
                                <Image
                                  src={cat.img}
                                  alt={cat.name}
                                  fill
                                  sizes="44px"
                                  className="object-contain"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-[#102D4D] group-hover:text-[#079D9A] leading-snug line-clamp-2">
                                  {cat.name}
                                </p>
                                <p className="text-[10px] text-[#7B8896] truncate mt-0.5">
                                  {cat.badge}
                                </p>
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        ))}
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* 3. House of Ajantha (Door Closers & Kitchen Baskets on Distributor Route) */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    onClick={() => router.push("/#house-of-ajantha")}
                    className="relative rounded-full px-4 py-2 text-[13px] tracking-tight text-[#153C66] hover:text-[#079D9A] hover:bg-[#F3F6FA] font-semibold transition-all duration-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>House of Ajantha</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#079D9A]" />
                    </span>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="p-0">
                    <div className="w-[660px] p-6 bg-white space-y-4">
                      <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#E8EDF3]">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                              House of Ajantha · Dedicated Line
                            </span>
                            <span className="rounded-full bg-[#102D4D] text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                              Distributor Sales Route
                            </span>
                          </div>
                          <h3 className="mt-1 font-display text-lg font-bold text-[#102D4D]">
                            Architectural Hardware &amp; Modular Storage
                          </h3>
                        </div>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/#house-of-ajantha"
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#079D9A] hover:text-[#102D4D] shrink-0"
                          >
                            <span>Learn More</span>
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </NavigationMenuLink>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {HOUSE_OF_AJANTHA_RANGES.map((item) => (
                          <NavigationMenuLink key={item.query} asChild>
                            <Link
                              href={item.href}
                              className="group flex flex-col justify-between rounded-xl border border-[#E8EDF3] bg-[#F8FAFC] p-3.5 hover:border-[#079D9A] hover:bg-white transition-all shadow-2xs"
                            >
                              <div className="flex items-start gap-3">
                                <div className="relative h-14 w-14 shrink-0 rounded-lg bg-white border border-[#E8EDF3] p-1 overflow-hidden">
                                  <Image
                                    src={item.img}
                                    alt={item.name}
                                    fill
                                    sizes="56px"
                                    className="object-contain"
                                  />
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase text-[#079D9A]">
                                    {item.badge}
                                  </span>
                                  <h4 className="text-xs font-bold text-[#102D4D] group-hover:text-[#079D9A] leading-snug">
                                    {item.name}
                                  </h4>
                                </div>
                              </div>
                              <p className="mt-2 text-[11px] text-[#5D6B7B] leading-relaxed">
                                {item.desc}
                              </p>
                            </Link>
                          </NavigationMenuLink>
                        ))}
                      </div>

                      <div className="rounded-xl bg-[#F3F6FA] p-3 flex items-center justify-between gap-3 text-xs text-[#5D6B7B]">
                        <span>
                          Supplied through authorized regional distributors and
                          project contractors.
                        </span>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/register?role=DISTRIBUTOR"
                            className="font-bold text-[#102D4D] hover:text-[#079D9A] underline shrink-0"
                          >
                            Apply as Distributor
                          </Link>
                        </NavigationMenuLink>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {showResources && (
                  <NavigationMenuItem data-header-resources>
                    <NavigationMenuTrigger
                      className={`relative rounded-full px-4 py-2 text-[13px] tracking-tight transition-all duration-200 cursor-pointer ${
                        RESOURCE_LINKS.some(({ href }) =>
                          pathname.startsWith(href),
                        )
                          ? "bg-[#0B1F35] text-white font-bold shadow-xs"
                          : "text-[#153C66] hover:text-[#079D9A] hover:bg-[#F3F6FA] font-semibold"
                      }`}
                    >
                      Resources
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="p-2">
                      <div className="w-[240px] space-y-1 bg-white">
                        {RESOURCE_LINKS.map(({ label, href }) => (
                          <NavigationMenuLink key={href} asChild>
                            <Link
                              href={href}
                              aria-current={
                                pathname === href ? "page" : undefined
                              }
                              className="block rounded-lg px-4 py-3 text-sm font-semibold text-[#102D4D] hover:bg-[#F3F6FA] hover:text-[#079D9A] transition-colors"
                            >
                              {label}
                            </Link>
                          </NavigationMenuLink>
                        ))}
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                )}

                {/* Contact */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/contact"
                      className={`relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] tracking-tight transition-all duration-200 ${
                        pathname === "/contact"
                          ? "bg-[#0B1F35] text-white font-bold shadow-xs"
                          : "text-[#153C66] hover:text-[#079D9A] hover:bg-[#F3F6FA] font-semibold"
                      }`}
                    >
                      <span>Contact</span>
                      {pathname === "/contact" && (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-[#24C6D0]"
                        />
                      )}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            {/* Right-Side Actions: Search, Wishlist, Login / Account, Cart */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Search Trigger */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search product catalogue"
                    className="border-[#C6CAD5] hover:border-[#079D9A] hover:text-[#079D9A] transition-all hover:scale-[1.03] active:scale-95 rounded-xl h-9 w-9 sm:h-10 sm:w-10 shadow-2xs cursor-pointer"
                  >
                    <Search className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search Products &amp; SKUs</TooltipContent>
              </Tooltip>

              {/* Saved Shortlist */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    className="relative hidden sm:inline-flex border-[#C6CAD5] hover:border-[#079D9A] hover:text-[#079D9A] transition-all hover:scale-[1.03] active:scale-95 rounded-xl h-10 w-10 shadow-2xs"
                  >
                    <Link
                      href="/wishlist"
                      aria-label={`Saved shortlist (${wishlistIds.length} items)`}
                    >
                      <Heart
                        className={`size-4 ${
                          wishlistIds.length > 0
                            ? "fill-[#079D9A] text-[#079D9A]"
                            : ""
                        }`}
                      />
                      {wishlistIds.length > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#079D9A] px-1 text-[10px] font-bold text-white">
                          {wishlistIds.length}
                        </span>
                      )}
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Saved Shortlist</TooltipContent>
              </Tooltip>

              {/* Shopping Cart Drawer Trigger */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setCartOpen(true)}
                aria-label={`Open Cart (${cartCount} items)`}
                className="px-2 sm:px-3.5 h-9 sm:h-10 gap-1.5 sm:gap-2 tracking-normal normal-case border-[#C6CAD5] hover:border-[#079D9A] transition-all hover:scale-[1.03] active:scale-95 rounded-xl shadow-2xs cursor-pointer"
              >
                <ShoppingBag className="size-4 text-[#102D4D]" />
                <span className="hidden md:inline font-bold text-xs text-[#102D4D]">
                  Cart
                </span>
                <Badge className="rounded-full px-1.5 min-w-[18px] h-5 tabular-nums bg-[#102D4D] text-white">
                  {cartCount}
                </Badge>
              </Button>

              {/* Account / Login Trigger */}
              <Button
                asChild
                variant="outline"
                className="inline-flex items-center gap-1.5 border-[#C6CAD5] hover:border-[#079D9A] hover:text-[#079D9A] text-[#153C66] font-semibold text-xs h-9 sm:h-10 px-2 sm:px-4 rounded-xl shadow-2xs transition-all hover:scale-[1.03] active:scale-95"
              >
                <Link href={accountHref} aria-label={accountLabel}>
                  <User className="size-3.5 text-[#079D9A]" />
                  <span className="hidden sm:inline">{accountLabel}</span>
                </Link>
              </Button>

              {/* Mobile Navigation Sheet Trigger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Toggle navigation menu"
                    className="lg:hidden rounded-xl h-11 w-11 min-h-[44px] min-w-[44px] border-[#C6CAD5]"
                  >
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="p-0 flex flex-col w-[320px] sm:w-[360px]"
                >
                  <SheetHeader className="p-5 border-b border-[#E8EDF3] flex-row items-center justify-between">
                    <BrandLogo size="sm" />
                    <SheetTitle className="sr-only">
                      Mobile Navigation
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                    <nav
                      className="flex flex-col gap-1.5"
                      aria-label="Mobile Navigation"
                    >
                      {/* Home */}
                      <Link
                        href="/"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all min-h-[44px] ${
                          pathname === "/"
                            ? "bg-[#0B1F35] text-white font-bold"
                            : "text-[#153C66] hover:bg-[#F4F6F9]"
                        }`}
                      >
                        <span>Home</span>
                      </Link>

                      {/* Shop by Category Submenu */}
                      <div className="space-y-1 pt-2">
                        <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[#079D9A]">
                          Shop by Category (9 Direct-Sale)
                        </div>
                        <div className="grid grid-cols-1 gap-1 pl-2">
                          {NINE_DIRECT_SALE_CATEGORIES.map((cat) => (
                            <Link
                              key={cat.query}
                              href={cat.href}
                              onClick={() => setMobileOpen(false)}
                              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#102D4D] hover:bg-[#F3F6FA] min-h-[44px]"
                            >
                              <div className="relative h-7 w-7 shrink-0 rounded bg-white border border-[#E8EDF3] overflow-hidden p-0.5">
                                <Image
                                  src={cat.img}
                                  alt={cat.name}
                                  fill
                                  sizes="28px"
                                  className="object-contain"
                                />
                              </div>
                              <span className="truncate">{cat.name}</span>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* House of Ajantha Submenu */}
                      <div className="space-y-1 pt-3">
                        <div className="px-4 py-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#079D9A]">
                          <span>House of Ajantha</span>
                          <span className="text-[9px] bg-[#0B1F35] text-white px-2 py-0.5 rounded font-normal">
                            Distributor Route
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-1 pl-2">
                          {HOUSE_OF_AJANTHA_RANGES.map((item) => (
                            <Link
                              key={item.query}
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#102D4D] hover:bg-[#F3F6FA] min-h-[44px]"
                            >
                              <div className="relative h-7 w-7 shrink-0 rounded bg-white border border-[#E8EDF3] overflow-hidden p-0.5">
                                <Image
                                  src={item.img}
                                  alt={item.name}
                                  fill
                                  sizes="28px"
                                  className="object-contain"
                                />
                              </div>
                              <span className="truncate">{item.name}</span>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {showResources && (
                        <div className="space-y-1 pt-3" data-mobile-resources>
                          <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[#079D9A]">
                            Resources
                          </div>
                          <div className="grid grid-cols-1 gap-1 pl-2">
                            {RESOURCE_LINKS.map(({ label, href }) => (
                              <Link
                                key={href}
                                href={href}
                                onClick={() => setMobileOpen(false)}
                                aria-current={
                                  pathname === href ? "page" : undefined
                                }
                                className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-xs font-semibold text-[#102D4D] hover:bg-[#F3F6FA]"
                              >
                                {label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contact */}
                      <Link
                        href="/contact"
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all mt-2 min-h-[44px] ${
                          pathname === "/contact"
                            ? "bg-[#0B1F35] text-white font-bold"
                            : "text-[#153C66] hover:bg-[#F4F6F9]"
                        }`}
                      >
                        <span>Contact</span>
                      </Link>

                      <div className="pt-2 grid grid-cols-2 gap-1.5 px-2">
                        <Link
                          href="/quotes"
                          onClick={() => setMobileOpen(false)}
                          className="rounded-lg border border-[#E8EDF3] px-3 py-2 text-xs font-semibold text-[#102D4D] hover:border-[#079D9A]"
                        >
                          Request Quote
                        </Link>
                        <Link
                          href="/installation"
                          onClick={() => setMobileOpen(false)}
                          className="rounded-lg border border-[#E8EDF3] px-3 py-2 text-xs font-semibold text-[#102D4D] hover:border-[#079D9A]"
                        >
                          Need Installation
                        </Link>
                      </div>
                    </nav>

                    <Separator />

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        onClick={() => setMobileOpen(false)}
                        className="min-h-[44px]"
                      >
                        <Link href="/wishlist">
                          Shortlist ({wishlistIds.length})
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        onClick={() => setMobileOpen(false)}
                        className="min-h-[44px]"
                      >
                        <Link href="/cart">Cart ({cartCount})</Link>
                      </Button>
                    </div>

                    <Button
                      asChild
                      className="w-full bg-[#0B1F35] hover:bg-[#079D9A] text-white rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-colors min-h-[44px]"
                    >
                      <Link
                        href={accountHref}
                        onClick={() => setMobileOpen(false)}
                      >
                        <User className="size-4 mr-2" />
                        <span>{accountLabel}</span>
                      </Link>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Product Search Modal */}
      <ProductSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
