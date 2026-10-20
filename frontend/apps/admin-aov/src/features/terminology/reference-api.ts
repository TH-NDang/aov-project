import type { QueryClient } from "@tanstack/react-query"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { backendRequest } from "@/app/auth/session"
import type { Request } from "../publishing/publishing-api"

export const referenceCatalogKeys = {
  all: ["reference-catalog"] as const,
  catalog: (issuer: string | undefined, subject: string | undefined, rulesetId = "") =>
    ["reference-catalog", issuer, subject, rulesetId] as const,
}

/** Load only names, descriptions and asset identifiers; icon metadata remains lazy. */
export function createReferenceCatalogApi(request: Request = backendRequest) {
  return {
    async list(rulesetId = "", signal?: AbortSignal): Promise<EntityReference[]> {
      const params = new URLSearchParams()
      if (rulesetId) params.set("rulesetId", rulesetId)
      const response = await request<{ items: EntityReference[] }>(
        `/admin/reference-catalog${params.size ? `?${params}` : ""}`,
        { signal },
      )
      return response.items
    },
  }
}

export const referenceCatalogApi = createReferenceCatalogApi()

export async function invalidateReferenceCatalog(client: QueryClient) {
  await client.cancelQueries({ queryKey: referenceCatalogKeys.all })
  await client.invalidateQueries({ queryKey: referenceCatalogKeys.all })
}
