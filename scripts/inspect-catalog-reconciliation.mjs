import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const pg = require(path.resolve(process.cwd(), "apps/backend/node_modules/pg"));
const { Client } = pg;

async function check() {
  const p1Url = process.env.PRIMARY_DATABASE_URL || "postgres://medusa:medusa@localhost:5432/medusa";
  const p1 = new Client({ connectionString: p1Url });
  await p1.connect();
  const res1 = await p1.query("SELECT count(*) as total, count(*) FILTER (WHERE status = 'published') as published, count(*) FILTER (WHERE status = 'draft') as draft, count(*) FILTER (WHERE status = 'proposed') as proposed, count(*) FILTER (WHERE status = 'rejected') as rejected FROM product");
  const var1 = await p1.query("SELECT count(*) as count FROM product_variant");
  const cat1 = await p1.query("SELECT count(*) as count FROM product_category");
  console.log("PRIMARY medusa DB products:", res1.rows[0], "variants:", var1.rows[0].count, "categories:", cat1.rows[0].count);
  await p1.end();

  const p2Url = process.env.DISPOSABLE_DATABASE_URL || process.env.DATABASE_URL || "postgres://medusa:medusa@localhost:5432/medusa_restore_rehearsal_disposable";
  const p2 = new Client({ connectionString: p2Url });
  await p2.connect();
  const res2 = await p2.query("SELECT count(*) as total, count(*) FILTER (WHERE status = 'published') as published, count(*) FILTER (WHERE status = 'draft') as draft, count(*) FILTER (WHERE status = 'proposed') as proposed, count(*) FILTER (WHERE status = 'rejected') as rejected FROM product");
  const var2 = await p2.query("SELECT count(*) as count FROM product_variant");
  const cat2 = await p2.query("SELECT count(*) as count FROM product_category");
  console.log("DISPOSABLE DB products:", res2.rows[0], "variants:", var2.rows[0].count, "categories:", cat2.rows[0].count);
  
  // Check sample titles / SKUs
  const sample1 = await p2.query("SELECT id, title, handle, status FROM product LIMIT 5");
  console.log("Sample products in disposable DB:", sample1.rows);

  await p2.end();
}

async function checkApi() {
  try {
    const r = await fetch("http://localhost:3000/api/products");
    const data = await r.json();
    console.log("api/products returned:", Array.isArray(data) ? data.length : typeof data);
    if (Array.isArray(data)) {
      console.log("First item:", data[0].sku, data[0].name, data[0].category);
      const categories = {};
      for (const p of data) {
        categories[p.category] = (categories[p.category] || 0) + 1;
      }
      console.log("Category counts:", categories);
    } else {
      console.log("Data keys:", Object.keys(data));
      if (data.products) {
        console.log("products array length:", data.products.length);
        const categories = {};
        for (const p of data.products) {
          categories[p.category] = (categories[p.category] || 0) + 1;
        }
        console.log("Category counts in data.products:", categories);
      }
    }
  } catch (err) {
    console.error("API fetch error:", err.message);
  }
}

async function checkStaticCatalog() {
  const mod = await import("../apps/storefront/lib/products.ts");
  console.log("PRODUCT_CATEGORIES count:", mod.PRODUCT_CATEGORIES.length);
  console.log("PRODUCTS count in lib/products.ts:", mod.PRODUCTS.length);
  const cat = {};
  for (const p of mod.PRODUCTS) {
    cat[p.category] = (cat[p.category] || 0) + 1;
  }
  console.log("Category breakdown in static PRODUCTS:", cat);
}

async function checkSsrHtml() {
  const res = await fetch("http://localhost:3000/products");
  const html = await res.text();
  const matches = html.match(/href="\/products\/[^"]+"/g) || [];
  console.log("Total href=\"/products/...\" in initial SSR HTML:", matches.length);
  const uniqueHrefs = new Set(matches);
  console.log("Unique hrefs:", uniqueHrefs.size);
  console.log("Sample hrefs:", Array.from(uniqueHrefs).slice(0, 10));
}

async function run() {
  await check();
  await checkApi();
  await checkStaticCatalog();
  await checkSsrHtml();
}

run().catch(console.error);
