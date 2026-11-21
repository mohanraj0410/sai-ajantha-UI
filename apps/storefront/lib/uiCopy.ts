/**
 * Sai Ajantha Simple English Copy Tokens
 * For Tamil Nadu Tier-2 and Tier-3 Customers, Dealers, Contractors & Distributors.
 * Simple, clear language for local home and trade buyers.
 */

export const UI_COPY = {
  nav: {
    home: "Home",
    shopByCategory: "Shop by Category",
    houseOfAjanta: "House of Ajanta",
    contact: "Contact",
    search: "Search products, sizes, categories...",
    cart: "Cart",
    account: "Account",
    dealerPortal: "Dealer Portal",
    distributorPortal: "Distributor Portal",
  },
  ctas: {
    shopNow: "Shop by Category",
    viewProducts: "View Products",
    viewDetails: "View Details",
    buyNow: "Buy Now",
    getQuote: "Get a Quote",
    requestQuote: "Request a Quote",
    checkDelivery: "Check Delivery PIN",
    sendEnquiry: "Send Enquiry",
    applyDealer: "Apply as Dealer",
    applyDistributor: "Apply as Distributor",
    requestFitting: "Need Installation? Send Request",
  },
  brand: {
    name: "Sai Ajantha Interior Solutions",
    houseOfAjanta: "House of Ajanta",
    tagline: "Quality Without Compromise",
    shortAbout:
      "Supplying quality screens, aluminium profiles, ladders and architectural hardware for homes, shops and building projects across Tamil Nadu since 1994.",
    location: "Trichy, Tamil Nadu",
  },
  categories: {
    directNine: [
      { name: "Finished Insect Screens", desc: "Keep mosquitoes out with pleated and roll-down screens for windows and doors." },
      { name: "Aluminium Sections", desc: "Extruded aluminium profiles for partitions, glazing frames, and structural work." },
      { name: "Hardware", desc: "Handles, hinges, locks, and essential fittings for doors and windows." },
      { name: "Ladders", desc: "Sturdy aluminium step ladders for home, shop, and site maintenance." },
      { name: "Rubber & PVC Beading", desc: "Weather-tight gaskets and beadings to seal glass and window panels." },
      { name: "FGM Fittings & Channels", desc: "Top track channels and rollers for smooth sliding glass partitions." },
      { name: "Clips", desc: "Fixing clips and brackets for secure ceiling and partition installations." },
      { name: "Frames & Channels", desc: "Perimeter frames and channels built for clean window and door assemblies." },
      { name: "Mesh", desc: "Stainless steel and fibreglass mesh rolls for insect screening." },
    ],
    houseOfAjantaTwo: [
      {
        name: "Door Closers",
        desc: "Smooth hydraulic door closers for residential, shop, and office doors.",
        routeNotice: "Fulfilled through authorized regional distributors.",
      },
      {
        name: "Kitchen Baskets",
        desc: "Stainless steel pull-out baskets and organisers for modular kitchen cabinets.",
        routeNotice: "Fulfilled through authorized regional distributors.",
      },
    ],
    floorSpringsNotice: "Floor Springs are available on a Request a Quote basis. Our team will verify fitting limits and route before confirming.",
  },
  trustPoints: [
    { title: "Exact Specifications", desc: "Every product shows verified sizes, limits, and units so you can check the right fit." },
    { title: "Direct & Local Supply", desc: "Direct factory-standard supply from Trichy with authorized local distributor network." },
    { title: "Transparent Pricing", desc: "Fair pricing with clear seller disclosures, delivery charges, and GST invoices." },
    { title: "Help Choosing Your Fit", desc: "Share your measurements or door photo with our team to verify fitting before buying." },
  ],
  sellerDisclosures: {
    direct: "Sold & delivered by Sai Ajantha Interior Solutions",
    distributor: "Sold & delivered by authorized local distributor serving your delivery PIN code",
    splitCartHelp: "Items from different sellers are billed and delivered separately. You will receive separate GST invoices.",
  },
  fittingNotice:
    "Product orders do not include installation. If you need fitting help, submit an installation request. A verified local contractor quotes, bills, and fits independently.",
} as const;
