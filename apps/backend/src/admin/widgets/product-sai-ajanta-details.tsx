import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Badge, Container, Heading, Table, Text } from "@medusajs/ui";
import { ThemeProvider } from "../components/theme/theme-context";

type ProductWidgetProps = {
  data: {
    id: string;
    title?: string;
    thumbnail?: string | null;
    metadata?: Record<string, unknown> | null;
  };
};

function formatInr(amount: unknown): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const ProductSaiAjanthaDetailsContent = ({ data }: ProductWidgetProps) => {
  const meta = data?.metadata || {};

  const sku = typeof meta.sku === "string" ? meta.sku : "—";
  const productNumber =
    typeof meta.product_number === "string" ? meta.product_number : "—";
  const brand = typeof meta.brand === "string" ? meta.brand : "Sai Ajantha";
  const model = typeof meta.model === "string" ? meta.model : "—";
  const size = typeof meta.size === "string" ? meta.size : "Standard";
  const material = typeof meta.material === "string" ? meta.material : "—";
  const billingUnit =
    typeof meta.billing_unit === "string" ? meta.billing_unit : "1 unit";
  const gstRate = typeof meta.gst_rate === "number" ? `${meta.gst_rate}%` : "18%";
  const gstMode = typeof meta.gst_mode === "string" ? meta.gst_mode : "Excluded";
  const moq = typeof meta.moq === "string" ? meta.moq : "1";
  const deliveryTime =
    typeof meta.delivery_time === "string" ? meta.delivery_time : "—";
  const warranty = typeof meta.warranty === "string" ? meta.warranty : "—";
  const localNasUrl =
    typeof meta.local_nas_url === "string"
      ? meta.local_nas_url
      : data.thumbnail || "";

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
        <div>
          <Heading level="h2">Sai Ajantha Workbook &amp; B2B Tier Pricing</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Authoritative specifications synced from Sai_Ajantha_Product_Input_Workbook.xlsx
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Badge color="blue">{brand}</Badge>
          <Badge color="grey">{billingUnit}</Badge>
          <Badge color="green">
            GST {gstRate} ({gstMode})
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-4">
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Product Number
          </Text>
          <Text size="small" weight="plus">
            {productNumber}
          </Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Workbook SKU
          </Text>
          <Text size="small" weight="plus">
            {sku}
          </Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Model / Size
          </Text>
          <Text size="small" weight="plus">
            {model} · {size}
          </Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Material
          </Text>
          <Text size="small" weight="plus">
            {material}
          </Text>
        </div>
      </div>

      <div className="px-6 py-4">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Customer Tier</Table.HeaderCell>
              <Table.HeaderCell>Contractor Tier</Table.HeaderCell>
              <Table.HeaderCell>Dealer Tier</Table.HeaderCell>
              <Table.HeaderCell>Distributor Tier</Table.HeaderCell>
              <Table.HeaderCell>MOQ</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>{formatInr(meta.customer_price_inr)}</Table.Cell>
              <Table.Cell>{formatInr(meta.contractor_price_inr)}</Table.Cell>
              <Table.Cell>{formatInr(meta.dealer_price_inr)}</Table.Cell>
              <Table.Cell>{formatInr(meta.distributor_price_inr)}</Table.Cell>
              <Table.Cell>{moq || "1"}</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-2">
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Delivery Lead Time
          </Text>
          <Text size="small">{deliveryTime}</Text>
        </div>
        <div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Warranty Terms
          </Text>
          <Text size="small">{warranty}</Text>
        </div>
      </div>

      {localNasUrl ? (
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Local NAS Asset URL
            </Text>
            <Text size="small" className="break-all font-mono">
              {localNasUrl}
            </Text>
          </div>
          <Badge color="green">Local NAS Linked</Badge>
        </div>
      ) : null}
    </Container>
  );
};

const ProductSaiAjanthaDetailsWidget = (props: ProductWidgetProps) => {
  return (
    <ThemeProvider>
      <ProductSaiAjanthaDetailsContent {...props} />
    </ThemeProvider>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.after",
});

export default ProductSaiAjanthaDetailsWidget;
