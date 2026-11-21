export const BRAND_CONTACT = {
  companyName: "Sai Ajantha Interior Solutions",
  shortName: "Sai Ajantha",
  tagline: "Quality Without Compromise.",
  foundedYear: "1994",
  city: "Trichy, Tamil Nadu",
  address: "No 32 A/6, Ramamurthy Nagar, Karur By-pass Road, Trichy 620 003",
  serviceArea: "Trichy and across Tamil Nadu",
  email: "info@ajantha.net",
  phone: "+91 98424 06588",
  phoneHref: "tel:+919842406588",
  website: "www.ajanthainteriorsolutions.com",
  websiteUrl: "https://www.ajanthainteriorsolutions.com",
  gstin: "Pending owner verification",
  slaNote: "Project & Trade Desk responds during Trichy business hours (response SLA pending owner confirmation)",
} as const;

export const BRAND_ARCHETYPE = {
  name: "The Sage–Ruler",
  summary:
    "Sai Ajantha combines the Sage's technical knowledge with the Ruler's disciplined execution. Customers come to us for clarity before purchase and confidence during delivery.",
  traits: [
    "Experienced, never outdated",
    "Technical, never confusing",
    "Confident, never arrogant",
    "Premium, never wasteful",
    "Dependable, never complacent",
  ],
} as const;

export const BRAND_HIGHLIGHTS = [
  {
    id: "screens",
    title: "Insect Screens & Protection",
    detail: "Pleated, roll-down, and barrier-free mosquito screens for windows and doors",
  },
  {
    id: "commercial",
    title: "Commercial Interiors",
    detail: "Architectural ceiling, wall, acoustic & aluminium framing systems",
  },
  {
    id: "expertise",
    title: "Technical Expertise",
    detail: "Specification guidance grounded in IS/EN standards and site realities",
  },
  {
    id: "execution",
    title: "Project Execution",
    detail: "Coordinated supply, installation oversight & schedule discipline",
  },
  {
    id: "materials",
    title: "Quality Materials",
    detail: "6063-T5 aluminium extrusions, SS-304 hardware & EN-1154 door controls",
  },
  {
    id: "support",
    title: "Customer Support",
    detail: "After-sales service and replacement warranty coverage from Trichy",
  },
] as const;

export const VISION_MISSION = {
  hook: "We do not merely supply products — we deliver interior hardware that performs, lasts, and earns trust.",
  story:
    "Established in 1994, Sai Ajantha has grown from a trusted aluminium and interior products supplier into a comprehensive screens, aluminium sections, and architectural hardware partner. Across Trichy and Tamil Nadu, we support homeowners, fabricators, contractors, building-material dealers, and commercial projects with quality products, clear specifications, and dependable execution.",
  difference:
    "Our difference is straightforward accountability: the right product before purchase, honest pricing, verified specifications, and dependable support.",
  vision:
    "To become Tamil Nadu's most trusted interior products and architectural hardware supplier, serving homes, shops, and building projects across the state through quality materials and long-term customer partnerships.",
  visionSimple:
    "Tamil Nadu's trusted partner for interior products that perform.",
  mission:
    "To supply quality interior products through honest technical guidance, exact specifications, and dependable service — making building and renovation simple and reliable for every customer.",
  promise: ["Quality.", "Expertise.", "Reliability."] as const,
} as const;

/**
 * Official Eight Core Values ("Eight values. One Firm." — Brand Guidelines p.10)
 */
export const CORE_VALUES = [
  {
    number: "01",
    title: "Quality Without Compromise",
    description:
      "Every product, specification and installation decision must protect performance, durability and customer trust.",
  },
  {
    number: "02",
    title: "Customer Success First",
    description:
      "We solve the customer's project need before pursuing short-term business advantage.",
  },
  {
    number: "03",
    title: "Timely Completion",
    description:
      "We plan carefully, communicate early and treat agreed timelines as commitments.",
  },
  {
    number: "04",
    title: "Integrity & Transparency",
    description:
      "We communicate specifications, pricing, limitations and progress honestly.",
  },
  {
    number: "05",
    title: "Long-Term Relationships",
    description:
      "We earn repeat business through dependable performance and support after handover.",
  },
  {
    number: "06",
    title: "Technical Excellence",
    description:
      "We keep learning so customers receive the right system, product and installation guidance.",
  },
  {
    number: "07",
    title: "Start-to-Finish Accountability",
    description:
      "Every project has clear ownership from consultation through completion and support.",
  },
  {
    number: "08",
    title: "Better Systems & Technology",
    description:
      "We improve coordination, visibility and customer experience through modern systems.",
  },
] as const;

/**
 * Official 7-stage Project Execution Workflow
 */
export const EXECUTION_PROCESS = [
  {
    step: "01",
    title: "Initial Consultation",
    detail:
      "Understand project requirements, space measurements, and timeline objectives.",
  },
  {
    step: "02",
    title: "Requirement Understanding",
    detail:
      "Review drawings, aperture schedules, acoustic zones, hygiene protocols, and site constraints.",
  },
  {
    step: "03",
    title: "Technical Recommendation",
    detail:
      "Propose matched aluminium sections, door control capacities, ceiling/wall assemblies, and hardware specs.",
  },
  {
    step: "04",
    title: "Product & Spec Approval",
    detail:
      "Share technical datasheets, sample kits, and transparent BOQ pricing for formal architect and client sign-off.",
  },
  {
    step: "05",
    title: "Supply & Installation",
    detail:
      "Coordinate phased material dispatch from Trichy with precision site installation support.",
  },
  {
    step: "06",
    title: "Project Handover",
    detail:
      "Verify tolerances, door closer speeds, acoustic seals, and finish readiness prior to commissioning.",
  },
  {
    step: "07",
    title: "After-Sales Support",
    detail:
      "Ongoing warranty-backed maintenance, spare availability, and responsive technical assistance.",
  },
] as const;

export const CUSTOMER_SEGMENTS = [
  {
    label: "Primary Partner · Residential & Commercial",
    title: "The Project Decision-Maker",
    roles:
      "Homeowners · Shop Owners · Builders · Project Heads · Contractors",
    trigger:
      "New home builds, shop renovations, commercial interior projects, and building upgrades.",
    painPoints:
      "Poor material longevity, project schedule delays, fragmented vendor coordination, and weak technical support.",
    assurance:
      "Single-point accountability combining technical consultation, clear BOQ quotations, product approval, and execution assurance.",
  },
  {
    label: "Secondary Partner · Trade & Design",
    title: "The Dealer, Fabricator & Architect",
    roles:
      "Architects · Interior Contractors · Commercial Contractors · Consultants",
    trigger:
      "New project specifications, client-mandated performance systems, and specialized architectural hardware requirements.",
    painPoints:
      "Wrong product selection, unreliable supply chains, installation delays, and inconsistent batch quality.",
    assurance:
      "Verified specifications, sample availability, consistent material tolerances, transparent trade pricing, and delivery commitment.",
  },
] as const;

export const TRUST_MARKS = [
  { id: "trust", label: "Trust" },
  { id: "solutions", label: "Customized Solutions" },
  { id: "screens", label: "Insect Screens" },
  { id: "materials", label: "Quality Materials" },
  { id: "design", label: "Creative Design" },
  { id: "projects", label: "Successful Projects" },
  { id: "clients", label: "Happy Clients" },
  { id: "team", label: "Expert Team" },
] as const;
