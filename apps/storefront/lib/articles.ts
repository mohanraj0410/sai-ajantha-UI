export interface ArticleItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  tag: string;
  imageSrc: string;
  excerpt: string;
  content: string[];
  productLink: string;
  relatedCategoryLabel: string;
}

export const USEFUL_ARTICLES: readonly ArticleItem[] = [
  {
    id: "door-closer-guide",
    slug: "door-closer-sizing-guide",
    title: "Door Closer Selection Guide: Checking Weight, Width & Arm Type",
    category: "Door Controls",
    tag: "Technical Guide",
    imageSrc:
      "/products/Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-60-001]-img.jpg",
    excerpt:
      "How to measure door weight, leaf width, and frame clearance before selecting a hydraulic surface door closer for commercial or residential doors.",
    content: [
      "Selecting the right surface door closer starts with verifying two physical limits on your door leaf: total door weight (for example, up to 60 kg, 80 kg, or 100 kg models) and maximum door width (such as 950 mm to 1250 mm).",
      "Before replacing an existing closer, inspect the arm geometry (scissor arm vs track arm) and confirm mounting clearance on both the door leaf and top frame transom. Dual-valve closers provide separate adjustments for closing sweep and final latching speed.",
      "Note on Floor Springs: Floor spring units follow separate floor-box recess and handing requirements and are handled via quotation and route confirmation prior to ordering.",
    ],
    productLink: "/products?category=Door+Closer+%26+Floor+Spring",
    relatedCategoryLabel: "Door Closers & Floor Springs",
  },
  {
    id: "aluminium-alloy-guide",
    slug: "architectural-aluminium-sections-overview",
    title: "Aluminium Sections: Checking Track Profiles & Aperture Dimensions",
    category: "Aluminium Sections",
    tag: "Specification Guide",
    imageSrc: "/products/Aluminium-[A-Interlock-12-028]-interlock.jpg",
    excerpt:
      "Key dimensional checks for multi-track sliding window profiles, interlock sections, and office partition extrusions before placing an order.",
    content: [
      "Architectural aluminium sections are supplied in standard commercial extrusion lengths. Confirming track count, wall thickness, and glass groove compatibility on your project drawings prevents on-site assembly mismatches.",
      "Pair extruded sliding and partition profiles with compatible EPDM/PVC compression gaskets, interlock stiles, and FGM corner joinery for smooth operation and weather sealing.",
      "For cut-to-length or bulk tender quantities, submit dimensions with units and delivery PIN code via our quotation desk.",
    ],
    productLink: "/products?category=Aluminium",
    relatedCategoryLabel: "Aluminium Sections",
  },
  {
    id: "insect-screen-selection",
    slug: "pleated-vs-mesh-insect-screens",
    title: "Finished Insect Screens & Mesh Rolls: Measuring Your Opening",
    category: "Insect Screens",
    tag: "Buying Guide",
    imageSrc:
      "/products/finshed-Inset-screens-[SA-IS-duro-pleated-014]-img.jpg",
    excerpt:
      "Comparing ready-to-fit pleated insect screen frames with bulk mesh rolls, and what measurements to share for custom openings.",
    content: [
      "Finished pleated and box-frame insect screens are suitable for doors and windows where clean opening clearance and easy operation are required. Always measure clear aperture width and height in millimetres or feet before requesting a quote.",
      "When ordering replacement screening mesh by roll width (such as 3 ft or 3.5 ft rolls), verify the frame spline groove and confirm whether stainless steel or fibreglass mesh specification is required for your application.",
      "For made-to-measure insect screens or separate fitting assistance, submit a product quotation and an independent installation request.",
    ],
    productLink: "/products?category=Insect+Screens",
    relatedCategoryLabel: "Finished Insect Screens",
  },
] as const;
