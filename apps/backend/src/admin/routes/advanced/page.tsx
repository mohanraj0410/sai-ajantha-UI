import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Heading, Input, Table, Text } from "@medusajs/ui";
import { ThemeProvider } from "../../components/theme/theme-context";
import { ThemeHeader } from "../../components/theme/ThemeHeader";
import { AddProductModal } from "../../components/products/AddProductModal";

interface PortalCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  gstin: string | null;
  business_city: string | null;
  role: string;
  approval_status: string;
  created_at: string;
}

interface PriceListDemo {
  id: string;
  title: string;
  type: string;
  status: string;
  customer_group: string;
  discount_rate: string;
  description: string;
}

interface PromotionDemo {
  id: string;
  code: string;
  type: string;
  value: string;
  target: string;
  status: string;
  rules: string;
}

function AdvancedNavIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const STATIC_PRICE_LISTS: PriceListDemo[] = [
  {
    id: "plist_distributor_tier_a",
    title: "Wholesale Distributor Contract Slab A",
    type: "Contract Override",
    status: "Active",
    customer_group: "Authorized Distributors",
    discount_rate: "35% Off Base MRP",
    description: "Applies automatically to verified Distributors for all 11 catalog categories.",
  },
  {
    id: "plist_dealer_tier_b",
    title: "Authorized Dealer Commercial Price List",
    type: "Tier Override",
    status: "Active",
    customer_group: "Dealers & Fabricators",
    discount_rate: "22% Off Base MRP",
    description: "Wholesale hardware & profiles pricing for registered dealer accounts.",
  },
  {
    id: "plist_contractor_tier_c",
    title: "Commercial Contractor Trade Rate",
    type: "Volume Rate",
    status: "Active",
    customer_group: "Architectural Contractors",
    discount_rate: "12% Off Base MRP",
    description: "Special pricing for verified interior designers, installers & contractors.",
  },
  {
    id: "plist_project_bulk_extrusion",
    title: "Project Bulk Aluminium Extrusion 50+ Lengths",
    type: "Volume Slab",
    status: "Active",
    customer_group: "All Commercial Accounts",
    discount_rate: "Additional 8% Volume Slab",
    description: "Triggered on orders exceeding 50 linear units of 6063-T5 aluminium profiles.",
  },
];

const STATIC_PROMOTIONS: PromotionDemo[] = [
  {
    id: "promo_festive_2026",
    code: "SAI-FESTIVE-10",
    type: "Percentage Discount",
    value: "10% Off Cart",
    target: "Entire Order Subtotal",
    status: "Active",
    rules: "Minimum order value ₹25,000. Valid across all 11 product categories.",
  },
  {
    id: "promo_freight_waiver",
    code: "FREE-FREIGHT-75K",
    type: "Shipping Concession",
    value: "100% Freight Waiver",
    target: "Logistics Transport",
    status: "Active",
    rules: "Applies to orders exceeding ₹75,000 for V-Trans, TCI & dedicated fleet dispatch.",
  },
  {
    id: "promo_silicone_bundle",
    code: "BUNDLE-SEALANT-FREE",
    type: "Buy X Get Y",
    value: "Free Tube / Box",
    target: "Silicones & Sealants",
    status: "Active",
    rules: "Buy 10 packs of heavy duty framing fasteners, get 1 structural silicone cartridge free.",
  },
  {
    id: "promo_new_contractor",
    code: "WELCOME-ARCH-2000",
    type: "Fixed Amount Discount",
    value: "₹2,000 Flat Off",
    target: "First Commercial PO",
    status: "Active",
    rules: "Valid for first purchase of verified architects and contractors.",
  },
];

const AdvancedPageContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"CUSTOMERS" | "PRICE_LISTS" | "PROMOTIONS">("CUSTOMERS");
  const [users, setUsers] = useState<PortalCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/sai-ajanta/portal", {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users || []);
      }
    } catch (e) {
      console.error("Failed to load customers", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();

    const handleGlobalRefresh = () => {
      void fetchUsers();
    };

    window.addEventListener("sai-ajanta-refresh", handleGlobalRefresh);
    return () => {
      window.removeEventListener("sai-ajanta-refresh", handleGlobalRefresh);
    };
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.organization.toLowerCase().includes(q) ||
        (u.gstin || "").toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div className="flex flex-col gap-y-5 pb-12">
      {/* Top Header */}
      <ThemeHeader
        title="Advanced Administration"
        subtitle="Manage Customer Accounts, B2B Price Lists, and Promotional Campaign Rules"
        onAddProductClick={() => setIsAddProductOpen(true)}
      />

      {/* Advanced Tabs Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-ui-border-base bg-ui-bg-base p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("CUSTOMERS")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            activeTab === "CUSTOMERS"
              ? "bg-[#102d4d] text-white dark:bg-[#079d9a]"
              : "text-ui-fg-subtle hover:bg-ui-bg-subtle hover:text-ui-fg-base"
          }`}
        >
          Customers &amp; Groups ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("PRICE_LISTS")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            activeTab === "PRICE_LISTS"
              ? "bg-[#102d4d] text-white dark:bg-[#079d9a]"
              : "text-ui-fg-subtle hover:bg-ui-bg-subtle hover:text-ui-fg-base"
          }`}
        >
          Price Lists &amp; Tiers ({STATIC_PRICE_LISTS.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("PROMOTIONS")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            activeTab === "PROMOTIONS"
              ? "bg-[#102d4d] text-white dark:bg-[#079d9a]"
              : "text-ui-fg-subtle hover:bg-ui-bg-subtle hover:text-ui-fg-base"
          }`}
        >
          Promotions &amp; Campaigns ({STATIC_PROMOTIONS.length})
        </button>
      </div>

      {/* =========================================================================
       * SUB-TAB 1: CUSTOMERS & GROUPS
       * ========================================================================= */}
      {activeTab === "CUSTOMERS" && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold">
                Customer Accounts &amp; Wholesale Roles
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                Consolidated view of retail customers, verified contractors, and dealer accounts
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/customers">
                <Button variant="secondary" size="small">
                  Medusa Customers →
                </Button>
              </Link>
              <Link to="/customer-groups">
                <Button variant="secondary" size="small">
                  Customer Groups →
                </Button>
              </Link>
            </div>
          </div>

          <Container className="divide-y p-0 overflow-hidden shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-ui-bg-base">
              <span className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">
                Showing {filteredUsers.length} customer records
              </span>
              <div className="w-full sm:w-72">
                <Input
                  placeholder="Search customer, email, GSTIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto px-6 py-3">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Customer / Organization</Table.HeaderCell>
                    <Table.HeaderCell>Email &amp; Phone</Table.HeaderCell>
                    <Table.HeaderCell>GSTIN / City</Table.HeaderCell>
                    <Table.HeaderCell>B2B Role</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {loading ? (
                    <Table.Row>
                      <Table.Cell className="text-center py-8 text-ui-fg-muted">
                        Loading customer records...
                      </Table.Cell>
                    </Table.Row>
                  ) : filteredUsers.length === 0 ? (
                    <Table.Row>
                      <Table.Cell className="text-center py-8 text-ui-fg-muted">
                        No customers found matching search.
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    filteredUsers.map((user) => (
                      <Table.Row key={user.id} className="hover:bg-ui-bg-subtle/40 transition-colors">
                        <Table.Cell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-ui-fg-base">{user.name}</span>
                            {user.organization && (
                              <span className="text-xs text-ui-fg-muted">{user.organization}</span>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-col text-xs">
                            <span className="text-ui-fg-base">{user.email}</span>
                            <span className="text-ui-fg-muted">{user.phone || "—"}</span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-col text-xs">
                            <span className="font-mono">{user.gstin || "Unregistered"}</span>
                            <span className="text-ui-fg-muted">{user.business_city || "Tamil Nadu"}</span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color="blue">{user.role}</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge
                            color={
                              user.approval_status === "APPROVED" || user.approval_status === "ACTIVE"
                                ? "green"
                                : user.approval_status === "PENDING_APPROVAL"
                                  ? "orange"
                                  : "red"
                            }
                          >
                            {user.approval_status}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Link
                            to={`/customers/${user.id}`}
                            className="text-xs font-semibold text-[#102d4d] hover:text-[#079d9a] dark:text-[#24c6d0] hover:underline"
                          >
                            View Account →
                          </Link>
                        </Table.Cell>
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table>
            </div>
          </Container>
        </>
      )}

      {/* =========================================================================
       * SUB-TAB 2: PRICE LISTS & COMMERCIAL TIERS
       * ========================================================================= */}
      {activeTab === "PRICE_LISTS" && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold">
                B2B Price Lists &amp; Commercial Pricing Tiers
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                Contractual rate sheets that automatically override base catalog unit prices for authenticated groups
              </Text>
            </div>
            <Link to="/price-lists">
              <Button variant="primary" size="small" className="bg-[#079d9a] hover:bg-[#068280] text-white border-none shadow-none">
                + Create Price List in Medusa
              </Button>
            </Link>
          </div>

          <Container className="divide-y p-0 overflow-hidden shadow-sm">
            <div className="overflow-x-auto px-6 py-4">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Price List Title</Table.HeaderCell>
                    <Table.HeaderCell>Target Group</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                    <Table.HeaderCell>Commercial Discount</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Action</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {STATIC_PRICE_LISTS.map((pl) => (
                    <Table.Row key={pl.id} className="hover:bg-ui-bg-subtle/40 transition-colors">
                      <Table.Cell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-ui-fg-base">{pl.title}</span>
                          <span className="text-xs text-ui-fg-subtle">{pl.description}</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="blue">{pl.customer_group}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs text-ui-fg-base">{pl.type}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {pl.discount_rate}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="green">{pl.status}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Link
                          to="/price-lists"
                          className="text-xs font-semibold text-[#102d4d] hover:text-[#079d9a] dark:text-[#24c6d0] hover:underline"
                        >
                          Edit List →
                        </Link>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Container>
        </>
      )}

      {/* =========================================================================
       * SUB-TAB 3: PROMOTIONS & CAMPAIGNS
       * ========================================================================= */}
      {activeTab === "PROMOTIONS" && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold">
                Promotional Discounts &amp; Checkout Campaigns
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                Cart voucher codes, volume discounts, freight concessions, and seasonal promotional budgets
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/promotions">
                <Button variant="primary" size="small" className="bg-[#079d9a] hover:bg-[#068280] text-white border-none shadow-none">
                  + Create Promotion Code
                </Button>
              </Link>
              <Link to="/campaigns">
                <Button variant="secondary" size="small">
                  Campaign Budgets →
                </Button>
              </Link>
            </div>
          </div>

          <Container className="divide-y p-0 overflow-hidden shadow-sm">
            <div className="overflow-x-auto px-6 py-4">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Promotion Code</Table.HeaderCell>
                    <Table.HeaderCell>Discount Type</Table.HeaderCell>
                    <Table.HeaderCell>Deduction Value</Table.HeaderCell>
                    <Table.HeaderCell>Target Application</Table.HeaderCell>
                    <Table.HeaderCell>Rules &amp; Limits</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Action</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {STATIC_PROMOTIONS.map((promo) => (
                    <Table.Row key={promo.id} className="hover:bg-ui-bg-subtle/40 transition-colors">
                      <Table.Cell>
                        <span className="font-mono font-bold text-[#102d4d] dark:text-[#24c6d0]">
                          {promo.code}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="purple">{promo.type}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {promo.value}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs text-ui-fg-base">{promo.target}</span>
                      </Table.Cell>
                      <Table.Cell className="max-w-xs">
                        <span className="text-xs text-ui-fg-subtle">{promo.rules}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="green">{promo.status}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Link
                          to="/promotions"
                          className="text-xs font-semibold text-[#102d4d] hover:text-[#079d9a] dark:text-[#24c6d0] hover:underline"
                        >
                          Manage →
                        </Link>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Container>
        </>
      )}

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
      />
    </div>
  );
};

const AdvancedPage: React.FC = () => {
  return (
    <ThemeProvider>
      <AdvancedPageContent />
    </ThemeProvider>
  );
};

export const config = defineRouteConfig({
  label: "Advanced",
  icon: AdvancedNavIcon,
  rank: 5,
});

export default AdvancedPage;
