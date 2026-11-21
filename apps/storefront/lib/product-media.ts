// Exact filenames from public/products/workbook; preserve case in returned asset paths.
const WORKBOOK_PRODUCT_FILENAMES = [
  "aluminium-a-clip-012.png",
  "aluminium-a-db-12-007.png",
  "aluminium-a-dd-12-009.png",
  "aluminium-a-dg-12-004.png",
  "aluminium-a-dt-12-008.png",
  "aluminium-a-dv-8-010.png",
  "aluminium-a-sg-12-001.png",
  "aluminium-a-sg-16-003.png",
  "clip-c-clips-001.png",
  "door-closer-and-floor-spring-sa-i-fs-bold-110-012.png",
  "door-closer-and-floor-spring-sa-i-fs-bold-125-013.png",
  "door-closer-and-floor-spring-sa-i-fs-bold-150-014.png",
  "fgm-fittings-fgm-centerpvc-004.png",
  "kitchen-basket-sa-t-kb-oo103.png",
  "kitchen-basket-sa-t-kb-oo14.png",
  "kitchen-basket-sa-t-kb-oo2.png",
  "kitchen-basket-sa-t-kb-oo22.jpg",
  "kitchen-basket-sa-t-kb-oo25.jpg",
  "kitchen-basket-sa-t-kb-oo28.jpg",
  "kitchen-basket-sa-t-kb-oo33.jpg",
  "kitchen-basket-sa-t-kb-oo36.png",
  "kitchen-basket-sa-t-kb-oo39.jpg",
  "kitchen-basket-sa-t-kb-oo43.jpg",
  "kitchen-basket-sa-t-kb-oo62.png",
  "kitchen-basket-sa-t-kb-oo89.jpg",
  "kitchen-basket-sa-t-kb-oo97.jpg",
  "kitchen-basket-sa-t-kb-oo99.png",
  "ladder-a-type-l-sun-06-002.png",
  "ladder-a-type-l-sun-08-004.png",
  "ladder-a-type-l-sun-10-006.png",
  "ladder-a-type-l-sun-11-007.png",
  "ladder-a-type-l-sun-13-009.png",
  "ladder-a-type-l-sun-14-008.png",
  "ladder-a-type-l-sun-16-010.png",
  "ladder-a-type-l-sun-18-012.png",
  "ladder-a-type-l-sun-20-014.png",
  "ladder-l-sun-atype-l-001.png",
  "ladder-sa-blue-l-sun-06-031.png",
  "ladder-sa-blue-l-sun-07-032.png",
  "ladder-sa-blue-l-sun-08-033.png",
  "ladder-sa-green-l-sun-05-034.png",
  "ladder-sa-green-l-sun-07-036.png",
  "ladder-sa-green-l-sun-08-037.png",
  "ladder-sa-wall-support-l-sun-08-017.png",
  "ladder-sa-wall-support-l-sun-09-018.png",
  "ladder-sa-wall-support-l-sun-11-020.png",
  "ladder-sa-wall-support-l-sun-12-021.png",
  "ladder-sa-wall-support-l-sun-13-022.png",
  "ladder-sa-wall-support-l-sun-14-023.png",
  "ladder-sa-wall-support-l-sun-15-024.png",
  "ladder-sa-wall-support-l-sun-17-026.png",
  "ladder-sa-wall-support-l-sun-18-027.png",
  "ladder-sa-wall-support-l-sun-19-028.png",
  "ladder-sa-wall-support-l-sun-20-029.png",
  "ladder-wall-support-l-sun-06-015.png",
  "mesh-ma-d-mesh-black-3-001.png",
  "mesh-ma-d-mesh-black-3-5-007.png",
] as const;

export const WORKBOOK_PRODUCT_IMAGE_PATHS: Readonly<Record<string, string>> =
  Object.freeze(Object.fromEntries(
    WORKBOOK_PRODUCT_FILENAMES.map((filename) => [
      filename.toLowerCase(),
      `/products/workbook/${encodeURIComponent(filename)}`,
    ]),
  ));

/** Return a local fallback only when the source names an existing workbook asset. */
export function getWorkbookProductPhotoFallback(src: string): string | undefined {
  try {
    const url = new URL(src, "https://product-media.invalid");
    if (!/^https?:$/.test(url.protocol)) return undefined;
    const filename = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    if (!filename || /[\\/]/.test(filename)) return undefined;
    const key = filename.toLowerCase();
    return Object.hasOwn(WORKBOOK_PRODUCT_IMAGE_PATHS, key)
      ? WORKBOOK_PRODUCT_IMAGE_PATHS[key]
      : undefined;
  } catch {
    return undefined;
  }
}
