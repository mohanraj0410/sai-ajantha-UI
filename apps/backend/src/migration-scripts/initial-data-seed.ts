import path from "node:path";
import fs from "node:fs";
import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";
import { DEFAULT_REGION_STORE_POLICIES } from "../lib/region-store-policies";

/**
 * Clean initial migration seed for Sai Ajantha Interior Solutions.
 * Product data is seeded strictly from Sai_Ajantha_Product_Input_Workbook.xlsx
 * via `npx medusa exec ./src/scripts/seed-sai-ajanta.ts`.
 */
export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );

  const countries = ["in"];

  logger.info("Seeding Sai Ajantha Store & Sales Channel...");
  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "Sai Ajantha Storefront",
          description: "Primary B2B & retail catalog channel for Sai Ajantha Interior Solutions",
        },
      ],
    },
  });

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Sai Ajantha Storefront Publishable Key",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  });

  try {
    const rootDir = path.resolve(process.cwd(), "../..");
    const storefrontEnvLocalPath = path.resolve(rootDir, "apps/storefront/.env.local");
    const localNasDir = path.resolve(rootDir, "local-nas");
    if (!fs.existsSync(localNasDir)) fs.mkdirSync(localNasDir, { recursive: true });
    fs.writeFileSync(
      path.resolve(localNasDir, "medusa-public-config.json"),
      JSON.stringify(
        {
          backendUrl: "http://localhost:9000",
          publishableKey: publishableApiKey.token,
          salesChannelId: defaultSalesChannel.id,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    let envLines: string[] = [];
    if (fs.existsSync(storefrontEnvLocalPath)) {
      envLines = fs
        .readFileSync(storefrontEnvLocalPath, "utf8")
        .split("\n")
        .filter(
          (l) =>
            !l.startsWith("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=") &&
            !l.startsWith("MEDUSA_PUBLISHABLE_KEY=") &&
            !l.startsWith("NEXT_PUBLIC_MEDUSA_BACKEND_URL=") &&
            !l.startsWith("MEDUSA_BACKEND_URL=")
        );
    }
    envLines.push("NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000");
    envLines.push("MEDUSA_BACKEND_URL=http://localhost:9000");
    envLines.push(`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${publishableApiKey.token}`);
    envLines.push(`MEDUSA_PUBLISHABLE_KEY=${publishableApiKey.token}`);
    fs.writeFileSync(storefrontEnvLocalPath, envLines.join("\n").trim() + "\n", "utf8");
    logger.info(`Storefront publishable key written to ${storefrontEnvLocalPath}`);
  } catch (err: unknown) {
    logger.warn(`Could not export publishable key to config: ${err instanceof Error ? err.message : String(err)}`);
  }

  await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "Sai Ajantha Interior Solutions",
          supported_currencies: [
            {
              currency_code: "inr",
              is_default: true,
            },
          ],
          default_sales_channel_id: defaultSalesChannel.id,
        },
      ],
    },
  });

  logger.info("Seeding India region & GST tax jurisdiction...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "India",
          currency_code: "inr",
          countries,
          payment_providers: ["pp_system_default"],
          metadata: DEFAULT_REGION_STORE_POLICIES,
        },
      ],
    },
  });
  const region = regionResult[0];

  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });

  logger.info("Seeding Sai Ajantha Warehouse - Trichy...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Sai Ajantha Warehouse - Trichy",
          address: {
            city: "Tiruchirappalli",
            province: "Tamil Nadu",
            country_code: "IN",
            address_1: "D-14, 11th Cross East, Thillai Nagar",
            postal_code: "620018",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: defaultSalesChannel.id,
      add: [stockLocation.id],
    },
  });

  const { data: shippingProfileResult } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfileResult[0];

  if (shippingProfile) {
    const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Sai Ajantha India Dispatch",
      type: "shipping",
      service_zones: [
        {
          name: "India (Tamil Nadu & Pan-India)",
          geo_zones: [
            {
              country_code: "in",
              type: "country",
            },
          ],
        },
      ],
    });

    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    });

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard Tamil Nadu Dispatch (3-5 Working Days)",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard Dispatch",
            description: "Dispatch in 2 working days; Tamil Nadu delivery in 3-5 working days.",
            code: "standard-tn",
          },
          prices: [
            {
              currency_code: "inr",
              amount: 0,
            },
            {
              region_id: region.id,
              amount: 0,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
        {
          name: "Pan-India Commercial Freight (Express)",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Commercial Freight",
            description: "Priority parcel / transport booking across India.",
            code: "commercial-freight",
          },
          prices: [
            {
              currency_code: "inr",
              amount: 250,
            },
            {
              region_id: region.id,
              amount: 250,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
      ],
    });
  }

  logger.info("Finished seeding Sai Ajantha store foundation.");
}
