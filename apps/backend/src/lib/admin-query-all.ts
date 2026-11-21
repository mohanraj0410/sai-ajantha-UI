/** Compatibility snapshots must not silently truncate totals at a graph page cap. */
export async function queryGraphAll(query: { graph: (input: any) => Promise<any> }, input: any) {
  const data: any[] = [];
  const take = 500;
  for (let skip = 0; ; skip += take) {
    const result = await query.graph({ ...input, pagination: { ...input.pagination, take, skip, order: { id: "ASC" } } });
    data.push(...result.data);
    if (result.data.length < take) break;
  }
  return { data };
}

export function productStage(status: string, metadata: Record<string, unknown>) {
  if (typeof metadata.cms_status === "string") return metadata.cms_status;
  if (status === "published") return "PUBLISHED";
  if (metadata.approved === true || metadata.approved === 1) return "APPROVED";
  return "DRAFT";
}
