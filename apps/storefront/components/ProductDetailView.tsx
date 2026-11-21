"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  DoorOpen,
  FileText,
  GitCompareArrows,
  Heart,
  Home,
  HelpCircle,
  Layers,
  MapPin,
  Maximize2,
  MessageCircle,
  Minus,
  Package,
  Phone,
  Plus,
  Printer,
  Ruler,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Wrench,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ProductPhoto } from "@/components/non-home/ProductPhoto";
import { useStore } from "@/components/StoreProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BRAND_CONTACT } from "@/lib/brand";
import {
  COMMERCIAL_FLAGS,
  evaluateProductPolicy,
  isFloorSpringProduct,
} from "@/lib/commercial-policy";
import type { ProductCategory, ProductItem } from "@/lib/products";
import { formatInr, type ProductSpecData } from "@/lib/productSpecs";

interface ProductDetailViewProps {
  item: ProductItem;
  spec: ProductSpecData;
  relatedItems: ProductItem[];
}

const ROLE_OPTIONS = [
  "Architect / Consultant",
  "Interior Designer / Decorator",
  "Builder / Project Head",
  "Procurement Manager",
  "Dealer / Interior Contractor",
] as const;

interface AssemblyGuide {
  title: string;
  substrate: string;
  fasteners: string;
  complementarySystems: string[];
  maintenanceNote: string;
}

const CATEGORY_ASSEMBLY_GUIDES: Record<ProductCategory, AssemblyGuide> = {
  Aluminium: {
    title: "Multi-Track Sliding & Partition Framing Assembly",
    substrate: "Reinforced concrete, masonry aperture, or structural steel sub-frames",
    fasteners: "SS-304 countersunk self-tapping screws (pitch 300–450 mm)",
    complementarySystems: [
      "EPDM hollow & sponge compression gaskets",
      "FGM 45°/90° precision corner joinery",
      "Heavy-duty ball-bearing sliding rollers",
      "Interlock stiles with mohair weatherpile",
    ],
    maintenanceNote:
      "Wipe bottom tracks quarterly with silicone spray; inspect weep hole clearance during monsoon periods.",
  },
  Hardware: {
    title: "Architectural Door & Corridor Hardware Integration",
    substrate: "Solid core timber, aluminium profile jambs, or composite door leafs",
    fasteners: "Through-bolt mounting sleeves and machine thread fasteners",
    complementarySystems: [
      "EN-1154 certified hydraulic door controls",
      "High-frequency stainless steel ball-bearing hinges",
      "Perimeter acoustic drop seals and door sweeps",
      "Heavy-duty master keyed euro-profile cylinders",
    ],
    maintenanceNote:
      "Clean with pH-neutral detergent and microfiber cloth; avoid hydrochloric acid tile cleaners.",
  },
  "Door Closer & Floor Spring": {
    title: "Hydraulic Closer & Concealed Floor Spring Installation",
    substrate: "Recessed concrete floor box with cement grout or reinforced top jamb transom",
    fasteners: "M8 high-tensile machine anchors and adjustable alignment screws",
    complementarySystems: [
      "Architectural bottom rails & glass patch fittings",
      "Top pivot assemblies with needle-roller bearings",
      "Overhead transom door closers & cam-action arms",
      "SS-304 architectural pull handles (25–38 mm dia)",
    ],
    maintenanceNote:
      "Independent dual-speed valves allow field calibration of closing sweep (180°–15°) and latching action (15°–0°). Never force close.",
  },
  "FGM Fittings": {
    title: "Modular Frame Joinery & Screen Retention System",
    substrate: "Extruded 6063-T5 aluminium channel profiles and mitered jambs",
    fasteners: "Concealed friction wedge lock and internal grub fasteners",
    complementarySystems: [
      "Insect screen sliding & pleated sub-frames",
      "Fine-aperture high-airflow barrier mesh",
      "Rigid UV-PVC corner splines & stoppers",
      "Aluminium channel trims and track keels",
    ],
    maintenanceNote:
      "Ensure corner miters are cut cleanly at 45° or 90° before pressing fitting flush into channel core.",
  },
  "Insect Screens": {
    title: "Hygienic Insect & Vector Barrier Installation",
    substrate: "uPVC, aluminium, or seasoned hardwood window & balcony frames",
    fasteners: "Concealed perimeter magnetic strips or low-profile clip anchors",
    complementarySystems: [
      "Low-threshold barrier-free floor guides",
      "High-tenacity pleated polyester / fiberglass mesh",
      "Reinforced spring-tension cord assemblies",
      "Perimeter brush seals for zero-gap closure",
    ],
    maintenanceNote:
      "Gentle vacuuming or damp cloth wipe down keeps pleat folds and guide tracks debris-free.",
  },
  "Kitchen Basket": {
    title: "SS-304 Utility Carcass & Modular Kitchen Storage",
    substrate: "18 mm marine-grade plywood or modular stainless steel cabinet carcasses",
    fasteners: "Side-mount pan head timber/metal screws into runner brackets",
    complementarySystems: [
      "Telescopic full-extension soft-close drawer runners",
      "SS-304 plate, thali, and bottle divider inserts",
      "Front fascia clip brackets with 3D alignment",
      "Bottom drip trays for sanitized drying",
    ],
    maintenanceNote:
      "Passivated SS-304 wire cleans easily with warm water; dry thoroughly to prevent mineral spotting.",
  },
  Ladder: {
    title: "Facility MEP Servicing & High-Bay Maintenance Access",
    substrate: "Terrazzo, vitrified tile, granite, polished concrete slabs, or epoxy floors",
    fasteners: "Integrated heavy-gauge hinge stays and dual safety spreaders",
    complementarySystems: [
      "Non-marring antistatic rubber safety feet",
      "Serrated non-slip box-section aluminium rungs",
      "Reinforced top tool tray & safety grab handles",
      "Fold-flat locking braces for storage closets",
    ],
    maintenanceNote:
      "Inspect safety spreader rivets and rubber feet every 6 months; store in dry utility closets.",
  },
  Mesh: {
    title: "Insect Barrier & Ventilation Screen Fabrication",
    substrate: "Standard aluminium screen extrusion spline grooves (4.5–6.0 mm)",
    fasteners: "Virgin EPDM / PVC spline cord pressed with roller wheel",
    complementarySystems: [
      "Extruded aluminium mosquito channel profiles",
      "FGM 45°/90° precision corner joinery",
      "Heavy-duty tensioning spline roller tools",
      "Concealed sub-frame magnetic catches",
    ],
    maintenanceNote:
      "Roll mesh with uniform tension from center outward to avoid diagonal waviness or sagging.",
  },
  "Rubber & PVC": {
    title: "Acoustic Glazing Cushion & Perimeter Weatherproofing",
    substrate: "Glazing bead rebate, aluminium pocket channel, or door jamb kerf",
    fasteners: "Friction push-fit insertion (no adhesive required in standard channels)",
    complementarySystems: [
      "Architectural 6063-T5 multi-track extrusions",
      "Laminated acoustic & toughened safety glass panels",
      "Structural neutral-cure silicone sealants (789/GP)",
      "Interlock stiles and partition header channels",
    ],
    maintenanceNote:
      "Do not stretch gasket during insertion; allow 1% relaxed extra length at corners to prevent shrink-back.",
  },
  Clip: {
    title: "Modular Retaining Clip & Channel Retention",
    substrate: "Mating extrusion groove or panel rebate flange",
    fasteners: "Spring snap-fit retention with positive locking detent",
    complementarySystems: [
      "Extruded aluminium cover profiles & trims",
      "Insect screen cassette frames",
      "Concealed ceiling tile support tees",
      "Modular architectural joint covers",
    ],
    maintenanceNote:
      "Test snap retention on sample extrusion cut-section before site-wide channel clipping.",
  },
  "Frames & Channels": {
    title: "Structural Frame & Sub-Sill Channel Integration",
    substrate: "Reinforced structural concrete, masonry reveal, or steel sub-frames",
    fasteners: "Heavy-duty expansion anchor sleeves and zinc-coated structural fasteners",
    complementarySystems: [
      "Thermal break perimeter insulation strips",
      "Continuous drainage weep hole channels",
      "Structural silicone sealant weather seals",
      "EPDM glazing compression profiles",
    ],
    maintenanceNote:
      "Inspect sub-sill drainage weep ports bi-annually; clear any accumulated construction grit or silt.",
  },
};

export function ProductDetailView({
  item,
  spec,
  relatedItems,
}: ProductDetailViewProps) {
  const {
    addToCart,
    toggleWishlist,
    isWishlisted,
    toggleCompare,
    isCompared,
    session,
    getAuthorizedUnitPrice,
    getProductImage,
    effectivePriceTier,
    wholesaleUnlocked,
    showToast,
  } = useStore();

  const [isZoomed, setIsZoomed] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const lightboxTrigger = useRef<HTMLButtonElement>(null);
  const quoteTrigger = useRef<HTMLButtonElement>(null);

  const [selectedFinish, setSelectedFinish] = useState(
    spec.finishOptions[0] ?? "Metallic Silver"
  );

  const availableSizes = useMemo(() => {
    const raw =
      (item.metadata?.available_sizes as string[]) ||
      (item.metadata?.availableSizes as string[]) ||
      [];
    if (Array.isArray(raw) && raw.length > 0) return raw;
    if (item.size && item.size.trim()) {
      if (item.size.includes(",")) return item.size.split(",").map((s) => s.trim()).filter(Boolean);
      return [item.size.trim()];
    }
    return [];
  }, [item]);
  const [selectedSize, setSelectedSize] = useState<string>(availableSizes[0] || "");

  const skuCode = item.code ?? item.id.toUpperCase();
  const isFloorSpring = isFloorSpringProduct(item) || skuCode.includes("-FS-") || item.name.toLowerCase().includes("floor spring");

  const isInsectScreen =
    item.category === "Insect Screens" ||
    item.name.toLowerCase().includes("screen") ||
    item.name.toLowerCase().includes("mesh");
  const isFinishedFrameScreen =
    isInsectScreen &&
    (item.name.toLowerCase().includes("frame") ||
      item.name.toLowerCase().includes("pleated") ||
      item.name.toLowerCase().includes("barrier") ||
      item.subcategory?.toLowerCase().includes("finished"));

  const [screenWidthInches, setScreenWidthInches] = useState<number>(36);
  const [screenHeightInches, setScreenHeightInches] = useState<number>(48);

  const [selectedPackIdx, setSelectedPackIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const [pincode, setPincode] = useState("");
  const [pincodeChecked, setPincodeChecked] = useState<string | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [isCheckingPin, setIsCheckingPin] = useState(false);
  const [pincodeResolution, setPincodeResolution] = useState<{
    sellerName: string;
    sellerRoute: string;
    serviceable: boolean;
    inStock: boolean;
    reason: string;
    allowedNextAction: string;
  } | null>(null);

  // Quick Action feedback states
  const [copiedSku, setCopiedSku] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Gallery Active Thumbnail index
  const [activeThumbIdx, setActiveThumbIdx] = useState(0);

  // Quote & Sample Request Dialog state
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    name: session?.name ?? "",
    role: "Architect / Consultant",
    organization: session?.organization ?? "",
    phone: session?.phone ?? "",
    email: session?.email ?? "",
    city: session?.businessCity ?? "Trichy",
    notes: "",
  });

  const saved = isWishlisted(item.id);
  const compared = isCompared(item.id);
  const selectedPack = spec.packOptions[selectedPackIdx] ?? spec.packOptions[0];

  const photoSrc = getProductImage(item.id, item.src);
  const serverUnit = getAuthorizedUnitPrice(item.id);
  const baseUnitPrice =
    serverUnit !== undefined && serverUnit !== null ? serverUnit : spec.verifiedPriceInr;

  const isValidPin = Boolean(pincodeChecked && /^\d{6}$/.test(pincodeChecked));
  const policy = evaluateProductPolicy(item, {
    resolvedPriceInr: baseUnitPrice,
    pincodeConfirmed: isValidPin,
    assignedSellerName: pincodeResolution?.sellerName || null,
    userRole: session?.role ?? null,
  });

  async function handleCheckPincode(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = pincode.trim();
    if (!/^\d{6}$/.test(cleaned)) {
      setPincodeError("Enter a valid 6-digit delivery PIN code.");
      setPincodeChecked(null);
      setPincodeResolution(null);
      return;
    }
    setPincodeError(null);
    setIsCheckingPin(true);
    try {
      const res = await fetch(
        `/api/seller-resolution?sku=${encodeURIComponent(skuCode)}&postalCode=${encodeURIComponent(cleaned)}`
      );
      const data = await res.json();
      if (res.ok && data.resolution) {
        setPincodeChecked(cleaned);
        setPincodeResolution({
          sellerName: data.resolution.sellerName,
          sellerRoute: data.resolution.resolvedRoute,
          serviceable: Boolean(data.resolution.serviceable),
          inStock: Boolean(data.resolution.inStock),
          reason: data.resolution.reason || "",
          allowedNextAction: data.resolution.allowedNextAction,
        });
      } else {
        setPincodeError(data.message || "Failed to resolve seller coverage for this PIN.");
        setPincodeChecked(null);
        setPincodeResolution(null);
      }
    } catch {
      setPincodeError("Unable to verify PIN code serviceability right now.");
      setPincodeChecked(null);
      setPincodeResolution(null);
    } finally {
      setIsCheckingPin(false);
    }
  }

  const packUnitPrice =
    baseUnitPrice !== null
      ? Math.round(baseUnitPrice * selectedPack.multiplier * 100) / 100
      : null;

  const orderSubtotal =
    packUnitPrice !== null ? Math.round(packUnitPrice * quantity * 100) / 100 : null;

  const screenCalculatedAreaSqFt = useMemo(() => {
    if (!isFinishedFrameScreen) return 0;
    const singleArea = (screenWidthInches * screenHeightInches) / 144;
    return Math.round(singleArea * quantity * 100) / 100;
  }, [isFinishedFrameScreen, screenWidthInches, screenHeightInches, quantity]);

  const screenMoqMet = screenCalculatedAreaSqFt >= 50.0;

  const assemblyGuide =
    CATEGORY_ASSEMBLY_GUIDES[item.category] ??
    CATEGORY_ASSEMBLY_GUIDES.Hardware;

  // Prefilled WhatsApp Inquiry link
  const waMessage = useMemo(() => {
    const text = [
      `Hello Sai Ajantha Technical Desk,`,
      ``,
      `I would like to inquire about:`,
      `• Product: ${item.name}`,
      `• SKU: ${skuCode}`,
      `• Category: ${item.category}`,
      `• Selected Finish: ${selectedFinish}`,
      `• Lot: ${selectedPack.label} (Qty: ${quantity})`,
      orderSubtotal !== null ? `• Estimated Order: ${formatInr(orderSubtotal)}` : "",
      ``,
      `Please confirm sample availability, trade pricing, and delivery schedule to our site.`,
    ]
      .filter(Boolean)
      .join("\n");
    return encodeURIComponent(text);
  }, [item.name, skuCode, item.category, selectedFinish, selectedPack.label, quantity, orderSubtotal]);

  const waHref = `https://wa.me/919842406588?text=${waMessage}`;

  async function handleCopySku() {
    try {
      await navigator.clipboard.writeText(skuCode);
      setCopiedSku(true);
      showToast(`SKU ${skuCode} copied to clipboard`);
      setTimeout(() => setCopiedSku(false), 2000);
    } catch {
      showToast("Could not copy the SKU");
    }
  }

  async function handleShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      showToast("Product link copied");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast("Could not copy the product link");
    }
  }

  function openQuote(event: MouseEvent<HTMLButtonElement>) {
    quoteTrigger.current = event.currentTarget;
    setQuoteError(null);
    setQuoteSubmitted(false);
    setQuoteDialogOpen(true);
  }

  async function handleQuoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuoteError(null);
    if (!quoteForm.name.trim() || (!quoteForm.phone.trim() && !quoteForm.email.trim())) {
      setQuoteError("Please enter your name and phone number or work email.");
      return;
    }

    setQuoteSubmitting(true);
    try {
      const formattedNotes = [
        `[Product Inquiry / Sample Request]`,
        `Product: ${item.name} (${skuCode})`,
        `Category: ${item.category}`,
        `Finish Variant: ${selectedFinish}`,
        `Requested Lot: ${selectedPack.label} × ${quantity} lots`,
        orderSubtotal !== null ? `Estimated Basis: ${formatInr(orderSubtotal)}` : "Price on Request",
        quoteForm.notes ? `Site Notes: ${quoteForm.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quoteForm.name,
          role: quoteForm.role,
          organization: quoteForm.organization,
          phone: quoteForm.phone,
          email: quoteForm.email,
          city: quoteForm.city,
          postal_code: pincodeChecked || pincode || "",
          division: item.category,
          items: [
            {
              sku: skuCode || item.code || item.id,
              name: item.name,
              category: item.category,
              quantity: quantity,
              size: selectedSize || undefined,
              pack: selectedPack?.label,
              unitPriceInr: packUnitPrice,
            },
          ],
          notes: formattedNotes,
          source: "product-detail-modal",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setQuoteError(data.error || "Unable to send your request. Please call our desk.");
        return;
      }

      setQuoteSubmitted(true);
      showToast("Consultation inquiry logged with Trichy Desk");
    } catch {
      setQuoteError("Network error logging your request. Please try again.");
    } finally {
      setQuoteSubmitting(false);
    }
  }

  const quoteOnly = policy.ctaMode === "REQUEST_QUOTE" || isFloorSpring;
  const priceLabel = wholesaleUnlocked
    ? `Approved ${effectivePriceTier} rate`
    : session &&
        (session.role === "DISTRIBUTOR" || session.role === "DEALER") &&
        session.approvalStatus !== "APPROVED"
      ? `Customer price · ${session.approvalStatus.replace("_", " ")}`
      : "CUSTOMER PRICE";
  const categoryHref = `/products?category=${encodeURIComponent(item.category)}`;
  const displayPrice = quoteOnly || packUnitPrice === null ? "Price on request" : formatInr(packUnitPrice);
  const quantityLimit = 999;

  // Use catalog photos; detail views crop the same photo without inventing angles.
  const galleryThumbnails = useMemo(() => {
    const sources = [...new Set([photoSrc, ...(item.images ?? [])].filter(Boolean))];
    if (sources.length > 1) {
      return sources.map((src, index) => ({
        label: `Product photo ${index + 1}`,
        src,
        crop: "full",
      }));
    }
    return [
      { label: "Product photo", src: photoSrc, crop: "full" },
      { label: "Photo detail 1", src: photoSrc, crop: "detail-1" },
      { label: "Photo detail 2", src: photoSrc, crop: "detail-2" },
      { label: "Photo detail 3", src: photoSrc, crop: "detail-3" },
    ];
  }, [photoSrc, item.images]);

  const facts = [
    { label: "MATERIAL", value: spec.material, icon: Layers },
    { label: "STANDARD", value: spec.gradeStandard, icon: ShieldCheck },
    { label: "SUPPLY FORMAT", value: spec.dimensionsSummary, icon: Ruler },
    { label: "WARRANTY", value: spec.warrantyLabel, icon: ShieldCheck },
  ];

  const relatedScrollRef = useRef<HTMLDivElement>(null);

  function handleRelatedScroll(direction: "left" | "right") {
    if (relatedScrollRef.current) {
      const scrollOffset = direction === "left" ? -340 : 340;
      relatedScrollRef.current.scrollBy({ left: scrollOffset, behavior: "smooth" });
    }
  }

  return (
    <div className="sa-pdp bg-[#F8FAFC]">
      {/* Product heading and architectural backdrop */}
      <section className="pdp-hero relative overflow-hidden text-white">
        {/* Subtle Architectural Ambient Overlay on Right */}
        <div className="pdp-hero-art absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <Image
            src="/hero-architecture.webp"
            alt=""
            fill
            className="object-cover object-right"
            sizes="100vw"
            loading="eager"
          />
        </div>

        <div className="pdp-container pdp-hero-content relative">
          {/* Breadcrumbs on Dark Background */}
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  <Home className="size-3 inline-block mr-1.5 text-teal-200" aria-hidden="true" />
                  Home
                </Link>
              </li>
              <li aria-hidden="true" className="text-slate-500">
                ›
              </li>
              <li>
                <Link href="/products" className="hover:text-white transition-colors">
                  Products
                </Link>
              </li>
              <li aria-hidden="true" className="text-slate-500">
                ›
              </li>
              <li>
                <Link href={categoryHref} className="hover:text-white transition-colors">
                  {item.category}
                </Link>
              </li>
              <li aria-hidden="true" className="text-slate-500">
                ›
              </li>
              <li aria-current="page" className="font-semibold text-white">
                {skuCode}
              </li>
            </ol>
          </nav>

          {/* Badge Row: Category Pill, SKU Copy Chip, Verified SKU */}
          <div className="pdp-badges flex flex-wrap items-center gap-2.5 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00897B] px-3.5 py-1 text-xs font-bold text-white shadow-sm">
              <DoorOpen className="size-3.5" aria-hidden="true" />
              {item.subcategory || item.category}
            </span>

            <button
              type="button"
              onClick={handleCopySku}
              aria-label={copiedSku ? `Copied SKU ${skuCode}` : `Copy SKU ${skuCode}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-3.5 py-1 font-mono text-xs font-bold text-white hover:bg-white/20 hover:border-white/40 transition-all cursor-pointer shadow-xs"
            >
              <span>SKU: {skuCode}</span>
              {copiedSku ? (
                <Check className="size-3 text-emerald-400" />
              ) : (
                <Copy className="size-3 text-slate-300" />
              )}
            </button>

            {spec.isWorkbookApproved && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 backdrop-blur-sm shadow-xs">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span>Verified SKU</span>
              </span>
            )}
          </div>

          {/* Product Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight max-w-4xl text-pretty">
            {item.name}
          </h1>

          {/* Subtitle / Customer Need Summary */}
          <p className="mt-2.5 text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl">
            {spec.overviewSummary.trim() ||
              "Help your door close reliably after use. Check the door's weight, width, and fitting before you order."}
          </p>

          {/* Jump Link Button */}
          <div className="pdp-hero-shortcuts mt-4 flex flex-wrap items-center gap-3">
            <a
              href="#technical-specs"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#102A43] hover:bg-slate-100 transition-all shadow-sm"
            >
              <FileText className="size-3.5 text-[#00897B]" />
              <span>View technical specs</span>
            </a>

            {policy.isFloorSpring ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/20 px-3.5 py-1.5 text-xs font-medium text-amber-200">
                <AlertCircle className="size-3.5 text-amber-400 shrink-0" />
                <span>Floor Spring — Request Quote / Enquiry Only</span>
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* 2. MAIN INTERACTION GRID: Left Showcase + Right Buy Box */}
      <div className="pdp-container pdp-content">
        <div className="pdp-purchase-grid grid items-start">
          {/* LEFT COLUMN: Gallery & Showcase (7 cols) */}
          <div className="pdp-gallery-column space-y-4">
            <div className="pdp-gallery relative rounded-3xl border border-[#E2E8F0] bg-white overflow-hidden">
              {/* Main Photo Stage */}
              <div className="pdp-photo-stage relative flex items-center justify-center overflow-hidden">
                {/* Top-Right Fullscreen Expand Icon */}
                <button
                  ref={lightboxTrigger}
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  aria-label="Expand photo in high-resolution lightbox"
                  className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur-sm hover:text-[#00897B] hover:border-[#00897B] hover:scale-105 transition-all cursor-pointer"
                >
                  <Maximize2 className="size-4" />
                </button>

                {/* Bottom-Left Zoom Toggle Icon */}
                <button
                  type="button"
                  onClick={() => setIsZoomed((z) => !z)}
                  aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                  className="absolute bottom-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm backdrop-blur-sm hover:text-[#00897B] hover:border-[#00897B] hover:scale-105 transition-all cursor-pointer"
                >
                  {isZoomed ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
                </button>

                {/* Product Photo */}
                <button
                  type="button"
                  onClick={() => setIsZoomed((z) => !z)}
                  aria-label="Toggle photo zoom"
                  className="pdp-photo relative h-full w-full flex items-center justify-center cursor-pointer"
                  data-crop={galleryThumbnails[activeThumbIdx]?.crop}
                  aria-pressed={isZoomed}
                >
                  <ProductPhoto
                    src={galleryThumbnails[activeThumbIdx]?.src || photoSrc}
                    alt={item.name}
                    fill
                    loading="eager"
                    fetchPriority="high"
                    sizes="(min-width: 1200px) 530px, (min-width: 768px) 47vw, 94vw"
                    className={`object-contain p-4 transition-transform duration-300 ${
                      isZoomed ? "scale-140" : "scale-100"
                    }`}
                  />
                </button>
              </div>

              {/* Catalog photo and detail thumbnails */}
              <div className="pdp-thumbnails flex items-center justify-center gap-3 px-4 py-3.5">
                <button
                  type="button"
                  onClick={() =>
                    setActiveThumbIdx((prev) =>
                      prev === 0 ? galleryThumbnails.length - 1 : prev - 1
                    )
                  }
                  aria-label="Previous image"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-[#00897B] hover:border-[#00897B] transition-all cursor-pointer"
                >
                  <ChevronLeft className="size-4" />
                </button>

                <div className="flex items-center gap-2.5">
                  {galleryThumbnails.map((thumb, idx) => {
                    const isActive = activeThumbIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveThumbIdx(idx)}
                        aria-label={`View ${thumb.label}`}
                        aria-pressed={isActive}
                        data-crop={thumb.crop}
                        className={`relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl border-2 bg-white p-1 transition-all overflow-hidden cursor-pointer ${
                          isActive
                            ? "border-[#00897B] shadow-sm ring-2 ring-[#00897B]/20"
                            : "border-slate-200 hover:border-slate-300 opacity-75 hover:opacity-100"
                        }`}
                      >
                        <ProductPhoto
                          src={thumb.src}
                          alt={`${item.name} - ${thumb.label}`}
                          fill
                          sizes="64px"
                          className="object-contain p-1"
                        />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setActiveThumbIdx((prev) =>
                      prev === galleryThumbnails.length - 1 ? 0 : prev + 1
                    )
                  }
                  aria-label="Next image"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-[#00897B] hover:border-[#00897B] transition-all cursor-pointer"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>

            {/* Quick Actions Row Below Media Card: Save, Compare, Share */}
            <div className="pdp-tools flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => toggleWishlist(item.id, item.name)}
                aria-pressed={saved}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  saved
                    ? "border-red-300 bg-red-50 text-red-600"
                    : "border-[#E2E8F0] bg-white text-[#102A43] hover:border-[#00897B] hover:text-[#00897B]"
                }`}
              >
                <Heart className={`size-3.5 ${saved ? "fill-red-600 text-red-600" : ""}`} />
                <span>{saved ? "Saved" : "Save"}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleCompare(item.id)}
                aria-pressed={compared}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  compared
                    ? "border-[#00897B] bg-[#E0F2F1] text-[#00897B]"
                    : "border-[#E2E8F0] bg-white text-[#102A43] hover:border-[#00897B] hover:text-[#00897B]"
                }`}
              >
                <GitCompareArrows className="size-3.5" />
                <span>Compare</span>
              </button>

              <button
                type="button"
                onClick={handleShareLink}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-bold text-[#102A43] hover:border-[#00897B] hover:text-[#00897B] transition-all shadow-xs cursor-pointer"
              >
                {copiedLink ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Share2 className="size-3.5" />
                )}
                <span>{copiedLink ? "Link copied" : "Share"}</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Buy Box & Configuration Studio (5 cols) */}
          <div className="pdp-purchase" id="product-purchase">
            <div className="pdp-buy-card relative rounded-3xl border border-[#E2E8F0] bg-white overflow-hidden">
              {/* Soft Teal Ambient Radial Glow in Top Right Corner */}
              <div
                className="absolute top-0 right-0 h-40 w-40 pointer-events-none opacity-60"
                style={{
                  background:
                    "radial-gradient(circle at top right, #E0F2F1 0%, rgba(224, 242, 241, 0) 70%)",
                }}
              />

              {/* Price & GST Lockup (Mint Tinted Header matching Reference) */}
              <div className="pdp-price relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      {priceLabel}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-2.5 mt-1">
                      <span className="text-3xl sm:text-4xl font-extrabold text-[#102A43] tracking-tight tabular-nums">
                        {displayPrice}
                      </span>
                      {!quoteOnly && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-bold text-[#166534]">
                          <Check className="size-3 text-emerald-700" />
                          Applicable GST
                        </span>
                      )}
                    </div>
                    {!quoteOnly && (
                      <p className="mt-1.5 text-xs text-slate-600 font-medium">
                        {selectedPack.label} {spec.gstNote || "+ 18% GST (Base rate exclusive of tax)"}
                      </p>
                    )}
                  </div>

                  <Badge className="border border-[#00897B]/40 bg-white text-[#00897B] font-bold text-[11px] px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs hover:bg-[#E0F2F1]">
                    {policy.route === "DISTRIBUTOR_RESALE"
                      ? "DISTRIBUTOR SUPPLY ⌵"
                      : "DIRECT SUPPLY ⌵"}
                  </Badge>
                </div>
              </div>

              {/* Configuration Body */}
              <div className="pdp-configuration">
                {/* 1. Finish Preference Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#102A43] mb-2.5">
                    Finish Preference
                  </label>
                  <div className="pdp-finishes flex flex-wrap gap-2">
                    {spec.finishOptions.map((finish) => {
                      const isSelected = selectedFinish === finish;
                      return (
                        <button
                          key={finish}
                          type="button"
                          onClick={() => setSelectedFinish(finish)}
                          aria-pressed={isSelected}
                          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#0B1E33] text-white border border-[#0B1E33] shadow-xs"
                              : "bg-white text-[#102A43] border border-[#CBD5E1] hover:border-[#102A43]"
                          }`}
                        >
                          <span>{finish}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Select Size / Carcass Fit (if available) */}
                {availableSizes.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#102A43] mb-2.5">
                      Select Size / Carcass Fit
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map((sz) => {
                        const isSelected = selectedSize === sz;
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setSelectedSize(sz)}
                            aria-pressed={isSelected}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#102A43] text-white border-2 border-[#102A43] shadow-xs"
                                : "bg-white text-[#102A43] border border-[#CBD5E1] hover:border-[#102A43]"
                            }`}
                          >
                            {isSelected && <Check className="size-3 text-[#2DD4BF]" />}
                            <span>{sz}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Insect Screen Custom Dimensions & 50 sq.ft Progress Meter (if applicable) */}
                {isFinishedFrameScreen && (
                  <div className="rounded-2xl border border-[#00897B]/30 bg-[#E0F2F1]/30 p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#102A43] uppercase tracking-wider">
                        Finished Frame Dimensions
                      </span>
                      <span className="text-[11px] font-bold text-[#00897B] bg-[#E0F2F1] px-2.5 py-0.5 rounded-full border border-[#00897B]/20">
                        MOQ: 50 sq.ft
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
                          Width (Inches)
                        </label>
                        <input
                          type="number"
                          min={12}
                          max={120}
                          value={screenWidthInches}
                          onChange={(e) =>
                            setScreenWidthInches(Math.max(1, Number(e.target.value) || 1))
                          }
                          className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#102A43] font-semibold focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
                          Height (Inches)
                        </label>
                        <input
                          type="number"
                          min={12}
                          max={120}
                          value={screenHeightInches}
                          onChange={(e) =>
                            setScreenHeightInches(Math.max(1, Number(e.target.value) || 1))
                          }
                          className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#102A43] font-semibold focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20 outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#00897B]/20 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#64748B]">
                          Total Area ({quantity} unit{quantity > 1 ? "s" : ""}):
                        </span>
                        <span className="font-extrabold text-[#102A43] text-sm tabular-nums">
                          {screenCalculatedAreaSqFt} sq.ft
                        </span>
                      </div>

                      <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            screenMoqMet ? "bg-[#16A34A]" : "bg-[#00897B]"
                          }`}
                          style={{
                            width: `${Math.min(100, (screenCalculatedAreaSqFt / 50) * 100)}%`,
                          }}
                        />
                      </div>

                      {!screenMoqMet ? (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
                          Custom screens require 50 sq.ft combined area across your cart (Shortfall:{" "}
                          <strong>
                            {Math.round((50 - screenCalculatedAreaSqFt) * 100) / 100} sq.ft
                          </strong>
                          ).
                        </div>
                      ) : (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] font-semibold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                          <span>Meets 50 sq.ft minimum combined screen order.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Order Bundle & Quantity (Units) (2 Columns Matching Image) */}
                <div className="pdp-order-quantity grid gap-3.5 items-end">
                  <div>
                    <label
                      htmlFor="pdp-pack"
                      className="block text-xs font-bold uppercase tracking-wider text-[#102A43] mb-2"
                    >
                      Order Bundle
                    </label>
                    <Select
                      value={String(selectedPackIdx)}
                      onValueChange={(val) => setSelectedPackIdx(Number(val))}
                    >
                      <SelectTrigger id="pdp-pack" className="h-11 rounded-xl border-[#CBD5E1] text-xs font-semibold text-[#102A43]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {spec.packOptions.map((pack, idx) => (
                          <SelectItem key={pack.label} value={String(idx)} className="text-xs">
                            {pack.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label
                      htmlFor="procure-qty"
                      className="block text-xs font-bold uppercase tracking-wider text-[#102A43] mb-2"
                    >
                      Quantity (Units)
                    </label>
                    <div className="inline-flex h-11 w-full items-center justify-between rounded-xl border border-[#CBD5E1] bg-white px-2 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        aria-label="Decrease quantity"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <input
                        id="procure-qty"
                        type="number"
                        min={1}
                        max={quantityLimit}
                        value={quantity}
                        onChange={(e) =>
                          setQuantity(
                            Math.min(
                              quantityLimit,
                              Math.max(1, Math.trunc(Number(e.target.value)) || 1)
                            )
                          )
                        }
                        className="w-12 text-center text-sm font-bold text-[#102A43] tabular-nums outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(quantityLimit, q + 1))}
                        disabled={quantity >= quantityLimit}
                        aria-label="Increase quantity"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. Estimated Subtotal Lockup */}
                {!quoteOnly && orderSubtotal !== null && (
                  <div className="pdp-order-subtotal flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Estimated Subtotal</span>
                    <strong className="text-xl font-extrabold text-[#102A43] tabular-nums">
                      {formatInr(orderSubtotal)}
                    </strong>
                  </div>
                )}

                {/* 6. Primary Action Button (Solid Teal with Shopping Bag) */}
                <div className="pdp-order-actions space-y-2.5">
                  {quoteOnly ? (
                    <Button
                      type="button"
                      size="lg"
                      className="w-full h-12 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                      onClick={openQuote}
                    >
                      <Send className="size-4" />
                      <span>Request a quote</span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="lg"
                        className="w-full h-12 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                        onClick={() =>
                          addToCart(item, {
                            finish: selectedFinish,
                            packIndex: selectedPackIdx,
                            quantity,
                            openDrawer: true,
                          })
                        }
                      >
                        <ShoppingCart className="size-4" />
                        <span>Add to cart</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11 rounded-xl border-[#CBD5E1] bg-white text-[#102A43] hover:border-[#00897B] hover:text-[#00897B] font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                        onClick={openQuote}
                      >
                        <CalendarCheck className="size-4 text-[#00897B]" />
                        <span>Ask about availability</span>
                      </Button>

                      {!COMMERCIAL_FLAGS.liveRazorpayEnabled && (
                        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                          Order by trade purchase order or enquiry. Online payment is currently unavailable.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Delivery coverage and fulfilling seller */}
                <div className="pdp-delivery space-y-3">
                  <form onSubmit={handleCheckPincode} noValidate className="space-y-2.5">
                    <label
                      htmlFor="pdp-pincode"
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#102A43]"
                    >
                      <Truck className="size-4 text-[#00897B]" />
                      <span>Delivery &amp; Seller</span>
                    </label>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input
                          id="pdp-pincode"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={pincode}
                          onChange={(e) => {
                            setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setPincodeChecked(null);
                            setPincodeResolution(null);
                            setPincodeError(null);
                          }}
                          placeholder="Geographical Delivery PIN"
                          className="pl-9 h-10 rounded-xl border-[#CBD5E1] bg-white text-xs font-semibold text-[#102A43] focus:border-[#00897B]"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={isCheckingPin}
                        className="h-10 px-4 rounded-xl border-[#CBD5E1] bg-white text-[#102A43] font-bold text-xs hover:border-[#00897B] hover:text-[#00897B] cursor-pointer"
                      >
                        {isCheckingPin ? "Checking..." : "Check PIN"}
                      </Button>
                    </div>

                    {pincodeError && (
                      <p className="text-[11px] font-medium text-red-600">{pincodeError}</p>
                    )}
                    {isValidPin && pincodeResolution && (
                      <div className="space-y-1">
                        <p className={`text-[11px] font-semibold ${pincodeResolution.serviceable ? "text-[#00897B]" : "text-amber-700"}`}>
                          PIN {pincodeChecked}: {pincodeResolution.serviceable ? `Serviceable — Fulfilled by ${pincodeResolution.sellerName}` : pincodeResolution.reason}
                        </p>
                        {pincodeResolution.serviceable && (
                          <p className="text-[10px] text-slate-500">
                            {pincodeResolution.inStock ? "• Stock verified at seller warehouse" : "• Formal quotation required before dispatch"}
                          </p>
                        )}
                      </div>
                    )}
                  </form>

                  {/* Fulfilling Seller Status Card */}
                  <div className="pdp-seller flex items-start gap-2.5">
                    <Store className="size-4 text-[#00897B] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-[#102A43]">
                        Fulfilling Seller: {pincodeResolution?.sellerName || (pincodeChecked ? policy.sellerLabel : "Regional Distributor (Check Delivery PIN Code)")}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {pincodeResolution?.reason || "Enter your delivery PIN code to check regional distributor coverage and stock availability."}
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Links: Request Installation & WhatsApp Desk */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href={`/installation?sku=${encodeURIComponent(skuCode)}&category=${encodeURIComponent(item.category)}`}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-[#102A43] hover:border-[#00897B] hover:text-[#00897B] transition-all shadow-2xs"
                    >
                      <Wrench className="size-3.5 text-[#00897B]" />
                      <span>Request Installation</span>
                    </Link>

                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-[#102A43] hover:border-[#25D366] hover:text-[#25D366] transition-all shadow-2xs"
                    >
                      <MessageCircle className="size-3.5 text-[#25D366]" />
                      <span>WhatsApp Desk</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product overview and specification facts */}
        <section className="pdp-overview-panel" aria-labelledby="pdp-overview">
          <div className="space-y-1 mb-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00897B]">
              COMPREHENSIVE SPECS
            </span>
            <h2 id="pdp-overview" className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              Product Overview
            </h2>
          </div>

          {/* 4 Facts Metric Cards */}
          <div className="pdp-fact-grid grid gap-4">
            {facts.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs hover:border-[#00897B] hover:shadow-md transition-all flex items-start gap-3.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E0F2F1] text-[#00897B]">
                  <Icon className="size-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    {label}
                  </span>
                  <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#102A43] leading-snug">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Two Split Cards: Left (Application & Why Choose) + Right (Key Engineering Highlights) */}
          <div className="pdp-overview-columns grid gap-6 mt-6">
            {/* Left Card */}
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-xs space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DoorOpen className="size-4 text-[#00897B]" />
                  <h3 className="text-base font-bold text-[#102A43]">
                    Recommended Application
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {spec.customerNeed ||
                    "Ideal for doors in commercial, healthcare, and institutional spaces. Check the door's weight, width, and frame before choosing."}
                </p>
              </div>

              <div className="pt-4 border-t border-[#F1F5F9]">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="size-4 text-[#00897B]" />
                  <h3 className="text-base font-bold text-[#102A43]">
                    Why Choose This Specification
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {spec.whyChoose ||
                    "This silver, half-round closer is rated for doors up to 60 kg and up to 950 mm wide. It helps you check performance, ensure a smooth close, and get the right fit for your project."}
                </p>
              </div>
            </div>

            {/* Right Card: Key Engineering Highlights */}
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="size-4 text-[#00897B]" />
                <h3 className="text-base font-bold text-[#102A43]">
                  Key Engineering Highlights
                </h3>
              </div>

              <ul className="space-y-3">
                {spec.aboutBullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#00897B]" />
                    <span className="leading-snug">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 4. TECHNICAL SPECIFICATIONS (Tabs & Table) */}
        <section
          id="technical-specs"
          className="pdp-specifications scroll-mt-24"
          aria-labelledby="pdp-spec-title"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 id="pdp-spec-title" className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              Technical specifications
            </h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#102A43] hover:border-[#00897B] hover:text-[#00897B] transition-all shadow-xs cursor-pointer"
            >
              <Printer className="size-4" />
              <span>Print specs</span>
            </button>
          </div>

          <Tabs defaultValue="engineering" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
              <TabsTrigger
                value="engineering"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-[#0B1E33] data-[state=active]:text-white shadow-2xs border border-slate-200"
              >
                <Settings className="size-3.5" />
                <span>Engineering</span>
              </TabsTrigger>
              <TabsTrigger
                value="commercial"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-[#0B1E33] data-[state=active]:text-white shadow-2xs border border-slate-200"
              >
                <Package className="size-3.5" />
                <span>Supply &amp; Tax</span>
              </TabsTrigger>
              <TabsTrigger
                value="assembly"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-[#0B1E33] data-[state=active]:text-white shadow-2xs border border-slate-200"
              >
                <Wrench className="size-3.5" />
                <span>Installation</span>
              </TabsTrigger>
              <TabsTrigger
                value="warranty"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-[#0B1E33] data-[state=active]:text-white shadow-2xs border border-slate-200"
              >
                <ShieldCheck className="size-3.5" />
                <span>Warranty</span>
              </TabsTrigger>
              {spec.faqs && spec.faqs.length > 0 && (
                <TabsTrigger
                  value="faqs"
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-[#0B1E33] data-[state=active]:text-white shadow-2xs border border-slate-200"
                >
                  <HelpCircle className="size-3.5" />
                  <span>FAQs</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Tab 1: Engineering Matrix */}
            <TabsContent value="engineering">
              <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B1E33] px-6 py-3.5 text-white">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-teal-300">
                    Material and Dimensions
                  </h3>
                  <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Standard: {spec.gradeStandard}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableBody>
                      {spec.technicalDetails.map((row) => (
                        <TableRow key={row.label} className="border-b border-slate-100 even:bg-slate-50/50">
                          <TableHead className="w-1/3 py-3.5 px-6 font-bold text-xs sm:text-sm text-[#102A43] bg-transparent">
                            {row.label}
                          </TableHead>
                          <TableCell className="py-3.5 px-6 font-medium text-xs sm:text-sm text-slate-600">
                            {row.value}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-b border-slate-100 even:bg-slate-50/50">
                        <TableHead className="w-1/3 py-3.5 px-6 font-bold text-xs sm:text-sm text-[#102A43] bg-transparent">
                          Selected finish
                        </TableHead>
                        <TableCell className="py-3.5 px-6 font-medium text-xs sm:text-sm text-slate-600">
                          {selectedFinish}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Commercial Matrix */}
            <TabsContent value="commercial">
              <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-[#102A43] to-[#00897B] px-6 py-3.5 text-white">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                    Ordering and Dispatch
                  </h3>
                  <p className="text-xs font-semibold text-teal-100 uppercase tracking-wider">
                    GSTIN: {BRAND_CONTACT.gstin}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableBody>
                      {spec.additionalInfo.map((row) => (
                        <TableRow key={row.label} className="border-b border-slate-100 even:bg-slate-50/50">
                          <TableHead className="w-1/3 py-3.5 px-6 font-bold text-xs sm:text-sm text-[#102A43] bg-transparent">
                            {row.label}
                          </TableHead>
                          <TableCell className="py-3.5 px-6 font-medium text-xs sm:text-sm text-slate-600">
                            {row.value}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-b border-slate-100 even:bg-slate-50/50">
                        <TableHead className="w-1/3 py-3.5 px-6 font-bold text-xs sm:text-sm text-[#102A43] bg-transparent">
                          Order bundles
                        </TableHead>
                        <TableCell className="py-3.5 px-6 font-medium text-xs sm:text-sm text-slate-600">
                          {spec.packOptions.map((p) => p.label).join(" · ")}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Site Assembly */}
            <TabsContent value="assembly">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E0F2F1] text-[#00897B]">
                      <Wrench className="size-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#00897B]">
                        Assembly Protocol
                      </span>
                      <h3 className="text-base font-bold text-[#102A43]">
                        {assemblyGuide.title}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm text-slate-600">
                    <div>
                      <strong className="text-[#102A43] block mb-0.5">Recommended Substrate:</strong>
                      <p>{assemblyGuide.substrate}</p>
                    </div>
                    <div>
                      <strong className="text-[#102A43] block mb-0.5">Fasteners and joints:</strong>
                      <p>{assemblyGuide.fasteners}</p>
                    </div>
                    <div>
                      <strong className="text-[#102A43] block mb-0.5">Maintenance:</strong>
                      <p>{assemblyGuide.maintenanceNote}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[#102A43]">
                      <Layers className="size-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#00897B]">
                        System Integration
                      </span>
                      <h3 className="text-base font-bold text-[#102A43]">
                        Complementary Components
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600">
                    Ensure the following matching components are included on your bill of quantities for seamless site execution:
                  </p>

                  <ul className="space-y-2 text-xs sm:text-sm text-[#102A43]">
                    {assemblyGuide.complementarySystems.map((comp) => (
                      <li key={comp} className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-[#00897B] shrink-0" />
                        <span>{comp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Tab 4: Warranty */}
            <TabsContent value="warranty">
              <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F5F9] pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00897B]">
                      Quality Assurance
                    </span>
                    <h3 className="text-lg font-bold text-[#102A43]">
                      Manufacturer Warranty &amp; Replacement Assurance
                    </h3>
                  </div>
                  <Badge variant="teal" className="w-fit">
                    {spec.warrantyLabel}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm text-slate-600">
                  <div className="space-y-1">
                    <strong className="text-[#102A43] block">SKU Warranty Status</strong>
                    <p>
                      {item.warranty ||
                        "Warranty coverage is confirmed per approved product listing and seller invoice. Confirm applicable terms before placing an order."}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-[#102A43] block">Seller Responsibility</strong>
                    <p>
                      Returns, replacements, and warranty claims are handled directly by the seller named on your tax invoice ({policy.sellerLabel}).
                    </p>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-[#102A43] block">Fitting &amp; Installation</strong>
                    <p>
                      Verify door weights, aperture dimensions, and mounting requirements prior to installation. Separate fitting enquiries can be submitted independently.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 5: FAQs */}
            {spec.faqs && spec.faqs.length > 0 && (
              <TabsContent value="faqs">
                <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00897B]">
                      Customer Assistance
                    </span>
                    <h3 className="text-lg font-bold text-[#102A43]">
                      Frequently Asked Questions
                    </h3>
                  </div>
                  <div className="divide-y divide-[#F1F5F9] space-y-3 pt-2">
                    {spec.faqs.map((faq, idx) => (
                      <div key={idx} className="pt-3 first:pt-0">
                        <p className="font-bold text-sm text-[#102A43]">{faq.question}</p>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </section>

        {/* Technical desk and project enquiries */}
        <section
          className="pdp-project-banner relative overflow-hidden rounded-3xl text-white"
          aria-labelledby="pdp-support-title"
        >
          {/* Subtle Glass Architecture Texture on Right */}
          <div className="pdp-project-art absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <Image
              src="/hero-architecture.webp"
              alt=""
              fill
              className="object-cover object-right"
              sizes="1100px"
            />
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#2DD4BF] block">
                TECHNICAL DESK
              </span>
              <h2
                id="pdp-support-title"
                className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white"
              >
                Planning a larger project?
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Ask our Trichy team about samples, custom dimensions or help with your bill of quantities.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                className="h-11 rounded-full bg-white text-[#102A43] hover:bg-slate-100 font-bold text-xs px-6 shadow-md transition-all cursor-pointer"
              >
                <a href={BRAND_CONTACT.phoneHref}>
                  <Phone className="size-3.5 text-[#102A43]" />
                  <span>Call {BRAND_CONTACT.phone}</span>
                </a>
              </Button>
              <Button
                type="button"
                onClick={openQuote}
                className="h-11 rounded-full bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs px-6 shadow-md transition-all cursor-pointer"
              >
                <Send className="size-3.5" />
                <span>Send project enquiry</span>
              </Button>
            </div>
          </div>
        </section>

        {/* Related catalog products */}
        {relatedItems.length > 0 && (
          <section className="pdp-related" aria-labelledby="pdp-related-title">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#00897B] block">
                  {item.category.toUpperCase()}
                </span>
                <h2
                  id="pdp-related-title"
                  className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight"
                >
                  Related products
                </h2>
              </div>
              <Link
                href={categoryHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#102A43] hover:border-[#00897B] hover:text-[#00897B] transition-all shadow-xs"
              >
                <span>Browse category</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="relative group/related">
              {/* Left Carousel Arrow Button */}
              <button
                type="button"
                onClick={() => handleRelatedScroll("left")}
                aria-label="Previous related products"
                className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:border-[#00897B] hover:text-[#00897B] hover:scale-105 transition-all cursor-pointer"
              >
                <ChevronLeft className="size-4 sm:size-5" />
              </button>

              <div
                ref={relatedScrollRef}
                className="pdp-related-track grid overflow-x-auto scroll-smooth scrollbar-none"
              >
                {relatedItems.map((rel) => {
                  const rawPrice = rel.customerPriceInr ?? rel.unitPriceInr;
                  const relPrice = rawPrice !== null && rawPrice !== undefined ? formatInr(rawPrice) : "Price on request";
                  const isRelSaved = isWishlisted(rel.id);
                  const relPhoto = getProductImage(rel.id, rel.src);

                  return (
                    <div
                      key={rel.id}
                      className="group relative flex flex-col justify-between rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm hover:border-[#00897B] hover:shadow-lg transition-all"
                    >
                      {/* Wishlist Heart at Top Right */}
                      <button
                        type="button"
                        onClick={() => toggleWishlist(rel.id, rel.name)}
                        aria-label="Save to wishlist"
                        className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-300 shadow-2xs transition-all cursor-pointer"
                      >
                        <Heart
                          className={`size-4 ${isRelSaved ? "fill-red-500 text-red-500" : ""}`}
                        />
                      </button>

                      {/* Image Stage */}
                      <Link
                        href={`/products/${rel.id}`}
                        className="relative block aspect-[4/3] w-full rounded-2xl bg-[#F8FAFC] overflow-hidden p-4"
                      >
                        <ProductPhoto
                          src={relPhoto}
                          alt={rel.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                        />
                      </Link>

                      {/* Content */}
                      <div className="mt-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              House of Ajantha
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-slate-400">
                              {rel.code || "Verified SKU"}
                            </span>
                          </div>
                          <Link
                            href={`/products/${rel.id}`}
                            className="block text-sm font-bold text-[#102A43] hover:text-[#00897B] transition-colors line-clamp-2"
                          >
                            {rel.name}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                            {rel.category} · Confirm specs
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#F1F5F9] space-y-3">
                          <div>
                            <span className="text-base font-extrabold text-[#102A43] tabular-nums">
                              {relPrice}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              per 1 complete closer set
                            </span>
                          </div>

                          <Button
                            type="button"
                            onClick={() =>
                              addToCart(rel, {
                                finish: "Metallic Silver",
                                packIndex: 0,
                                quantity: 1,
                                openDrawer: true,
                              })
                            }
                            className="w-full h-10 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <ShoppingCart className="size-3.5" />
                            <span>Add to cart</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Carousel Arrow Button */}
              <button
                type="button"
                onClick={() => handleRelatedScroll("right")}
                aria-label="Next related products"
                className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:border-[#00897B] hover:text-[#00897B] hover:scale-105 transition-all cursor-pointer"
              >
                <ChevronRight className="size-4 sm:size-5" />
              </button>
            </div>
          </section>
        )}
      </div>

      {/* 7. HIGH-RESOLUTION LIGHTBOX MODAL */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto rounded-3xl p-6 sm:p-8"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            lightboxTrigger.current?.focus();
          }}
        >
          <DialogHeader className="pr-10">
            <DialogTitle className="text-xl font-bold text-[#102A43]">{item.name}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              High-Resolution Studio Photograph · SKU: {skuCode}
            </DialogDescription>
          </DialogHeader>

          <div className="relative h-[min(65dvh,580px)] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#F8FAFC]">
            <ProductPhoto
              src={galleryThumbnails[activeThumbIdx]?.src || photoSrc}
              alt={item.name}
              fill
              sizes="(max-width: 1200px) 90vw, 900px"
              className="object-contain p-4 sm:p-8"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 8. TRADE CONSULTATION / SAMPLE QUOTE MODAL */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto rounded-3xl p-6 sm:p-8"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            quoteTrigger.current?.focus();
          }}
        >
          <DialogHeader className="pr-9">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00897B]">
              Direct Trade Desk Intake
            </span>
            <DialogTitle className="text-xl font-extrabold text-[#102A43]">
              Request Sample / Trade Quote
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              For <strong>{item.name}</strong> ({skuCode}) in {selectedFinish} · {selectedPack.label}
            </DialogDescription>
          </DialogHeader>

          {quoteSubmitted ? (
            <div className="py-6 space-y-4">
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Request Logged Successfully</AlertTitle>
                <AlertDescription>
                  Thank you, <strong>{quoteForm.name}</strong>. Your inquiry for{" "}
                  <strong>{skuCode}</strong> has been transmitted to our Trichy desk. An engineer will follow up shortly.
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                className="w-full h-11 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-sm shadow-md cursor-pointer"
                onClick={() => {
                  setQuoteSubmitted(false);
                  setQuoteDialogOpen(false);
                }}
              >
                Close Dialog
              </Button>
            </div>
          ) : (
            <form onSubmit={handleQuoteSubmit} noValidate className="space-y-4 pt-2">
              {quoteError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{quoteError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Full Name" htmlFor="q-name" required>
                  <Input
                    id="q-name"
                    required
                    value={quoteForm.name}
                    onChange={(e) => setQuoteForm({ ...quoteForm, name: e.target.value })}
                    placeholder="Your name"
                    className="h-10 rounded-xl"
                  />
                </FormField>
                <FormField label="Your Project Role" htmlFor="q-role">
                  <Select
                    value={quoteForm.role}
                    onValueChange={(val) => setQuoteForm({ ...quoteForm, role: val })}
                  >
                    <SelectTrigger id="q-role" className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Organization / Shop" htmlFor="q-org">
                  <Input
                    id="q-org"
                    value={quoteForm.organization}
                    onChange={(e) => setQuoteForm({ ...quoteForm, organization: e.target.value })}
                    placeholder="Company or shop name"
                    className="h-10 rounded-xl"
                  />
                </FormField>
                <FormField label="Project City" htmlFor="q-city">
                  <Input
                    id="q-city"
                    value={quoteForm.city}
                    onChange={(e) => setQuoteForm({ ...quoteForm, city: e.target.value })}
                    placeholder="Trichy, Chennai, etc."
                    className="h-10 rounded-xl"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Phone Number" htmlFor="q-phone" required>
                  <Input
                    id="q-phone"
                    type="tel"
                    required
                    value={quoteForm.phone}
                    onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })}
                    placeholder="+91 98XXX XXXXX"
                    className="h-10 rounded-xl"
                  />
                </FormField>
                <FormField label="Work Email" htmlFor="q-email">
                  <Input
                    id="q-email"
                    type="email"
                    value={quoteForm.email}
                    onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                    placeholder="name@company.com"
                    className="h-10 rounded-xl"
                  />
                </FormField>
              </div>

              <FormField label="Project Scope / Requirements" htmlFor="q-notes">
                <Textarea
                  id="q-notes"
                  rows={3}
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  placeholder="Share door aperture counts, profile lengths, or delivery date..."
                  className="rounded-xl text-xs"
                />
              </FormField>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setQuoteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={quoteSubmitting}
                  className="h-10 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs px-5 shadow-sm"
                >
                  {quoteSubmitting ? "Submitting..." : "Send Trade Request"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
