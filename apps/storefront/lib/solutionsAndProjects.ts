import type { ProductCategory } from "@/lib/products";

export interface SolutionDetail {
  slug: string;
  code: string;
  title: string;
  shortTitle: string;
  sectorMix: "Residential" | "Commercial" | "Technical";
  tagline: string;
  summary: string;
  description: string;
  image: string;
  applications: readonly string[];
  specifications: readonly { label: string; value: string }[];
  relatedCategories: readonly ProductCategory[];
}

export const SOLUTIONS: readonly SolutionDetail[] = [
  {
    slug: "residential-screens-and-door-control",
    code: "01",
    title: "Insect Screens & Door Control",
    shortTitle: "Screens & Door Control",
    sectorMix: "Residential",
    tagline: "Durable mosquito protection, smooth door closers & secure window fittings",
    summary:
      "Barrier-free pleated mesh systems, sliding insect screens, aluminium window framing, and quiet hydraulic door closers.",
    description:
      "Modern homes, apartments, and commercial complexes require reliable mosquito screening and controlled door closing. Sai Ajantha partners with homeowners, fabricators, and contractors across Tamil Nadu to supply long-lasting screen and hardware systems.",
    image: `/products/${encodeURIComponent(
      "Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-100-003]-img.jpg"
    )}`,
    applications: [
      "Balcony & Terrace Sliding Doors",
      "Main Entrance Screen & Closer Systems",
      "Apartment Windows & French Openings",
      "Commercial Entrance & Office Doors",
    ],
    specifications: [
      { label: "Door Control Rating", value: "BS EN 1154 dual-speed hydraulic closers (60–150 kg)" },
      { label: "Mosquito Screen", value: "Low-threshold pleated insect screens & SS-304/SS-316 mesh" },
      { label: "Hardware Alloy", value: "Corrosion-resistant SS-304 & anodized 6063-T5" },
      { label: "Execution Model", value: "Direct supply, dealer support & warranty backup" },
    ],
    relatedCategories: [
      "Door Closer & Floor Spring",
      "Insect Screens",
      "Hardware",
      "Rubber & PVC",
    ],
  },
  {
    slug: "commercial-interior-solutions",
    code: "02",
    title: "Commercial Interior Solutions",
    shortTitle: "Commercial Interiors",
    sectorMix: "Commercial",
    tagline: "Architectural partitions, entrance controls & office infrastructure",
    summary:
      "High-traffic entrance floor springs, glass door fittings, modular aluminium framing, and durable commercial architectural hardware.",
    description:
      "Corporate workplaces, educational campuses, and institutional complexes require crisp visual alignment alongside heavy-duty mechanical endurance. We deliver complete partition profiles, hydraulic floor springs, and architectural hardware engineered for daily commercial loads.",
    image: `/products/${encodeURIComponent(
      "Door-closer-&-Floor-spring-Floor-spring-[SA-I-FS-TON-150-010]-img.jpg"
    )}`,
    applications: [
      "Corporate Offices & Reception Lobbies",
      "Educational Institutions & Auditoriums",
      "Retail & Institutional Showrooms",
      "Commercial Glass Entrance Assemblies",
    ],
    specifications: [
      { label: "Floor Spring Capacity", value: "90 kg to 150 kg heavy glass & timber doors" },
      { label: "Partition Sections", value: "Multi-track 6063-T5 extruded aluminium profiles" },
      { label: "Seal Integrity", value: "Virgin EPDM acoustic & HVAC edge gaskets" },
      { label: "Warranty Coverage", value: "Manufacturer defect warranty backed by Trichy desk" },
    ],
    relatedCategories: [
      "Door Closer & Floor Spring",
      "Aluminium",
      "Hardware",
      "FGM Fittings",
    ],
  },
  {
    slug: "acoustic-solutions",
    code: "03",
    title: "Acoustic Solutions",
    shortTitle: "Acoustic Solutions",
    sectorMix: "Technical",
    tagline: "Performance-led sound control for quiet interiors",
    summary:
      "Sound-reducing wall & ceiling assemblies, perimeter acoustic door seals, and draft control for homes, schools, and offices.",
    description:
      "Excessive noise and draft disrupt classroom focus, home comfort, and office confidentiality. We coordinate acoustic panel systems alongside perimeter EPDM seals and controlled hydraulic door closers for effective sound containment.",
    image: `/products/${encodeURIComponent(
      "Rubber-&PVC-[MA-R-DRubber-005]-Partition-Rubber.jpg"
    )}`,
    applications: [
      "Office Meeting Rooms & Auditoriums",
      "Conference Rooms & Executive Suites",
      "Lecture Halls & Training Centres",
      "Residential Study & Media Rooms",
    ],
    specifications: [
      { label: "Perimeter Sealing", value: "High-density EPDM & rigid PVC compression gaskets" },
      { label: "Door Acoustic Fit", value: "Controlled sweep & final latch hydraulic closers" },
      { label: "System Focus", value: "Wall, ceiling & aperture sound-leakage mitigation" },
      { label: "Consultation", value: "Site requirement assessment prior to BOQ approval" },
    ],
    relatedCategories: ["Rubber & PVC", "Door Closer & Floor Spring", "Aluminium"],
  },
  {
    slug: "ceiling-and-wall-systems",
    code: "04",
    title: "Ceiling & Wall Systems",
    shortTitle: "Ceiling & Wall Systems",
    sectorMix: "Technical",
    tagline: "Modular grid alignment, cleanability & structural precision",
    summary:
      "Modular partition subframes, false ceilings, wall paneling channels, and concealed maintenance access.",
    description:
      "Our ceiling and wall infrastructure bridges structural accuracy with serviceability. Using precision-extruded aluminium sections, spring retention clips, and heavy-duty maintenance ladders, teams maintain clean architectural planes with effortless MEP access.",
    image: `/products/${encodeURIComponent(
      "Aluminium-[A-3-trk-b-12-017]-3-track-bottom-aluminium.jpg"
    )}`,
    applications: [
      "Commercial Office Partitions",
      "Modular Retail & Showroom Interiors",
      "Institutional Corridors & Atriums",
      "Overhead MEP Service Bays",
    ],
    specifications: [
      { label: "Grid & Framing", value: "IS 733 / EN 755 extruded aluminium channels" },
      { label: "Retention Hardware", value: "Spring-tempered retaining clips & corner locks" },
      { label: "Service Access", value: "150 kg rated aluminium A-type & extension ladders" },
      { label: "Alignment", value: "45° and 90° precision miter connectors" },
    ],
    relatedCategories: ["Aluminium", "Clip", "FGM Fittings", "Ladder"],
  },
  {
    slug: "aluminium-modular-infrastructure",
    code: "05",
    title: "Aluminium & Modular Infrastructure",
    shortTitle: "Aluminium Infrastructure",
    sectorMix: "Technical",
    tagline: "Precision 6063-T5 multi-track profiles & FGM connectors",
    summary:
      "2-track, 3-track, shutter box, interlock, runner sections, and CNC corner connectors for fabricators and project contractors.",
    description:
      "Built on Sai Ajantha's founding strength since 1994, our extruded aluminium inventory covers 2-track and 3-track sliding windows, interlock profiles, shutter boxes, and FGM frame connectors engineered for dimensional repeatability.",
    image: `/products/${encodeURIComponent(
      "Aluminium-[A-2trk-side-&-top-12-019]-two-Track-Side-Top-For-Top.webp"
    )}`,
    applications: [
      "Sliding Fenestration & Partition Frames",
      "Balcony & Veranda Glazing",
      "Pleated & Fixed Insect Screen Framing",
      "Custom Architectural Fabrication",
    ],
    specifications: [
      { label: "Section Lengths", value: "9 ft, 10 ft, and 12 ft commercial extrusion options" },
      { label: "Joint Hardware", value: "FGM 45°/90° corners, spines, stoppers & keels" },
      { label: "Gasket Compatibility", value: "Hollow, sponge & partition EPDM/PVC rubbers" },
      { label: "Supply Readiness", value: "Trade & contractor lot dispatch from Trichy" },
    ],
    relatedCategories: ["Aluminium", "FGM Fittings", "Rubber & PVC", "Insect Screens"],
  },
  {
    slug: "technical-interior-products",
    code: "06",
    title: "Technical Interior Products & Execution",
    shortTitle: "Technical Products & Execution",
    sectorMix: "Commercial",
    tagline: "Verified architectural hardware, storage & start-to-finish support",
    summary:
      "SS-304 modular kitchen baskets, architectural handles, aldrops, tower bolts, silicone sealants, and turnkey project coordination.",
    description:
      "Beyond primary structures, project longevity depends on every fastener, handle, hinge, sealant, and utility module. We supply complete hardware schedules backed by technical consultation, coordinated delivery, and after-sales accountability.",
    image: `/products/${encodeURIComponent(
      "Hardware-[AG-HW-026]-8-inch-american-handle.jpg"
    )}`,
    applications: [
      "Modular Kitchens & Utility Pantries",
      "Commercial Doors, Cabinets & Lockers",
      "Weatherproofing & ACP/Glass Sealing",
      "Turnkey Builder & Contractor BOQs",
    ],
    specifications: [
      { label: "Utility Storage", value: "SS-304 thali, plate, cutlery & grain trolley baskets" },
      { label: "Door Fittings", value: "Aldrops, tower bolts, I-max handles & stoppers" },
      { label: "Installation Consumables", value: "789/GP silicone, ACP tape & glass mesh tape" },
      { label: "Accountability", value: "Single-point technical desk in Trichy" },
    ],
    relatedCategories: ["Hardware", "Kitchen Basket", "Mesh", "Ladder"],
  },
] as const;

export interface ProjectCaseStudy {
  slug: string;
  title: string;
  category: "Residential Systems" | "Commercial Interiors" | "Acoustic & Framing Systems";
  sector: string;
  locationLabel: string;
  statusNote: string;
  scopeOfWork: readonly string[];
  summary: string;
  technicalChallenge: string;
  solutionDelivered: string;
  systemsUsed: readonly string[];
  image: string;
}

/**
 * Standard architectural hardware & framing specification packages
 * demonstrating approved BOQ schedules for residential, commercial,
 * and institutional installations across Tamil Nadu.
 */
export const FEATURED_PROJECTS: readonly ProjectCaseStudy[] = [
  {
    slug: "residential-apartment-screens-and-hardware",
    title: "Residential Apartment Insect Screens & Door Control Fit-Out",
    category: "Residential Systems",
    sector: "Residential · Multi-Storey Apartments",
    locationLabel: "Tamil Nadu · Reference Specification Schedule",
    statusNote: "Standard System Specification · Verified BOQ Schedule",
    scopeOfWork: [
      "EN-1154 Hydraulic Door Closers across main entrance doors",
      "Low-threshold pleated insect screens for mosquito protection",
      "Perimeter EPDM acoustic & draft-seal gaskets",
    ],
    summary:
      "Integrated door control, mosquito screening, and perimeter sealing designed for daily family living and tropical weather durability.",
    technicalChallenge:
      "High-traffic residential balcony and entrance doorways require smooth, barrier-free mosquito protection that withstands coastal humidity and frequent operation without jamming.",
    solutionDelivered:
      "Supplied dual-valve hydraulic door closers calibrated for gentle latching, paired with low-track pleated insect screens and virgin EPDM perimeter sealing.",
    systemsUsed: [
      "Door Closer & Floor Spring",
      "Insect Screens",
      "Rubber & PVC",
      "Hardware",
    ],
    image: `/products/${encodeURIComponent(
      "Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-100-005]-img.jpg"
    )}`,
  },
  {
    slug: "commercial-glass-facade-entrance-package",
    title: "Commercial Office Entrance & Modular Partition System",
    category: "Commercial Interiors",
    sector: "Commercial · Workplaces & Institutional Offices",
    locationLabel: "Tiruchirappalli Region · Commercial Hardware Division",
    statusNote: "Standard System Specification · Verified BOQ Schedule",
    scopeOfWork: [
      "Heavy-duty double-cylinder hydraulic floor springs (90–150 kg)",
      "6063-T5 multi-track aluminium framing & interlock extrusions",
      "SS-304 pull handles, locks, and architectural glass patch sets",
    ],
    summary:
      "Coordinated entrance control and interior partition framing engineered for high daily footfall and crisp architectural sightlines.",
    technicalChallenge:
      "Heavy toughened glass entrance doors and multi-track aluminium partitions demand accurate floor-spring torque matching and rigid extrusion tolerances to prevent sag or rattle.",
    solutionDelivered:
      "Delivered matched Indian-origin hydraulic floor spring sets with top pivots, patch locks, and 32×300×450 mm handles alongside 2-track and 3-track extruded aluminium profiles.",
    systemsUsed: [
      "Door Closer & Floor Spring",
      "Aluminium",
      "Hardware",
    ],
    image: `/products/${encodeURIComponent(
      "Door-closer-&-Floor-spring-Floor-spring-[SA-I-FS-TON-125-009]-img.jpg"
    )}`,
  },
  {
    slug: "educational-acoustic-fenestration-package",
    title: "Institutional Campus Acoustic & Fenestration Package",
    category: "Acoustic & Framing Systems",
    sector: "Institutional · Education & Administration",
    locationLabel: "Tamil Nadu · Fenestration & Hardware Schedule",
    statusNote: "Standard System Specification · Verified BOQ Schedule",
    scopeOfWork: [
      "2-track & 3-track aluminium sliding window profiles (9–12 ft)",
      "FGM 45°/90° mitered corner connectors & friction spines",
      "Acoustic perimeter rubber seals & SS-316 fine-aperture mesh",
    ],
    summary:
      "Durable fenestration framing, corner joinery, and acoustic perimeter sealing designed for low-maintenance institutional campuses.",
    technicalChallenge:
      "Multi-classroom and administrative buildings require rapid, repeatable frame assembly with strong corner rigidity and weather/sound sealing across seasonal heat and monsoon swings.",
    solutionDelivered:
      "Standardized 6063-T5 aluminium track profiles combined with precision FGM corner locks, high-density EPDM sponge/hollow seals, and tensioned mosquito mesh assemblies.",
    systemsUsed: ["Aluminium", "FGM Fittings", "Rubber & PVC", "Mesh"],
    image: `/products/${encodeURIComponent(
      "Aluminium-[A-3trk-slide-&-top-12-013]-3rk-side-&-top.jpg"
    )}`,
  },
  {
    slug: "institutional-pantry-and-utility-fitout",
    title: "Commercial & Residential Utility Pantry & Hardware Fit-Out",
    category: "Commercial Interiors",
    sector: "Commercial Support & Premium Residential",
    locationLabel: "Tamil Nadu · Utility Hardware Division",
    statusNote: "Standard System Specification · Verified Hardware BOQ",
    scopeOfWork: [
      "SS-304 argon-welded kitchen utility baskets & pullouts",
      "Corrosion-resistant architectural aldrops, tower bolts & handles",
      "Overhead maintenance access ladders (150 kg rated)",
    ],
    summary:
      "Rust-free stainless utility storage, door security fittings, and facility maintenance equipment built for institutional longevity.",
    technicalChallenge:
      "Humid utility kitchens and wet areas rapidly corrode standard wireware, requiring true food-grade SS-304 components and dependable mechanical fasteners.",
    solutionDelivered:
      "Equipped cabinetry and utility zones with SS-304 cutlery, plate, thali, and bottle pullout baskets paired with tested architectural door hardware and aluminium maintenance ladders.",
    systemsUsed: ["Kitchen Basket", "Hardware", "Ladder"],
    image: `/products/${encodeURIComponent(
      "Kitchen-Basket-bottle-pullout-2&3-shelves-img.jpg"
    )}`,
  },
];

