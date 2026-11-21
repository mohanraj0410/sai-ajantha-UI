import React, { useState } from "react";
import { Button, Input, Select, Text } from "@medusajs/ui";

const CATEGORIES = [
  "Aluminium",
  "Frames & Channels",
  "Hardware",
  "Glass Hardware",
  "Locks & Latches",
  "Door Controls",
  "Silicones & Sealants",
  "Screws & Fasteners",
  "Shower Enclosure",
  "Spider Fittings",
  "Accessories & Tools",
];

const BILLING_UNITS = [
  "1 length (3.66m)",
  "1 length (3.0m)",
  "1 length (6.0m)",
  "1 pc",
  "1 pair",
  "1 set",
  "1 box (100 pcs)",
  "1 box (50 pcs)",
  "1 carton (10 pcs)",
  "1 kg",
  "1 cartridge (300ml)",
];

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (created: unknown) => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Aluminium");
  const [subcategory, setSubcategory] = useState("");
  const [brand, setBrand] = useState("Sai Ajantha");
  const [size, setSize] = useState("");
  const [material, setMaterial] = useState("Aluminium Alloy 6063-T5");
  const [billingUnit, setBillingUnit] = useState("1 length (3.66m)");
  const [customerPrice, setCustomerPrice] = useState<string>("");
  const [contractorPrice, setContractorPrice] = useState<string>("");
  const [dealerPrice, setDealerPrice] = useState<string>("");
  const [distributorPrice, setDistributorPrice] = useState<string>("");
  const [gstRate, setGstRate] = useState("18");
  const [stockQty, setStockQty] = useState("50");
  const [src, setSrc] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-fill tier pricing based on Customer MRP
  const autoFillTiers = () => {
    const mrp = parseFloat(customerPrice);
    if (!mrp || mrp <= 0) return;
    setContractorPrice((mrp * 0.88).toFixed(2)); // 12% off
    setDealerPrice((mrp * 0.78).toFixed(2)); // 22% off
    setDistributorPrice((mrp * 0.65).toFixed(2)); // 35% off
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!sku.trim() || !name.trim() || !category.trim()) {
      setError("SKU, Product Name, and Category are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim(),
        subcategory: subcategory.trim() || category.trim(),
        brand: brand.trim(),
        size: size.trim() || "Standard",
        material: material.trim(),
        billingUnit: billingUnit.trim(),
        customerPriceInr: customerPrice ? parseFloat(customerPrice) : null,
        contractorPriceInr: contractorPrice ? parseFloat(contractorPrice) : null,
        dealerPriceInr: dealerPrice ? parseFloat(dealerPrice) : null,
        distributorPriceInr: distributorPrice ? parseFloat(distributorPrice) : null,
        gstRate: parseInt(gstRate, 10) || 18,
        stockQty: parseInt(stockQty, 10) || 25,
        src: src.trim(),
        description: description.trim(),
        approved: true,
      };

      const res = await fetch("/admin/sai-ajanta/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create product");
      }

      setSuccessMsg(`Product ${sku} created successfully!`);
      if (onSuccess) onSuccess(data.product);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-ui-border-base bg-ui-bg-base p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ui-border-base pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102d4d] text-white dark:bg-[#079d9a]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-ui-fg-base">Add New Architectural Product</h2>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Registers live SKU with Medusa catalog and 4-tier B2B INR pricing
              </Text>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ui-fg-muted hover:bg-ui-bg-subtle hover:text-ui-fg-base"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 p-3 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 rounded-lg bg-emerald-500/10 p-3 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Section 1: Basic Identifiers */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                SKU Code *
              </label>
              <Input
                placeholder="e.g. SA-ALM-EXT-045"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                Product Title *
              </label>
              <Input
                placeholder="e.g. Architectural Modular Extrusion Profile"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Section 2: Category & Brand */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                Category *
              </label>
              <Select value={category} onValueChange={(val) => setCategory(val)}>
                <Select.Trigger>
                  <Select.Value placeholder="Select Category" />
                </Select.Trigger>
                <Select.Content>
                  {CATEGORIES.map((cat) => (
                    <Select.Item key={cat} value={cat}>
                      {cat}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                Subcategory / Section
              </label>
              <Input
                placeholder="e.g. Structural Framing"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                Brand
              </label>
              <Input
                placeholder="e.g. Sai Ajantha"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
          </div>

          {/* Section 3: Technical Specifications */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                Size / Dimension
              </label>
              <Input
                placeholder="e.g. 50mm x 25mm x 1.5mm"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                Material Grade
              </label>
              <Input
                placeholder="e.g. Aluminium Alloy 6063-T5"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                Billing Unit
              </label>
              <Select value={billingUnit} onValueChange={(val) => setBillingUnit(val)}>
                <Select.Trigger>
                  <Select.Value placeholder="Billing Unit" />
                </Select.Trigger>
                <Select.Content>
                  {BILLING_UNITS.map((u) => (
                    <Select.Item key={u} value={u}>
                      {u}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          </div>

          {/* Section 4: 4-Tier Pricing (INR) */}
          <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ui-fg-base">
                  4-Tier B2B Commercial Pricing (INR ₹)
                </h3>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Prices exclude GST. Tier multipliers can be auto-calculated from MRP.
                </Text>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={autoFillTiers}
                className="text-xs"
              >
                Auto Slabs (12% / 22% / 35%)
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                  Customer MRP (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={customerPrice}
                  onChange={(e) => setCustomerPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                  Contractor (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={contractorPrice}
                  onChange={(e) => setContractorPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                  Dealer (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={dealerPrice}
                  onChange={(e) => setDealerPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Distributor (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={distributorPrice}
                  onChange={(e) => setDistributorPrice(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 5: Inventory, Tax & Media */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                GST Rate (%)
              </label>
              <Select value={gstRate} onValueChange={(val) => setGstRate(val)}>
                <Select.Trigger>
                  <Select.Value placeholder="GST Rate" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="18">18% (Standard Architectural)</Select.Item>
                  <Select.Item value="12">12% (Profiles &amp; Sheets)</Select.Item>
                  <Select.Item value="28">28% (Luxury Fittings)</Select.Item>
                  <Select.Item value="0">0% (Nil / Exempt)</Select.Item>
                </Select.Content>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                Opening Stock Qty
              </label>
              <Input
                type="number"
                min="0"
                placeholder="25"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                Product Image URL / Media Path
              </label>
              <Input
                placeholder="http://localhost:9000/static/..."
                value={src}
                onChange={(e) => setSrc(e.target.value)}
              />
            </div>
          </div>

          {/* Section 6: Description */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
              Technical Description &amp; Architectural Specifications
            </label>
            <Input
              placeholder="High-tensile aluminium architectural extrusion profile with anodized finish..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-ui-border-base pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className="bg-[#079d9a] hover:bg-[#068280] text-white"
            >
              {saving ? "Publishing SKU..." : "Save & Publish Product"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
