import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  UndoOutlined,
  WarningOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  PaperClipOutlined,
  FilePdfOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { adminFetch } from "../api/adminClient";
import { useAuth } from "../auth/AuthContext";
import { useAdminMutations, usePortalData, useProductDetail } from "../api/adminQueries";
import { ELEVEN_CATEGORIES } from "./ProductsPage";
import {
  AdminPageHeader,
  AdminSectionCard,
  formatInr,
} from "../components/common/AdminPrimitives";
import { AdminErrorState, AdminLoadingState } from "../components/common/AdminStateView";
import { useAdminToast } from "../components/common/AdminToastProvider";
import { BRAND_TOKENS } from "../theme/antdTheme";
import {
  areFormValuesEqual,
  imageUrlOrPathRules,
  priceRules,
  requiredTrimRule,
  skuCodeRules,
  stockQtyRules,
} from "../utils/formValidation";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

export const FIFTEEN_SOURCE_CATEGORIES = [
  "Door Closers",
  "Floor Springs",
  "Kitchen Baskets",
  "Trolleys With Slides",
  "Cabinet Accessories",
  "Vegetable Baskets",
  "Finished Frame Insect Screens",
  "Aluminium Sections",
  "Hardware",
  "Ladders",
  "Rubber and PVC Beading",
  "FGM Fittings",
  "Clips",
  "Frames and Channels",
  "Mesh",
] as const;

export const CATEGORY_SPEC_FIELDS: Record<
  string,
  { key: string; label: string; placeholder: string }[]
> = {
  "Insect Screens": [
    { key: "Mesh Material", label: "Mesh Material", placeholder: "Fiberglass / SS 304 / Pleated" },
    { key: "Mesh Aperture", label: "Aperture / Weave", placeholder: "18 x 16 / 20 x 20" },
    { key: "Frame Material", label: "Frame Material", placeholder: "Extruded Aluminium 6063-T5" },
    { key: "Frame Finish", label: "Frame Finish", placeholder: "Ivory / Bronze / Charcoal / Woodgrain" },
    { key: "Locking Type", label: "Locking Mechanism", placeholder: "Magnetic Strip / Center Latch" },
  ],
  Aluminium: [
    { key: "Alloy & Temper", label: "Alloy & Temper", placeholder: "6063 T5 / 6063 T6" },
    { key: "Wall Thickness", label: "Wall Thickness", placeholder: "1.2mm / 1.5mm / 2.0mm" },
    { key: "Standard Length", label: "Standard Length", placeholder: "12 ft / 16 ft / 3.66m" },
    { key: "Surface Treatment", label: "Surface Treatment", placeholder: "Anodized Silver / Champagne Satin / Powder Coated" },
    { key: "Weight per Length", label: "Weight per Length", placeholder: "e.g. 1.85 kg / length" },
  ],
  Hardware: [
    { key: "Load Capacity", label: "Load Capacity", placeholder: "e.g. 45 kg per pair / 80 kg" },
    { key: "Surface Finish", label: "Surface Finish", placeholder: "SS Satin / Black Matte / Antique" },
    { key: "Mounting Type", label: "Mounting Type", placeholder: "Concealed / Surface / Mortise" },
    { key: "Fasteners Included", label: "Fasteners", placeholder: "SS-304 Screws included" },
  ],
  Ladder: [
    { key: "Steps Count", label: "Steps / Rungs", placeholder: "4 / 5 / 6 / 8 / 10 Steps" },
    { key: "Working Height", label: "Working Height", placeholder: "Up to 10 ft / 14 ft" },
    { key: "Loading Capacity", label: "Duty Rating", placeholder: "Heavy Duty 150 kg" },
    { key: "Platform Type", label: "Platform Type", placeholder: "Ribbed Anti-Skid Aluminium Platform" },
    { key: "Safety Standard", label: "Standard / Certification", placeholder: "EN 131 / IS 733 Compliance" },
  ],
  "Rubber & PVC": [
    { key: "Hardness", label: "Shore Hardness", placeholder: "60A - 70A EPDM / PVC" },
    { key: "Roll Length", label: "Roll / Coil Length", placeholder: "25m / 50m / 100m Coil" },
    { key: "Weather Rating", label: "UV / Weather Resistance", placeholder: "Outdoor UV Stabilized EPDM" },
    { key: "Groove Fitment", label: "Groove Slot Width", placeholder: "4.5mm - 6.0mm Beading Slot" },
  ],
  "FGM Fittings": [
    { key: "Glass Thickness", label: "Compatible Glass Thickness", placeholder: "8mm - 12mm Toughened Glass" },
    { key: "Cover Plate Finish", label: "Cover Plate Finish", placeholder: "SS 304 Mirror / Satin Finish" },
    { key: "Gasket Material", label: "Internal Gasket", placeholder: "High Density Neoprene Gasket" },
  ],
  Clip: [
    { key: "Profile Fitment", label: "Slot / Profile Fitment", placeholder: "19mm / 25mm / 38mm Channel" },
    { key: "Pack Quantity", label: "Pack Quantity", placeholder: "100 pcs / Box" },
    { key: "Retention Type", label: "Retention Mechanism", placeholder: "Spring Snap-fit Detent" },
  ],
  "Frames & Channels": [
    { key: "Profile Section", label: "Profile Section", placeholder: "2-Track / 3-Track / U-Channel" },
    { key: "Glazing Slot", label: "Glazing Slot Width", placeholder: "5mm - 8mm Channel" },
    { key: "Drainage Weep Holes", label: "Drainage Feature", placeholder: "Factory Pre-punched Weep Holes" },
  ],
  Mesh: [
    { key: "Mesh Type", label: "Mesh Type", placeholder: "SS 304 Wire / Fiberglass / Aluminum" },
    { key: "Wire Gauge", label: "Wire Gauge", placeholder: "0.24mm / 30 SWG" },
    { key: "Roll Width", label: "Roll Width", placeholder: "3 ft / 4 ft / 5 ft" },
    { key: "Roll Length", label: "Roll Length", placeholder: "30m / 100 ft Roll" },
  ],
  "Door Closer & Floor Spring": [
    { key: "Max Door Weight", label: "Max Door Weight", placeholder: "60 kg / 80 kg / 100 kg / 120 kg" },
    { key: "Max Door Width", label: "Max Door Width", placeholder: "900mm / 1050mm / 1250mm" },
    { key: "Opening Angle", label: "Opening & Hold-Open", placeholder: "90 deg / 105 deg Hold-Open" },
    { key: "Closing Mechanism", label: "Closing Mechanism", placeholder: "Rack & Pinion Hydraulic / Concealed Cam" },
    { key: "Hydraulic Cycles", label: "Cycle Rating", placeholder: "100,000 Cycles" },
  ],
  "Kitchen Basket": [
    { key: "Cabinet Width", label: "Cabinet Width", placeholder: "450mm / 600mm / 900mm" },
    { key: "Steel Grade", label: "Steel Grade & Finish", placeholder: "SS 304 Stainless Steel" },
    { key: "Runner Type", label: "Runner Type", placeholder: "Full-extension soft-close telescopic slides" },
    { key: "Load Bearing Capacity", label: "Load Capacity", placeholder: "30 kg to 45 kg dynamic rating" },
    { key: "Closing Mechanism", label: "Closing Mechanism", placeholder: "Soft-close hydraulic dampers" },
    { key: "Installation Type", label: "Installation Type", placeholder: "Modular Carcass Side-Mount" },
  ],
};

interface ProductFormValues {
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  brand: string;
  model?: string;
  productNumber?: string;
  size?: string;
  measurementsAndUnits?: string;
  material?: string;
  billingUnit: string;
  customerPriceInr: number | null;
  contractorPriceInr: number | null;
  dealerPriceInr: number | null;
  distributorPriceInr: number | null;
  referenceSellingPriceInr: number | null;
  stockQty: number | null;
  gstRate: number;
  hsnCode?: string;
  deliveryInfo?: string;
  deliveryPriceInr: number | null;
  isManufactured: boolean;
  saleRoute: string;
  isQuoteOnly: boolean;
  minOrderQty?: string;
  maxOrderQty?: number | null;
  installationEligible: boolean;
  cmsStatus: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED";
  src?: string;
  imagesText?: string;
  otherDocumentLinksText?: string;
  warrantyInfo?: string;
  headlineNeed?: string;
  description?: string;
  highlightsText?: string;
  featuresText?: string;
  benefitsText?: string;
  variantsText?: string;
  faqText?: string;
  internalNotes?: string;
}

const DEFAULT_PRODUCT_VALUES: ProductFormValues = {
  sku: "",
  name: "",
  category: "Insect Screens",
  subcategory: "",
  brand: "Sai Ajantha",
  model: "",
  productNumber: "",
  size: "",
  measurementsAndUnits: "",
  material: "",
  billingUnit: "1 Unit",
  customerPriceInr: null,
  contractorPriceInr: null,
  dealerPriceInr: null,
  distributorPriceInr: null,
  referenceSellingPriceInr: null,
  stockQty: 0,
  gstRate: 18,
  hsnCode: "",
  deliveryInfo: "",
  deliveryPriceInr: null,
  isManufactured: false,
  saleRoute: "DIRECT_SAI_AJANTHA",
  isQuoteOnly: false,
  minOrderQty: "1",
  maxOrderQty: null,
  installationEligible: false,
  cmsStatus: "DRAFT",
  src: "",
  imagesText: "",
  otherDocumentLinksText: "",
  warrantyInfo: "",
  headlineNeed: "",
  description: "",
  highlightsText: "",
  featuresText: "",
  benefitsText: "",
  variantsText: "",
  faqText: "",
  internalNotes: "",
};

const FIELDS_BY_STEP: (keyof ProductFormValues)[][] = [
  ["name", "sku", "category", "subcategory", "brand", "model", "productNumber", "src"],
  ["billingUnit", "size", "measurementsAndUnits", "material", "isManufactured", "featuresText", "benefitsText", "variantsText"],
  ["customerPriceInr", "contractorPriceInr", "dealerPriceInr", "distributorPriceInr", "referenceSellingPriceInr", "stockQty", "gstRate", "hsnCode", "deliveryInfo", "deliveryPriceInr"],
  ["headlineNeed", "description", "imagesText", "faqText", "saleRoute", "isQuoteOnly", "minOrderQty", "maxOrderQty", "installationEligible", "warrantyInfo", "otherDocumentLinksText", "internalNotes"],
  ["cmsStatus"],
];

const splitBullets = (raw?: string): string[] =>
  (raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const STEP_ITEMS = [
  { title: "Basic Product" },
  { title: "Specs & Variants" },
  { title: "Prices & Stock" },
  { title: "Commercial & Copy" },
  { title: "Review & Publish" },
];

function findStepForField(fieldName: string): number {
  for (let idx = 0; idx < FIELDS_BY_STEP.length; idx++) {
    if ((FIELDS_BY_STEP[idx] as string[]).includes(fieldName)) {
      return idx;
    }
  }
  return 0;
}

export const ProductEditorPage: React.FC = () => {
  const { productId } = useParams();
  const isEdit = Boolean(productId);
  const navigate = useNavigate();
  const { staff } = useAuth();
  const { showToast } = useAdminToast();
  // Always load catalogue list so Create can validate SKU uniqueness against real backend SKUs
  const portal = usePortalData(staff?.email || "anon", true);
  const { createProduct, updateProduct } = useAdminMutations();

  const [form] = Form.useForm<ProductFormValues>();
  const [step, setStep] = useState(0);
  const [specFields, setSpecFields] = useState<Record<string, string>>({});
  const [newCustomSpecKey, setNewCustomSpecKey] = useState("");
  const [newCustomSpecVal, setNewCustomSpecVal] = useState("");
  const [quarantineUploads, setQuarantineUploads] = useState<Array<{
    id: string;
    sku: string;
    fileName: string;
    fileSizeBytes: number;
    publicUrl: string;
    mediaType: "IMAGE" | "TECHNICAL_PDF";
    status: string;
  }>>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<{
    values: ProductFormValues;
    specFields: Record<string, string>;
  }>({
    values: DEFAULT_PRODUCT_VALUES,
    specFields: {},
  });
  const hydratedKeyRef = useRef<string | null>(null);

  const allProducts = portal.data?.products || [];
  const singleProduct = useProductDetail(
    staff?.email || "anon",
    productId,
    isEdit && !allProducts.some((p) => p.id === productId || p.medusa_id === productId || p.sku === productId)
  );

  const existingSkus = useMemo(
    () => allProducts.map((p) => p.sku).filter(Boolean),
    [allProducts]
  );

  const existing = useMemo(
    () =>
      isEdit
        ? allProducts.find(
            (p) => p.id === productId || p.medusa_id === productId || p.sku === productId
          ) || singleProduct.data?.product
        : undefined,
    [isEdit, allProducts, productId, singleProduct.data?.product]
  );

  // Hydrate cleanly when opening Create or switching Edit productId (FORM-04 / FORM-05)
  useEffect(() => {
    if (!isEdit) {
      if (hydratedKeyRef.current !== "__NEW__") {
        hydratedKeyRef.current = "__NEW__";
        form.resetFields();
        form.setFieldsValue(DEFAULT_PRODUCT_VALUES);
        setSpecFields({});
        setStep(0);
        setInitialSnapshot({ values: DEFAULT_PRODUCT_VALUES, specFields: {} });
      }
      return;
    }

    if (existing) {
      const targetKey = `EDIT:${existing.id}:${existing.sku}`;
      if (hydratedKeyRef.current !== targetKey) {
        hydratedKeyRef.current = targetKey;
        const derivedStatus: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED" =
          existing.cms_status ||
          (existing.active && existing.approved
            ? "PUBLISHED"
            : existing.approved
            ? "APPROVED"
            : "DRAFT");
        const nextValues: ProductFormValues = {
          sku: existing.sku || "",
          name: existing.name || existing.title || "",
          category: existing.category || "Insect Screens",
          subcategory: existing.subcategory || "",
          brand: existing.brand || "Sai Ajantha",
          model: (existing as any).model || "",
          productNumber: (existing as any).product_number || (existing as any).productNumber || "",
          size: existing.size || "",
          measurementsAndUnits: (existing as any).measurements_and_units || (existing as any).measurementsAndUnits || "",
          material: existing.material || "",
          billingUnit: existing.billing_unit || (existing as any).billingUnit || "1 Unit",
          customerPriceInr: existing.customer_price_inr ?? (existing as any).customerPriceInr ?? null,
          contractorPriceInr: (existing as any).contractor_price_inr ?? (existing as any).contractorPriceInr ?? null,
          dealerPriceInr: existing.dealer_price_inr ?? (existing as any).dealerPriceInr ?? null,
          distributorPriceInr: existing.distributor_price_inr ?? (existing as any).distributorPriceInr ?? null,
          referenceSellingPriceInr: (existing as any).reference_selling_price_inr ?? (existing as any).referenceSellingPriceInr ?? null,
          stockQty: existing.stock_qty ?? (existing as any).stockQty ?? 0,
          gstRate: (existing as any).gst_rate ?? (existing as any).gstRate ?? 18,
          hsnCode: (existing as any).hsn_code ?? (existing as any).hsnCode ?? "",
          deliveryInfo: (existing as any).delivery_info ?? (existing as any).deliveryInfo ?? "",
          deliveryPriceInr: (existing as any).delivery_price_inr ?? (existing as any).deliveryPriceInr ?? null,
          isManufactured: Boolean(existing.is_manufactured),
          saleRoute: (existing as any).sale_route ?? (existing as any).saleRoute ?? (existing.category?.includes("Door") || existing.category?.includes("Kitchen") ? "DISTRIBUTOR_CHANNEL" : "DIRECT_SAI_AJANTHA"),
          isQuoteOnly: Boolean((existing as any).is_quote_only ?? (existing as any).isQuoteOnly ?? (existing.sku?.includes("-FS-") || existing.category?.includes("Floor Spring"))),
          minOrderQty: (existing as any).min_order_qty !== undefined ? String((existing as any).min_order_qty) : "1",
          maxOrderQty: (existing as any).max_order_qty ?? (existing as any).maxOrderQty ?? null,
          installationEligible: Boolean((existing as any).installation_eligible ?? (existing as any).installationEligible),
          cmsStatus: derivedStatus,
          src: existing.src || existing.thumbnail || "",
          imagesText: Array.isArray((existing as any).images) ? (existing as any).images.join("\n") : (existing.src || ""),
          otherDocumentLinksText: Array.isArray((existing as any).other_document_links) ? (existing as any).other_document_links.join("\n") : "",
          warrantyInfo: (existing as any).warranty_info ?? (existing as any).warrantyInfo ?? "",
          headlineNeed: existing.headline_need || "",
          description: existing.description || "",
          highlightsText: (existing.highlights || []).join("\n"),
          featuresText: ((existing as any).features || existing.highlights || []).join("\n"),
          benefitsText: ((existing as any).customer_benefits || (existing as any).customerBenefits || existing.benefits || []).join("\n"),
          variantsText: Array.isArray((existing as any).variants) ? (existing as any).variants.join("\n") : "",
          faqText: Array.isArray((existing as any).faq) ? (existing as any).faq.map((f: any) => typeof f === "string" ? f : f.question || "").join("\n") : "",
          internalNotes: existing.internal_notes || "",
        };
        const nextSpecs = {
          ...(((existing as any).product_specification as Record<string, string>) || {}),
          ...(existing.spec_fields || {}),
        };
        form.resetFields();
        form.setFieldsValue(nextValues);
        setSpecFields(nextSpecs);
        setStep(0);
        setInitialSnapshot({ values: nextValues, specFields: nextSpecs });
      }
    }
  }, [isEdit, productId, existing, form]);

  const watchedCategory = Form.useWatch("category", form) || "Insect Screens";
  const watchedSku = Form.useWatch("sku", form) || "";
  const allValues = Form.useWatch([], form);
  const activeSpecDefs = CATEGORY_SPEC_FIELDS[watchedCategory] || [];

  const isFloorSpring = watchedSku.toUpperCase().includes("-FS-") || watchedCategory.includes("Floor Spring");

  const isDirty = useMemo(() => {
    const currentSnapshot = {
      values: { ...DEFAULT_PRODUCT_VALUES, ...(allValues || {}) },
      specFields,
    };
    return !areFormValuesEqual(currentSnapshot, initialSnapshot);
  }, [allValues, specFields, initialSnapshot]);

  const handleDiscard = useCallback(() => {
    form.resetFields();
    form.setFieldsValue(initialSnapshot.values);
    setSpecFields({ ...initialSnapshot.specFields });
    setStep(0);
    hydratedKeyRef.current = null;
    showToast(
      isEdit ? "Restored last saved product details." : "Cleared form back to blank.",
      "info"
    );
  }, [form, initialSnapshot, isEdit, showToast]);

  const { confirmLeave, allowNextNavigation } = useUnsavedChangesGuard({
    isDirty,
    onDiscard: handleDiscard,
    enabled: true,
  });

  const handleResetForm = () => {
    form.resetFields();
    form.setFieldsValue(initialSnapshot.values);
    setSpecFields({ ...initialSnapshot.specFields });
    setStep(0);
    showToast(
      isEdit ? "Restored last saved product details." : "Cleared form back to blank.",
      "info"
    );
  };

  const isHouseOfAjantha =
    watchedCategory === "Door Closer & Floor Spring" || watchedCategory === "Kitchen Basket";

  const handleAddCustomSpec = () => {
    const k = newCustomSpecKey.trim();
    const v = newCustomSpecVal.trim();
    if (!k) {
      showToast("Please enter an attribute name.", "warning");
      return;
    }
    setSpecFields((prev) => ({ ...prev, [k]: v }));
    setNewCustomSpecKey("");
    setNewCustomSpecVal("");
  };

  const handleRemoveCustomSpec = (k: string) => {
    setSpecFields((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const handleMediaFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const currentSku = form.getFieldValue("sku") || "SA-PENDING";
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const maxSize = isPdf ? 15 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(`File exceeds maximum allowed size (${isPdf ? "15MB for PDF" : "10MB for Images"}).`, "error");
      return;
    }

    setIsUploadingMedia(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const res = await adminFetch<{ media: any; message: string }>("/admin/sai-ajanta/media/upload", {
        method: "POST",
        body: JSON.stringify({
          sku: currentSku.trim().toUpperCase(),
          fileName: file.name,
          fileType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
          fileContentBase64: base64Data,
          mediaType: isPdf ? "TECHNICAL_PDF" : "IMAGE",
        }),
      });

      setQuarantineUploads((prev) => [res.media, ...prev]);
      showToast(res.message || "File uploaded to quarantine staging.", "success");
    } catch (err: any) {
      showToast(err.message || "Media upload failed.", "error");
    } finally {
      setIsUploadingMedia(false);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  };

  const handleApproveMedia = async (mediaId: string) => {
    try {
      await adminFetch<{ media: any; message: string }>(`/admin/sai-ajanta/media/${mediaId}/review`, {
        method: "POST",
        body: JSON.stringify({
          action: "APPROVE",
          reviewNotes: "Approved by staff editor.",
        }),
      });
      setQuarantineUploads((prev) =>
        prev.map((m) => (m.id === mediaId ? { ...m, status: "APPROVED" } : m))
      );
      showToast("Media approved and projected.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to approve media.", "error");
    }
  };

  const handleAppendToForm = (type: "IMAGE" | "PDF", url: string) => {
    if (type === "IMAGE") {
      const current = form.getFieldValue("imagesText") || "";
      const updated = current ? `${current}\n${url}` : url;
      form.setFieldsValue({ imagesText: updated });
      showToast("Appended image asset to gallery URLs.", "info");
    } else {
      const current = form.getFieldValue("otherDocumentLinksText") || "";
      const updated = current ? `${current}\n${url}` : url;
      form.setFieldsValue({ otherDocumentLinksText: updated });
      showToast("Appended spec PDF to document links.", "info");
    }
  };

  const handleNext = async () => {
    try {
      const toCheck = FIELDS_BY_STEP[step] || [];
      if (toCheck.length > 0) {
        await form.validateFields(toCheck);
      }
      setStep((s) => Math.min(s + 1, STEP_ITEMS.length - 1));
    } catch {
      showToast("Please fix the highlighted fields in this step before continuing.", "warning");
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const isApproved = values.cmsStatus === "APPROVED" || values.cmsStatus === "PUBLISHED";
      const isPublished = values.cmsStatus === "PUBLISHED";
      const highlights = splitBullets(values.highlightsText);
      const features = splitBullets(values.featuresText);
      const benefits = splitBullets(values.benefitsText);
      const variants = splitBullets(values.variantsText);
      const images = splitBullets(values.imagesText);
      const otherDocumentLinks = splitBullets(values.otherDocumentLinksText);
      const faq = splitBullets(values.faqText);

      const trimmedSpecs: Record<string, string> = {};
      for (const [k, v] of Object.entries(specFields)) {
        const clean = String(v || "").trim();
        if (clean) trimmedSpecs[k] = clean;
      }

      const payload = {
        name: values.name.trim(),
        brand: values.brand.trim(),
        model: values.model?.trim() || "",
        productNumber: values.productNumber?.trim() || "",
        size: values.size?.trim() || "Standard",
        measurementsAndUnits: values.measurementsAndUnits?.trim() || "",
        material: values.material?.trim() || "Standard",
        billingUnit: values.billingUnit.trim(),
        src: values.src?.trim() || (images[0] || ""),
        description: values.description?.trim() || "",
        customerPriceInr: values.customerPriceInr ?? null,
        contractorPriceInr: values.contractorPriceInr ?? null,
        dealerPriceInr: values.dealerPriceInr ?? null,
        distributorPriceInr: values.distributorPriceInr ?? null,
        referenceSellingPriceInr: values.referenceSellingPriceInr ?? null,
        stockQty: values.stockQty !== null ? Number(values.stockQty) : 0,
        gstRate: Number(values.gstRate) || 18,
        hsnCode: values.hsnCode?.trim() || "",
        deliveryInfo: values.deliveryInfo?.trim() || "",
        deliveryPriceInr: values.deliveryPriceInr ?? null,
        isManufactured: Boolean(values.isManufactured),
        saleRoute: values.saleRoute || (isHouseOfAjantha ? "DISTRIBUTOR_CHANNEL" : "DIRECT_SAI_AJANTHA"),
        isQuoteOnly: Boolean(values.isQuoteOnly || isFloorSpring),
        minOrderQty: values.minOrderQty?.trim() || "1",
        maxOrderQty: values.maxOrderQty || null,
        installationEligible: Boolean(values.installationEligible),
        cmsStatus: values.cmsStatus,
        approved: isApproved,
        active: isPublished,
        headlineNeed: values.headlineNeed?.trim() || "",
        highlights: highlights.length > 0 ? highlights : features,
        features,
        benefits,
        customerBenefits: benefits,
        variants,
        images: images.length > 0 ? images : values.src ? [values.src] : [],
        otherDocumentLinks,
        warrantyInfo: values.warrantyInfo?.trim() || "",
        faq,
        internalNotes: values.internalNotes?.trim() || "",
        specFields: trimmedSpecs,
        productSpecification: trimmedSpecs,
      };

      if (isEdit && existing) {
        await updateProduct.mutateAsync({
          productId: existing.medusa_id || existing.id,
          payload,
        });
        setInitialSnapshot({ values, specFields: trimmedSpecs });
        allowNextNavigation();
        showToast(`Saved changes to ${values.sku.trim().toUpperCase()}.`, "success");
        navigate(`/products/${existing.id}`);
      } else {
        await createProduct.mutateAsync({
          sku: values.sku.trim().toUpperCase(),
          category: values.category,
          subcategory: values.subcategory?.trim() || values.category,
          ...payload,
        });
        setInitialSnapshot({ values, specFields: trimmedSpecs });
        allowNextNavigation();
        showToast(`Created product ${values.sku.trim().toUpperCase()}.`, "success");
        navigate("/products");
      }
    } catch (err: any) {
      if (err?.errorFields?.length > 0) {
        const firstField = String(err.errorFields[0]?.name?.[0] || "");
        const errorStep = findStepForField(firstField);
        setStep(errorStep);
        showToast(
          `Please fix the highlighted fields in Step ${errorStep + 1} (${STEP_ITEMS[errorStep]?.title}).`,
          "warning"
        );
      } else {
        showToast(
          err instanceof Error ? err.message : "Could not save product. Your entries are still preserved.",
          "error"
        );
      }
    }
  };

  if (isEdit && portal.isLoading) {
    return <AdminLoadingState rows={6} title="Loading product editor..." />;
  }

  if (isEdit && portal.isError) {
    return (
      <AdminErrorState
        message={portal.error instanceof Error ? portal.error.message : "Failed to load product"}
        onRetry={() => void portal.refetch()}
      />
    );
  }

  const saving = createProduct.isPending || updateProduct.isPending;

  // Technical verification alerts
  const specText = JSON.stringify(specFields).toLowerCase();
  const hasIllustrativeSpec = specText.includes("illustrative specification");
  const isMeshMaterialConflict =
    watchedCategory.toLowerCase().includes("mesh") &&
    (allValues?.name || "").toUpperCase().includes("SS 304") &&
    ((allValues?.description || "").toLowerCase().includes("fiberglass") || specText.includes("fiberglass"));

  return (
    <div>
      <AdminPageHeader
        title={isEdit ? `Edit Product — ${existing?.sku || productId}` : "Add New Product"}
        subtitle="Complete the 5 steps below. All 34 canonical spreadsheet fields are maintained."
        extra={
          <>
            {isDirty && (
              <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>
                Unsaved Changes
              </Tag>
            )}
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => confirmLeave(() => navigate("/products"))}
            >
              Cancel
            </Button>
          </>
        }
      />

      <AdminSectionCard style={{ marginBottom: 14 }}>
        <Steps
          current={step}
          onChange={(idx) => setStep(idx)}
          size="small"
          responsive
          items={STEP_ITEMS}
        />
      </AdminSectionCard>

      <Row gutter={[14, 14]} align="top">
        <Col xs={24} lg={17}>
          <Form<ProductFormValues>
            form={form}
            layout="vertical"
            preserve
            initialValues={DEFAULT_PRODUCT_VALUES}
            scrollToFirstError
          >
            <AdminSectionCard>
              {/* STEP 1: Basic Product Identity */}
              <div style={{ display: step === 0 ? "block" : "none" }}>
                <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
                  1. Basic Product Identity
                </Typography.Title>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Product Name (Title)"
                      name="name"
                      rules={[
                        requiredTrimRule("Enter the product name."),
                        { min: 2, message: "Product name must be at least 2 characters." },
                      ]}
                    >
                      <Input placeholder="e.g. Pleated Sliding Mosquito Screen" maxLength={160} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Product Code or SKU"
                      name="sku"
                      rules={skuCodeRules(existingSkus, isEdit)}
                      extra={isEdit ? "SKU code cannot be changed after creation." : "Example: SA-SCR-001"}
                    >
                      <Input
                        placeholder="SA-SCR-001"
                        disabled={isEdit}
                        maxLength={64}
                        style={{ textTransform: "uppercase" }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Storefront Main Group (11 Groups)"
                      name="category"
                      rules={[{ required: true, message: "Select a storefront main category." }]}
                    >
                      <Select
                        options={ELEVEN_CATEGORIES.map((c) => ({ label: c, value: c }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="Source Subcategory (15 Categories)" name="subcategory">
                      <Select
                        showSearch
                        allowClear
                        placeholder="e.g. Finished Frame Insect Screens"
                        options={FIFTEEN_SOURCE_CATEGORIES.map((c) => ({ label: c, value: c }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Brand"
                      name="brand"
                      rules={[requiredTrimRule("Enter the brand name.")]}
                    >
                      <Input placeholder="Sai Ajantha / House of Ajantha" maxLength={80} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Model Identifier" name="model">
                      <Input placeholder="e.g. TON-80 / DC-60-HR" maxLength={80} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Source Product Number (Reference)" name="productNumber">
                      <Input placeholder="e.g. Row 15 / Ref 102" maxLength={40} />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      label="Primary Image URL / Asset Path"
                      name="src"
                      rules={imageUrlOrPathRules()}
                      extra="Preserves verified local image assets (/products/...) or external CDN URLs."
                    >
                      <Input placeholder="/products/Door-closer-[SA-M-DC-60-001]-img.jpg" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* STEP 2: Specifications, Units & Variants */}
              <div style={{ display: step === 1 ? "block" : "none" }}>
                <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
                  2. Technical Specifications &amp; Size Variants
                </Typography.Title>

                {(hasIllustrativeSpec || isMeshMaterialConflict) && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    style={{ marginBottom: 16, borderRadius: 10 }}
                    message="Pending Technical Verification"
                    description={
                      hasIllustrativeSpec
                        ? "This product contains unverified 'illustrative specification' claims in its technical data. Keep unverified claims suppressed from public presentation."
                        : "Conflicting material claim: Title states SS 304 while description/spec mentions fiberglass."
                    }
                  />
                )}

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Billing / Selling Unit"
                      name="billingUnit"
                      rules={[requiredTrimRule("Enter selling unit (e.g. 1 Unit, 1 Sq.ft).")]}
                    >
                      <Input placeholder="e.g. 1 Unit / 1 Length (12 ft) / 1 Pair" maxLength={60} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="Size Dimensions" name="size">
                      <Input placeholder="e.g. 600mm x 450mm" maxLength={80} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="Material" name="material">
                      <Input placeholder="e.g. Aluminium 6063-T5 / SS 304" maxLength={100} />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      label="Measurements and Units (Detailed Tolerances & Lengths)"
                      name="measurementsAndUnits"
                    >
                      <Input.TextArea
                        rows={2}
                        placeholder="e.g. 12 ft standard extrusion length; wall thickness 1.2mm ±0.1mm"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider orientation="left" plain>
                  Category-Specific Specifications ({watchedCategory})
                </Divider>

                <Row gutter={16}>
                  {activeSpecDefs.map((def) => (
                    <Col xs={24} md={12} key={def.key}>
                      <Form.Item label={def.label}>
                        <Input
                          value={specFields[def.key] || ""}
                          onChange={(e) =>
                            setSpecFields((prev) => ({ ...prev, [def.key]: e.target.value }))
                          }
                          placeholder={def.placeholder}
                        />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>

                {/* Additional custom specification keys */}
                {Object.keys(specFields).filter((k) => !activeSpecDefs.some((d) => d.key === k)).length > 0 && (
                  <>
                    <Divider orientation="left" plain>
                      Additional Custom Specifications
                    </Divider>
                    <Row gutter={16}>
                      {Object.keys(specFields)
                        .filter((k) => !activeSpecDefs.some((d) => d.key === k))
                        .map((k) => (
                          <Col xs={24} md={12} key={k}>
                            <Form.Item
                              label={
                                <Flex justify="space-between" style={{ width: "100%" }}>
                                  <span>{k}</span>
                                  <Button
                                    type="text"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleRemoveCustomSpec(k)}
                                  />
                                </Flex>
                              }
                            >
                              <Input
                                value={specFields[k]}
                                onChange={(e) =>
                                  setSpecFields((prev) => ({ ...prev, [k]: e.target.value }))
                                }
                              />
                            </Form.Item>
                          </Col>
                        ))}
                    </Row>
                  </>
                )}

                <Card size="small" style={{ marginBottom: 18, background: "#FAFBFC" }}>
                  <Typography.Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
                    + Add Custom Specification Key / Value
                  </Typography.Text>
                  <Space.Compact style={{ width: "100%" }}>
                    <Input
                      placeholder="Attribute Name (e.g. Wire Diameter)"
                      value={newCustomSpecKey}
                      onChange={(e) => setNewCustomSpecKey(e.target.value)}
                      style={{ width: "45%" }}
                    />
                    <Input
                      placeholder="Value (e.g. 0.24mm)"
                      value={newCustomSpecVal}
                      onChange={(e) => setNewCustomSpecVal(e.target.value)}
                      style={{ width: "45%" }}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCustomSpec}>
                      Add
                    </Button>
                  </Space.Compact>
                </Card>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="Key Features (One per line)" name="featuresText">
                      <Input.TextArea
                        rows={3}
                        placeholder="e.g. Soft-close hydraulic dampers&#10;Tested for 100,000 cycles"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Customer Benefits (One per line)" name="benefitsText">
                      <Input.TextArea
                        rows={3}
                        placeholder="e.g. Silent closure without door slam&#10;Easy DIY installation"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      label="Available Size Variants (One per line)"
                      name="variantsText"
                      extra="Descriptive size options shown on storefront product page."
                    >
                      <Input.TextArea
                        rows={2}
                        placeholder="e.g. 15X20X4&#10;17X20X4&#10;21X20X4"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="In-house Manufactured Architectural Item"
                  name="isManufactured"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
              </div>

              {/* STEP 3: Four-Tier Prices & Stock */}
              <div style={{ display: step === 2 ? "block" : "none" }}>
                <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
                  3. Four-Tier Base Prices &amp; Warehouse Inventory
                </Typography.Title>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 10 }}
                  message="ALL FOUR PRICES ARE GST-EXCLUSIVE BASE RATES"
                  description="Customer, Contractor, Dealer, and Distributor prices are base amounts before tax. Trade tiers stay strictly hidden from public buyers."
                />
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Customer Price (MRP Base, ₹)"
                      name="customerPriceInr"
                      rules={priceRules("Customer Price")}
                      extra="Leave empty for Request Quote"
                    >
                      <InputNumber
                        min={0}
                        max={10000000}
                        prefix="₹"
                        style={{ width: "100%" }}
                        placeholder="Quote Only"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Contractor Trade Price (Base, ₹)"
                      name="contractorPriceInr"
                      extra="Approved interior contractors only"
                    >
                      <InputNumber min={0} max={10000000} prefix="₹" style={{ width: "100%" }} placeholder="—" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Dealer Price (Base, ₹)"
                      name="dealerPriceInr"
                      dependencies={["customerPriceInr"]}
                      rules={priceRules("Dealer Price")}
                      extra="Approved B2B dealers only"
                    >
                      <InputNumber min={0} max={10000000} prefix="₹" style={{ width: "100%" }} placeholder="—" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Distributor Buy Price (Base, ₹)"
                      name="distributorPriceInr"
                      extra="Approved territorial distributors only"
                    >
                      <InputNumber min={0} max={10000000} prefix="₹" style={{ width: "100%" }} placeholder="—" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Reference Selling Price (MRP Benchmark, ₹)"
                      name="referenceSellingPriceInr"
                      extra="Comparison benchmark price (no unverified strike-through discount)."
                    >
                      <InputNumber min={0} max={10000000} prefix="₹" style={{ width: "100%" }} placeholder="Optional" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Applicable GST Rate (%)"
                      name="gstRate"
                      rules={[{ required: true, message: "Select a GST rate." }]}
                      extra="Source rates 0.05 (5%) and 0.18 (18%) represent baseline tax fractions."
                    >
                      <Select
                        options={[
                          { label: "0% (Exempt)", value: 0 },
                          { label: "5% GST (Source 0.05)", value: 5 },
                          { label: "12% GST", value: 12 },
                          { label: "18% GST (Source 0.18)", value: 18 },
                          { label: "28% GST", value: 28 },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Statutory HSN Code"
                      name="hsnCode"
                      extra="Required before official tax invoice generation."
                    >
                      <Input placeholder="e.g. 8302 — Not verified" maxLength={16} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Stock Quantity Available"
                      name="stockQty"
                      rules={stockQtyRules()}
                      extra={
                        isHouseOfAjantha
                          ? "Fulfilled from verified independent distributor stock."
                          : "Fulfilled from Sai Ajantha Central Warehouse."
                      }
                    >
                      <InputNumber min={0} max={1000000} precision={0} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={18}>
                    <Form.Item label="Delivery & Dispatch Terms" name="deliveryInfo">
                      <Input placeholder="e.g. Dispatched within 24-48 hours via surface transport across Tamil Nadu" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="Delivery Fee (₹)" name="deliveryPriceInr">
                      <InputNumber min={0} prefix="₹" style={{ width: "100%" }} placeholder="0" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* STEP 4: Commercial Controls, FAQ & Services */}
              <div style={{ display: step === 3 ? "block" : "none" }}>
                <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
                  4. Commercial Controls, FAQ &amp; Service Eligibility
                </Typography.Title>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="Fulfillment Seller Route" name="saleRoute">
                      <Select
                        options={[
                          { label: "Direct Sai Ajantha (Central Warehouse)", value: "DIRECT_SAI_AJANTHA" },
                          { label: "Distributor Channel (House of Ajantha)", value: "DISTRIBUTOR_CHANNEL" },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Enquiry / Quote-Only Mode"
                      name="isQuoteOnly"
                      valuePropName="checked"
                      extra={
                        isFloorSpring
                          ? "Floor Springs are permanently locked to Quote-Only per DEC-002 policy."
                          : "Disables direct checkout and routes buyers to consultation request."
                      }
                    >
                      <Switch disabled={isFloorSpring} checkedChildren="Quote Only" unCheckedChildren="Allow Cart" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Minimum Order Quantity / Scope"
                      name="minOrderQty"
                      extra={
                        watchedCategory.toLowerCase().includes("insect") || watchedCategory.toLowerCase().includes("screen")
                          ? "Finished Frame Screens require 50 sq.ft combined order area."
                          : "Minimum units per order."
                      }
                    >
                      <Input placeholder="1 or 50sqt" maxLength={20} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Maximum Order Quantity" name="maxOrderQty">
                      <InputNumber min={1} style={{ width: "100%" }} placeholder="No limit" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Installation Service Eligible"
                      name="installationEligible"
                      valuePropName="checked"
                      extra="Verified for Finished Insect Screens & Glass systems; contractor quote billed separately."
                    >
                      <Switch checkedChildren="Eligible" unCheckedChildren="No" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Warranty Statement" name="warrantyInfo">
                      <Input placeholder="e.g. 2 Years manufacturer warranty against mechanical failure" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      label="FAQ Questions List (One per line)"
                      name="faqText"
                      extra="Unanswered questions from master sheet are preserved in Admin and hidden from public storefront until answered."
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="Can this door closer be adjusted for closing speed?&#10;What is the maximum door weight supported?"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      label="Technical Document / Spec Sheet URLs (One per line)"
                      name="otherDocumentLinksText"
                    >
                      <Input.TextArea rows={2} placeholder="https://sai-ajanta.com/docs/spec-sheet.pdf" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item
                      label="Product Gallery Images (One URL per line)"
                      name="imagesText"
                      extra="Secondary image URLs or uploaded assets. Blank incoming field preserves existing images."
                    >
                      <Input.TextArea
                        rows={2}
                        placeholder="/products/sample-1.jpg&#10;/products/sample-2.jpg"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Card
                      size="small"
                      title={
                        <Space>
                          <UploadOutlined />
                          <span>Quarantine Media &amp; Specification PDF Uploader (Approval Controlled)</span>
                        </Space>
                      }
                      style={{ marginBottom: 16, border: "1px dashed #d9d9d9", background: "#fcfcfc" }}
                    >
                      <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
                        Upload product photos (JPG, PNG, WebP &le; 10MB) or Technical Cut Sheet PDFs (&le; 15MB) into secure quarantine storage.
                        New assets require staff approval before public display. Existing baseline assets are never overwritten.
                      </Typography.Paragraph>

                      <Space style={{ marginBottom: 12 }}>
                        <input
                          ref={mediaInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          style={{ display: "none" }}
                          onChange={handleMediaFileSelected}
                        />
                        <Button
                          icon={isUploadingMedia ? <LoadingOutlined /> : <UploadOutlined />}
                          loading={isUploadingMedia}
                          onClick={() => mediaInputRef.current?.click()}
                        >
                          Select File to Upload
                        </Button>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Target SKU: <b>{watchedSku || "SA-PENDING"}</b>
                        </Typography.Text>
                      </Space>

                      {quarantineUploads.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <Typography.Text strong style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
                            Recent Quarantined Staging Uploads:
                          </Typography.Text>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            {quarantineUploads.map((up) => (
                              <div
                                key={up.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "6px 12px",
                                  background: "#ffffff",
                                  border: "1px solid #e8e8e8",
                                  borderRadius: 4,
                                }}
                              >
                                <Space>
                                  {up.mediaType === "TECHNICAL_PDF" ? (
                                    <FilePdfOutlined style={{ color: "#ff4d4f", fontSize: 16 }} />
                                  ) : (
                                    <PaperClipOutlined style={{ color: "#1890ff", fontSize: 16 }} />
                                  )}
                                  <div>
                                    <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
                                      {up.fileName}
                                    </Typography.Text>
                                    <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                                      ({Math.round(up.fileSizeBytes / 1024)} KB)
                                    </Typography.Text>
                                  </div>
                                  <Tag color={up.status === "APPROVED" ? "green" : "orange"}>
                                    {up.status}
                                  </Tag>
                                </Space>

                                <Space>
                                  {up.mediaType === "IMAGE" ? (
                                    <Button
                                      size="small"
                                      onClick={() => handleAppendToForm("IMAGE", up.publicUrl)}
                                    >
                                      Add to Gallery
                                    </Button>
                                  ) : (
                                    <Button
                                      size="small"
                                      onClick={() => handleAppendToForm("PDF", up.publicUrl)}
                                    >
                                      Add to Documents
                                    </Button>
                                  )}
                                  {up.status !== "APPROVED" && (
                                    <Button
                                      size="small"
                                      type="primary"
                                      icon={<CheckCircleOutlined />}
                                      onClick={() => handleApproveMedia(up.id)}
                                    >
                                      Approve
                                    </Button>
                                  )}
                                </Space>
                              </div>
                            ))}
                          </Space>
                        </div>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24}>
                    <Form.Item label="Short Tagline (Customer Facing)" name="headlineNeed">
                      <Input placeholder="e.g. Smooth sliding protection for home balconies and windows" maxLength={180} />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item label="Product Description (Customer Facing)" name="description">
                      <Input.TextArea
                        rows={3}
                        placeholder="Clear, professional description describing function, fitment, and architectural application."
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item label="Internal Staff Notes (Private)" name="internalNotes">
                      <Input.TextArea
                        rows={2}
                        placeholder="Supplier batch info, verification notes, or pending confirmation."
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* STEP 5: Review & Publish */}
              <div style={{ display: step === 4 ? "block" : "none" }}>
                <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
                  5. Review &amp; Publishing Status
                </Typography.Title>

                {isHouseOfAjantha && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16, borderRadius: 10 }}
                    message="Distributor Category Selected"
                    description="Door Closers and Kitchen Baskets belong to the distributor-led category group. Floor Springs stay Quote Only."
                  />
                )}

                <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small" style={{ marginBottom: 18 }}>
                  <Descriptions.Item label="SKU">{allValues?.sku?.trim().toUpperCase() || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Title">{allValues?.name?.trim() || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Main Group">{allValues?.category || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Subcategory">{allValues?.subcategory || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Brand">{allValues?.brand || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Model">{allValues?.model || "—"}</Descriptions.Item>
                  <Descriptions.Item label="Customer Price (MRP Base)">
                    {allValues?.customerPriceInr ? formatInr(allValues.customerPriceInr) : "Quote Only"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Contractor Base">
                    {allValues?.contractorPriceInr ? formatInr(allValues.contractorPriceInr) : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Dealer Base">
                    {allValues?.dealerPriceInr ? formatInr(allValues.dealerPriceInr) : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Distributor Base">
                    {allValues?.distributorPriceInr ? formatInr(allValues.distributorPriceInr) : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="GST Rate">{allValues?.gstRate || 18}% (Excluded)</Descriptions.Item>
                  <Descriptions.Item label="Stock Available">{allValues?.stockQty ?? 0} units</Descriptions.Item>
                  <Descriptions.Item label="Seller Route">{allValues?.saleRoute || "DIRECT_SAI_AJANTHA"}</Descriptions.Item>
                  <Descriptions.Item label="Quote-Only Mode">
                    {allValues?.isQuoteOnly || isFloorSpring ? <Tag color="warning">Enquiry Only</Tag> : <Tag color="green">Purchasable</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Order MOQ Scope">{allValues?.minOrderQty || "1"}</Descriptions.Item>
                  <Descriptions.Item label="Installation Eligible">
                    {allValues?.installationEligible ? <Tag color="blue">Eligible</Tag> : <Tag>Not eligible</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Specifications Count" span={2}>
                    {Object.keys(specFields).length} attributes defined
                  </Descriptions.Item>
                </Descriptions>

                <Form.Item
                  label="Publishing Status"
                  name="cmsStatus"
                  rules={[{ required: true, message: "Select a publishing status." }]}
                  extra="APPROVED moves to review queue; PUBLISHED makes it visible on the live storefront."
                >
                  <Select
                    options={[
                      { label: "Draft — Work in progress, hidden from public", value: "DRAFT" },
                      { label: "Review — Ready for staff review & verification", value: "REVIEW" },
                      { label: "Approved — Verification complete, staged for release", value: "APPROVED" },
                      { label: "Published — Live on storefront catalogue", value: "PUBLISHED" },
                    ]}
                  />
                </Form.Item>
              </div>

              {/* Navigation Bar */}
              <Divider style={{ margin: "20px 0 16px" }} />
              <Flex justify="space-between" align="center">
                <Space>
                  {step > 0 && (
                    <Button onClick={() => setStep((s) => s - 1)} icon={<ArrowLeftOutlined />}>
                      Previous
                    </Button>
                  )}
                  {isDirty && (
                    <Button onClick={handleResetForm} icon={<UndoOutlined />}>
                      Reset Form
                    </Button>
                  )}
                </Space>

                <Space>
                  {step < STEP_ITEMS.length - 1 ? (
                    <Button type="primary" onClick={handleNext} icon={<ArrowRightOutlined />}>
                      Next: {STEP_ITEMS[step + 1]?.title}
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={saving}
                      onClick={handleSave}
                      style={{ background: BRAND_TOKENS.teal, borderColor: BRAND_TOKENS.teal }}
                    >
                      {isEdit ? "Save Product Changes" : "Create Product"}
                    </Button>
                  )}
                </Space>
              </Flex>
            </AdminSectionCard>
          </Form>
        </Col>

        {/* Live Preview Sidebar */}
        <Col xs={24} lg={7}>
          <AdminSectionCard title="Live Product Card Preview">
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <Avatar
                shape="square"
                size={120}
                src={allValues?.src || "/placeholder.png"}
                icon={<AppstoreOutlined />}
                style={{ borderRadius: 12, border: "1px solid #E5E7EB" }}
              />
            </div>
            <Typography.Title level={5} style={{ margin: 0, textAlign: "center" }}>
              {allValues?.name || "Product Title"}
            </Typography.Title>
            <Typography.Text
              type="secondary"
              style={{ display: "block", textAlign: "center", fontSize: 12, marginBottom: 12 }}
            >
              {allValues?.sku ? allValues.sku.toUpperCase() : "SKU-CODE"} · {allValues?.brand || "Brand"}
            </Typography.Text>

            <Flex justify="center" gap={4} wrap="wrap" style={{ marginBottom: 14 }}>
              <Tag color="blue">{watchedCategory}</Tag>
              {allValues?.subcategory && <Tag>{allValues.subcategory}</Tag>}
              {allValues?.isQuoteOnly || isFloorSpring ? (
                <Tag color="warning">Enquiry Only</Tag>
              ) : (
                <Tag color="green">Direct Cart</Tag>
              )}
            </Flex>

            <div style={{ background: "#F9FAFB", padding: 12, borderRadius: 8, marginBottom: 14 }}>
              <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                Buyer MRP (Base, Excl. GST)
              </Typography.Text>
              <Typography.Title level={4} style={{ margin: "2px 0 0", color: BRAND_TOKENS.teal }}>
                {allValues?.customerPriceInr ? formatInr(allValues.customerPriceInr) : "Request Quote"}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                + {allValues?.gstRate || 18}% applicable GST
              </Typography.Text>
            </div>

            {allValues?.headlineNeed && (
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, fontStyle: "italic", marginBottom: 12 }}>
                "{allValues.headlineNeed}"
              </Typography.Paragraph>
            )}

            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 12 }}>
              <Typography.Text strong style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
                Active Specifications ({Object.keys(specFields).length})
              </Typography.Text>
              <div style={{ maxHeight: 180, overflowY: "auto", fontSize: 12 }}>
                {Object.entries(specFields).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#6B7280" }}>{k}:</span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
                {Object.keys(specFields).length === 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    No specifications defined yet.
                  </Typography.Text>
                )}
              </div>
            </div>
          </AdminSectionCard>
        </Col>
      </Row>
    </div>
  );
};
