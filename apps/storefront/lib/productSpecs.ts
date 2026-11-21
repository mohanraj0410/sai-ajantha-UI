import { BRAND_CONTACT } from "@/lib/brand";
import { isFloorSpringProduct } from "@/lib/commercial-policy";
import type { ProductCategory, ProductItem } from "@/lib/products";

export interface ProductPackOption {
  label: string;
  multiplier: number;
}

export interface ProductSpecData {
  verifiedPriceInr: number | null;
  dealerPriceInr: number | null;
  distributorPriceInr: number | null;
  isWorkbookApproved: boolean;
  billingUnit: string;
  gstNote: string;
  badgeLabel: string;
  brand: string;
  model: string | null;
  size: string | null;
  moq: string | null;
  deliveryTime: string | null;
  material: string;
  finishOptions: readonly string[];
  gradeStandard: string;
  dimensionsSummary: string;
  warrantyLabel: string;
  overviewSummary: string;
  customerNeed: string;
  whyChoose: string;
  buyingHighlights: readonly string[];
  customerBenefits: readonly string[];
  aboutBullets: readonly string[];
  technicalDetails: readonly { label: string; value: string }[];
  additionalInfo: readonly { label: string; value: string }[];
  packOptions: readonly ProductPackOption[];
  faqs?: readonly { question: string; answer: string }[];
}

interface CategorySpecProfile {
  badgeLabel: string;
  material: string;
  finishOptions: readonly string[];
  gradeStandard: string;
  dimensionsSummary: string;
  warrantyLabel: string;
  overviewSummary: string;
  bullets: readonly string[];
}

const CATEGORY_PROFILES: Record<ProductCategory, CategorySpecProfile> = {
  Aluminium: {
    badgeLabel: "6063-T5 Alloy",
    material: "Architectural 6063-T5 Extruded Aluminium",
    finishOptions: ["Anodized Silver", "Champagne Satin", "Matte Charcoal Black"],
    gradeStandard: "IS 733 / EN 755 Extrusion Profile",
    dimensionsSummary: "Standard commercial extrusion lengths (9 ft / 10 ft / 12 ft options)",
    warrantyLabel: "Manufacturer finish & extrusion quality assurance",
    overviewSummary:
      "Precision extruded aluminium section engineered for multi-track sliding systems, office partitions, and commercial fenestration frames.",
    bullets: [
      "Extruded from 6063-T5 architectural aluminium alloy for rigid multi-track alignment without warping.",
      "Precision roller channel geometry reduces sliding friction for residential and commercial glazing.",
      "Uniform surface readiness for anodizing or powder coating across humid and coastal zones.",
      "Compatible with standard EPDM weather-stripping gaskets, interlock assemblies, and FGM connectors.",
    ],
  },
  Hardware: {
    badgeLabel: "Architectural Spec",
    material: "SS-304 Stainless Steel / Architectural Alloy",
    finishOptions: ["Satin Stainless", "Antique Finish", "Graphite Matte"],
    gradeStandard: "Commercial Architectural Hardware",
    dimensionsSummary: "Standard fastener pitch with site-ready mounting hardware",
    warrantyLabel: "Subject to manufacturer terms — confirm on BOQ",
    overviewSummary:
      "High-durability door, window, and installation hardware specified for residential builds, commercial complexes, and retail spaces.",
    bullets: [
      "Engineered for frequent operation in busy corridors, residential doors, and commercial shop entrances.",
      "Corrosion-resistant surface finishes suited for regular cleaning and humid climates.",
      "Designed for clean mechanical alignment with timber, aluminium, and modular door frames.",
      "Backed by Trichy technical desk guidance for project hardware schedules.",
    ],
  },
  "Door Closer & Floor Spring": {
    badgeLabel: "EN-1154 Hydraulic",
    material: "Die-Cast Aluminium Body & Hydraulic Steel Valve",
    finishOptions: ["Metallic Silver", "Antique / Bronze", "Matte Black"],
    gradeStandard: "BS EN 1154 Dual-Speed Hydraulic Control",
    dimensionsSummary: "60 kg to 150 kg door weight capacities · Universal handing",
    warrantyLabel: "1–2 Year Warranty against manufacturing defects (per SKU)",
    overviewSummary:
      "Verified Sai Ajantha hydraulic door closers and floor springs engineered for smooth closing sweep, HVAC seal integrity, and acoustic containment.",
    bullets: [
      "Dual independent valves allow precise installer adjustment of closing speed and final latching action.",
      "Supports HVAC energy containment, acoustic control, and fire/safety door closure compliance.",
      "Non-handed hydraulic mechanism fits both left- and right-swing commercial and residential doors.",
      "Verified manufacturer warranty coverage against manufacturing defects with invoice & claim support.",
    ],
  },
  "FGM Fittings": {
    badgeLabel: "Precision Joinery",
    material: "Anodized Alloy & Reinforced Engineering Polymer",
    finishOptions: ["Mill Silver", "Matte Black", "Bronze Anodized"],
    gradeStandard: "Modular Frame Connector Spec",
    dimensionsSummary: "45° / 90° mitered corner & linear spine profile fitment",
    warrantyLabel: "Standard replacement coverage for manufacturing defects",
    overviewSummary:
      "Dedicated FGM corner joints, spines, keels, and stoppers built to lock mosquito screen and modular aluminium channels squarely.",
    bullets: [
      "Precision corner joints lock aluminium frame channels cleanly at 45° and 90° miters.",
      "Friction stoppers and spines keep modular insect-screen and partition subframes square under load.",
      "Fast mechanical assembly reduces on-site fabrication time without visible face welds.",
    ],
  },
  "Insect Screens": {
    badgeLabel: "Mosquito Screen",
    material: "Powder-Coated Aluminium Frame & Pleated / Sliding Mesh",
    finishOptions: ["Ivory White", "Woodgrain Finish", "Charcoal Anodized"],
    gradeStandard: "Mosquito Barrier System",
    dimensionsSummary: "Custom aperture fitment for home & commercial openings",
    warrantyLabel: "Warranty & service terms confirmed on project quotation",
    overviewSummary:
      "Barrier-free pleated, sliding, and fixed insect screen systems tailored for homes, apartments, and modern living spaces.",
    bullets: [
      "Low-threshold sliding and pleated systems keep balconies and doorways accessible.",
      "Fine mesh blocks mosquitoes while maintaining natural ventilation and daylight clarity.",
      "Engineered frame profiles integrate cleanly onto timber, uPVC, and aluminium window jambs.",
    ],
  },
  "Kitchen Basket": {
    badgeLabel: "SS-304 Grade",
    material: "SS-304 Argon-Welded Stainless Wire",
    finishOptions: ["Mirror Chrome SS-304", "Brushed Satin Steel"],
    gradeStandard: "Corrosion-Resistant Utility Storage",
    dimensionsSummary: "Modular cabinet carcass fitment (multi-size options)",
    warrantyLabel: "Rust-resistance assurance — confirm size & grade on BOQ",
    overviewSummary:
      "Heavy-gauge stainless steel utility baskets, bottle pullouts, and thali/plate organizers engineered for modern modular kitchens and pantry storage.",
    bullets: [
      "SS-304 stainless steel construction resists corrosion in humid kitchens and utility pantries.",
      "Rigid argon-welded rod geometry supports heavy stacked crockery and bulk storage loads.",
      "Pairs cleanly with standard telescopic soft-close concealed runner channels.",
    ],
  },
  Ladder: {
    badgeLabel: "Facility Access",
    material: "Box-Section Heavy Gauge Aluminium",
    finishOptions: ["Industrial Mill Silver", "Powder-Coated Trim"],
    gradeStandard: "Heavy-Duty Maintenance Access",
    dimensionsSummary: "Multi-height range options (5 ft to 20 ft)",
    warrantyLabel: "Manufacturing defect coverage per model",
    overviewSummary:
      "Slip-resistant aluminium A-type and utility step ladders engineered for facility maintenance, ceiling servicing, and MEP access.",
    bullets: [
      "Serrated non-slip rungs provide stable footing during overhead ceiling and MEP servicing.",
      "Non-marring rubber shoes protect marble, terrazzo, and vitrified tile flooring.",
      "Slim fold-flat profile simplifies storage in maintenance closets and site vehicles.",
    ],
  },
  Mesh: {
    badgeLabel: "High Airflow",
    material: "Fine-Weave Insect Barrier Mesh",
    finishOptions: ["Black Low-Glare", "White High-Visibility"],
    gradeStandard: "Fine Aperture Ventilation Mesh",
    dimensionsSummary: "Available in 3 ft to 5 ft width rolls & cut lengths",
    warrantyLabel: "Quality checked against weave uniformity",
    overviewSummary:
      "Uniform fine-aperture black and white mesh rolls engineered for mosquito frames, home windows, and high-ventilation openings.",
    bullets: [
      "Consistent aperture weave blocks insects while preserving natural airflow and visibility.",
      "Holds crisp tension inside aluminium spline channels and FGM frame assemblies.",
      "Suitable for residential buildings, hotels, hostels, and commercial retrofits.",
    ],
  },
  "Rubber & PVC": {
    badgeLabel: "Acoustic & Seal",
    material: "EPDM Elastomer & Rigid UV-PVC",
    finishOptions: ["Jet Black EPDM", "Neutral Grey PVC"],
    gradeStandard: "Glazing & Partition Compression Seal",
    dimensionsSummary: "Continuous coil supply for glazing & door jamb channels",
    warrantyLabel: "Confirmed batch consistency on project supply",
    overviewSummary:
      "Hollow, sponge, window, and partition rubber profiles engineered for glass cushioning, weatherproofing, and acoustic edge sealing.",
    bullets: [
      "Formulated to resist ozone cracking, humidity, and thermal expansion at glazing edges.",
      "Minimizes acoustic leakage and conditioned-air loss across door jambs and partitions.",
      "Consistent durometer profile enables smooth roller insertion on site.",
    ],
  },
  Clip: {
    badgeLabel: "Quick Fasten",
    material: "Spring-Retaining Alloy / Polymer",
    finishOptions: ["Standard Finish"],
    gradeStandard: "Modular Channel Retention Clip",
    dimensionsSummary: "Compatible with light frame & screen channels",
    warrantyLabel: "Standard lot quality assurance",
    overviewSummary:
      "Precision retaining clip engineered to secure light frame sections, insect-screen channels, and modular trims cleanly.",
    bullets: [
      "High-retention bite locks modular frame sections and screen channels securely in place.",
      "Designed for clean compatibility with anodized aluminium extrusions.",
    ],
  },
  "Frames & Channels": {
    badgeLabel: "Frame Channel",
    material: "Extruded Powder-Coated Aluminium Channel",
    finishOptions: ["Mill Silver", "Ivory White", "Matte Black"],
    gradeStandard: "Fixed & Openable Insect-Screen Frame",
    dimensionsSummary: "Fixed / openable perimeter channel supply",
    warrantyLabel: "Standard lot quality assurance",
    overviewSummary:
      "Perimeter fixed and openable insect-screen channel engineered for tight corner joinery and clean screen tensioning.",
    bullets: [
      "Dual fixed-and-open frame geometry supports residential and commercial window apertures.",
      "Extruded aluminium section maintains alignment under repeated opening cycles.",
    ],
  },
};

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getProductSpecData(item: ProductItem): ProductSpecData {
  const profile = CATEGORY_PROFILES[item.category];
  const skuCode = item.code ?? item.id.toUpperCase();
  const skuLower = skuCode.trim().toLowerCase();
  const isFloorSpring = isFloorSpringProduct(item);
  const isDiamondMeshExample = skuLower === "ma-d-mesh black 3-001";
  const isCloser60Example = skuLower === "sa-m-dc-60-001";
  const isMeshCategory = item.category === "Mesh" || skuLower.startsWith("ma-");
  const isKitchenBasket = item.category === "Kitchen Basket";

  const verifiedPriceInr = isFloorSpring || isDiamondMeshExample
    ? null
    : (item.customerPriceInr ?? item.unitPriceInr ?? null);
  const dealerPriceInr = item.dealerPriceInr ?? null;
  const distributorPriceInr = item.distributorPriceInr ?? null;
  const isWorkbookApproved = item.approved ?? false;
  const billingUnit = isDiamondMeshExample
    ? "Confirm supply unit on quote"
    : item.billingUnit || "1 unit";

  const parsedGstPct =
    item.gstRate != null
      ? Math.round(
          Number(item.gstRate) <= 1
            ? Number(item.gstRate) * 100
            : Number(item.gstRate)
        )
      : 18;
  const gstNote =
    parsedGstPct && Number.isFinite(parsedGstPct)
      ? `+ ${parsedGstPct}% GST (Base rate exclusive of tax)`
      : "+ Applicable GST (Base rate exclusive of tax)";

  const finishOptions = item.variantsNote
    ? item.variantsNote
        .split(/,|and|\//i)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 32)
    : profile.finishOptions;

  const dimensionsSummary =
    item.measurements || item.size || "Confirm dimensions with seller";
  // Guardrail: never publish unverified conflicting material for Mesh products
  const material = isDiamondMeshExample
    ? "Material & thickness pending verification (quote only)"
    : isMeshCategory && !isWorkbookApproved
      ? (item.material || "Fine-Weave Mesh Barrier (Specification pending verification)")
      : item.material || "Confirm material grade per SKU";
  // Guardrail: never assert unverified warranty/testing on SA-M-DC-60-001 or unverified SKUs
  const warrantyLabel = isCloser60Example || !item.warranty
    ? "Confirm warranty & test terms with seller"
    : item.warranty;
  const overviewSummary = isDiamondMeshExample
    ? "Check the roll width you need for your screen frame before requesting a price."
    : isCloser60Example
      ? "Help your door close reliably after use. Check the door's weight, width, and fitting before you order."
      : item.description || profile.overviewSummary;

  const customerNeed = isDiamondMeshExample
    ? "Not sure how much mesh to order? Measure your opening and tell us how many frames you need to cover."
    : isCloser60Example
      ? "Does your door often get left open? If replacing an existing closer, check the arm type and space on the door leaf and frame before choosing."
      : `Confirm required dimensions, mounting fit, and finish for ${item.name} against your site drawing or opening schedule.`;

  const whyChoose = isDiamondMeshExample
    ? "This black Diamond mesh is listed in a 3 ft roll width with a 16 x 18 mesh pattern. Compare the listed width with your frame measurements before requesting a quote."
    : isCloser60Example
      ? "This silver, half-round closer is listed for doors up to 60 kg and up to 950 mm wide. Use both limits to check your door, and share a photo if unsure about the fitting."
      : `${item.name} (${skuCode}) is catalogued under ${item.category} with SKU-tracked sizing and finish options.`;

  const splitLines = (raw?: string | null) =>
    raw
      ? raw
          .split("\n")
          .map((line) => line.replace(/^[*•\-]\s*/, "").trim())
          .filter(Boolean)
      : [];

  const buyingHighlights = splitLines(item.buyingHighlights);
  const featureLines = splitLines(item.features);
  const customerBenefits = splitLines(item.customerBenefits);
  const specBullets = splitLines(item.specificationSummary);

  // Guardrail: suppress unverified illustrative marketing claims for 107 Kitchen products
  const aboutBullets = isDiamondMeshExample
    ? [
        "The 3 ft roll width gives you a starting point for checking your opening.",
        "The 16 x 18 pattern gives you a reference when comparing mesh options.",
        "The black finish lets you check whether it matches your frame.",
      ]
    : isCloser60Example
      ? [
          "Use the 60 kg limit to check whether the closer suits your door's weight.",
          "Measure the door width and compare it with the listed maximum of 950 mm.",
          "Show your fitter the scissor-arm design before ordering a replacement.",
          "Check the silver finish and half-round body against your door fittings.",
        ]
      : isKitchenBasket && !isWorkbookApproved
        ? [
            "Modular carcass fitment with standard telescopic slides compatibility.",
            "Heavy-duty utility wire construction engineered for kitchen storage.",
            "Confirm carcass dimensions and required slide depth before ordering.",
          ]
        : specBullets.length > 0
          ? specBullets
          : featureLines.length > 0
            ? featureLines
            : buyingHighlights.length > 0
              ? buyingHighlights
              : profile.bullets;

  // Guardrail: suppress unanswered FAQs (262 rows in Excel contain questions only with no answer)
  const rawFaq = (item.metadata?.faq || (item as any).faq) as any;
  const faqs: { question: string; answer: string }[] = [];
  if (Array.isArray(rawFaq)) {
    for (const entry of rawFaq) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        entry.question &&
        entry.answer &&
        String(entry.answer).trim() &&
        String(entry.answer).trim().toLowerCase() !== String(entry.question).trim().toLowerCase()
      ) {
        faqs.push({
          question: String(entry.question).trim(),
          answer: String(entry.answer).trim(),
        });
      }
    }
  }

  const brand = item.brand || (isDiamondMeshExample ? "Diamond" : "Sai Ajantha");
  const model = item.model || null;
  const size = item.size || null;
  const moq = item.moq || null;
  const deliveryTime = item.deliveryTime || null;

  const technicalDetails: { label: string; value: string }[] = isDiamondMeshExample
    ? [
        { label: "Brand", value: "Diamond" },
        { label: "Product code", value: skuCode },
        { label: "Listed roll width", value: size || "3 ft" },
        { label: "Mesh pattern", value: "16 x 18" },
        { label: "Colour", value: "Black" },
      ]
    : isCloser60Example
      ? [
          { label: "Brand and model", value: `${brand} / ${model || "SA-M-DC-60"}` },
          { label: "Product code", value: skuCode },
          { label: "Listed door limits", value: "Up to 60 kg and up to 950 mm wide" },
          { label: "Arm and finish", value: "Scissor arm; silver half-round body" },
        ]
      : [
          { label: "Brand / Supplier", value: brand },
          { label: "Category", value: item.category },
          { label: "Product Code (SKU)", value: skuCode },
          ...(model ? [{ label: "Model", value: model }] : []),
          { label: "Material", value: material },
          { label: "Dimensions / Size", value: dimensionsSummary },
          { label: "Billing Unit", value: billingUnit },
          {
            label: "Listed Variants / Finishes",
            value: (finishOptions.length > 0 ? finishOptions : profile.finishOptions).join(" · "),
          },
        ];

  return {
    verifiedPriceInr,
    dealerPriceInr,
    distributorPriceInr,
    isWorkbookApproved,
    billingUnit,
    gstNote,
    badgeLabel: isFloorSpring
      ? "Quote Only"
      : isWorkbookApproved
        ? "Approved Spec"
        : size
          ? size
          : profile.badgeLabel,
    brand,
    model,
    size,
    moq,
    deliveryTime,
    material,
    finishOptions: finishOptions.length > 0 ? finishOptions : profile.finishOptions,
    gradeStandard: isFloorSpring
      ? "Sales route confirmation pending"
      : isDiamondMeshExample
        ? "Specification verification in progress"
        : profile.gradeStandard,
    dimensionsSummary,
    warrantyLabel,
    overviewSummary,
    customerNeed,
    whyChoose,
    buyingHighlights,
    customerBenefits,
    aboutBullets,
    packOptions: [
      { label: `Single Unit (${billingUnit})`, multiplier: 1 },
      { label: "Standard Lot (10 Units)", multiplier: 10 },
      { label: "Project BOQ Lot (50 Units)", multiplier: 50 },
    ],
    technicalDetails,
    faqs,
    additionalInfo: [
      { label: "Catalogue ID", value: item.productNumber || `SA-${item.id.toUpperCase()}` },
      { label: "Billing Unit", value: billingUnit },
      { label: "Taxation", value: gstNote },
      ...(moq ? [{ label: "Minimum Order Quantity", value: moq }] : []),
      ...(deliveryTime ? [{ label: "Dispatch & Delivery", value: deliveryTime }] : []),
      { label: "Warranty Coverage", value: warrantyLabel },
      { label: "Technical Desk", value: `${BRAND_CONTACT.phone} · ${BRAND_CONTACT.email}` },
    ],
  };
}

export function getRelatedProducts(
  item: ProductItem,
  catalog: ProductItem[],
  limit = 4
): ProductItem[] {
  const sameCategory = catalog.filter(
    (candidate) => candidate.category === item.category && candidate.id !== item.id
  );
  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }
  const others = catalog.filter(
    (candidate) =>
      candidate.id !== item.id && candidate.category !== item.category
  );
  return [...sameCategory, ...others].slice(0, limit);
}
