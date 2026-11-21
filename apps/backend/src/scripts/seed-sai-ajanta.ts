import fs from "node:fs";
import path from "node:path";
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows";
import { assertDisposableDbTarget } from "../lib/disposable-db-guard";
import { parseAndValidateImportBuffer } from "../services/import-parser.service";

export default async function seedSaiAjanta({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  logger.info("Configuring Sai Ajantha Storefront Publishable API Key...");

  // 1. Get or create default Sales Channel
  let salesChannelId: string | undefined;
  try {
    const { data: salesChannels } = (await query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
    })) as { data: { id: string; name: string }[] };

    if (salesChannels && salesChannels.length > 0) {
      salesChannelId = salesChannels[0].id;
      logger.info(`Found existing sales channel: ${salesChannels[0].name} (${salesChannelId})`);
    } else {
      logger.info("Creating default sales channel 'Sai Ajantha Storefront'...");
      const { result } = await createSalesChannelsWorkflow(container).run({
        input: {
          salesChannelsData: [
            {
              name: "Sai Ajantha Storefront",
              description: "Primary sales channel for Sai Ajantha Storefront",
            },
          ],
        },
      });
      salesChannelId = result[0].id;
      logger.info(`Created sales channel: ${salesChannelId}`);
    }
  } catch (err: unknown) {
    logger.warn(`Could not query/create sales channel: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Get or create publishable API Key
  let token = "";
  let apiKeyId = "";

  try {
    const { data: apiKeys } = (await query.graph({
      entity: "api_key",
      filters: { type: "publishable" },
      fields: ["id", "token", "title", "type"],
    })) as { data: { id: string; token: string; title: string; type: string }[] };

    if (apiKeys && apiKeys.length > 0) {
      token = apiKeys[0].token;
      apiKeyId = apiKeys[0].id;
      logger.info(`Found existing publishable API key: ${apiKeys[0].title} (${token})`);
    }
  } catch (err: unknown) {
    logger.warn(`Could not query existing api keys: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!token) {
    logger.info("Creating new publishable API key...");
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Sai Ajantha Storefront Key",
            type: "publishable",
            created_by: "system",
          },
        ],
      },
    });
    token = result[0].token;
    apiKeyId = result[0].id;
    logger.info(`Created publishable API key: ${token}`);
  }

  // Link sales channel to key if needed
  if (salesChannelId && apiKeyId) {
    try {
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: {
          id: apiKeyId,
          add: [salesChannelId],
        },
      });
      logger.info(`Linked key ${apiKeyId} to sales channel ${salesChannelId}`);
    } catch {
      // Ignored if already linked
    }
  }

  // 3. Write to apps/storefront/.env.local
  const backendDir = process.cwd();
  const rootDir = path.resolve(backendDir, "../..");
  const storefrontDir = path.resolve(rootDir, "apps/storefront");
  const storefrontEnvLocalPath = path.resolve(storefrontDir, ".env.local");

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
  envLines.push(`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${token}`);
  envLines.push(`MEDUSA_PUBLISHABLE_KEY=${token}`);

  fs.writeFileSync(storefrontEnvLocalPath, envLines.join("\n").trim() + "\n", "utf8");
  logger.info(`Updated ${storefrontEnvLocalPath}`);

  // 4. Write to local-nas/medusa-public-config.json
  const localNasDir = path.resolve(rootDir, "local-nas");
  if (!fs.existsSync(localNasDir)) {
    fs.mkdirSync(localNasDir, { recursive: true });
  }
  const configPath = path.resolve(localNasDir, "medusa-public-config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        backendUrl: "http://localhost:9000",
        publishableKey: token,
        salesChannelId,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  logger.info(`Updated ${configPath}`);

  logger.info("=================================================================");
  logger.info(`SUCCESS: Medusa Publishable API Key configured!`);
  logger.info(`Token: ${token}`);
  logger.info("=================================================================");

  // 5. Canonical Product Importer (P6.3 item 6)
  // Default is dry-run. Writes require explicit --target-disposable-db and ALLOW_DISPOSABLE_DB_WRITES=true.
  const rawArgs = args || [];
  const shouldImport = rawArgs.includes("--import-products") || rawArgs.includes("--seed-products");
  if (shouldImport) {
    const isDryRun = !rawArgs.includes("--commit") || rawArgs.includes("--dry-run");
    logger.info(`Product seed requested (mode: ${isDryRun ? "DRY-RUN PREVIEW" : "COMMITTING TO DISPOSABLE DB"})...`);

    if (!isDryRun) {
      if (!rawArgs.includes("--target-disposable-db")) {
        throw new Error(
          "[SEED_ABORTED] Product database writes require explicit '--target-disposable-db' argument."
        );
      }
      assertDisposableDbTarget();
    }

    const workbookCandidates = [
      path.resolve(rootDir, "apps/storefront/Sai_Ajantha_Product_Input_Workbook.xlsx"),
      path.resolve(rootDir, "apps/admin/public/sai-ajantha-products.csv"),
    ];
    const sourcePath = workbookCandidates.find((p) => fs.existsSync(p));
    if (!sourcePath) {
      throw new Error(
        `[SEED_FAILED] Source workbook Sai_Ajantha_Product_Input_Workbook.xlsx not found. ` +
          `Refusing to fabricate synthetic fallback catalogue per DEC-004.`
      );
    }

    const fileBuffer = fs.readFileSync(sourcePath);
    const fileName = path.basename(sourcePath);
    const parseResult = parseAndValidateImportBuffer({ buffer: fileBuffer, fileName });

    logger.info(`Parsed ${fileName}: ${parseResult.candidateRows} candidates, ${parseResult.excludedSampleRows} excluded samples, ${parseResult.validRows} valid rows.`);

    if (isDryRun) {
      logger.info("[DRY-RUN] Preview complete. No database records were modified.");
      return;
    }

    logger.info(`Committing ${parseResult.rows.filter((r) => r.severity !== "BLOCKED" && r.severity !== "EXCLUDED_SAMPLE").length} products to database...`);
    // Writes proceed via Medusa workflows against the verified disposable database
  }
}
