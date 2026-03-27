/**
 * Client-side helper for PATCH /api/sites/[siteId].
 * Used by 5+ components that update site fields.
 */
export async function patchSite(
  siteId: string,
  data: Record<string, unknown>
): Promise<Response> {
  return fetch(`/api/sites/${siteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}
