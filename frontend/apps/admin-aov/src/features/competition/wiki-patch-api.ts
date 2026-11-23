import type { PageSlice } from "@aov/community-contracts"
import { backendRequest } from "@/app/auth/session"
import type { components } from "../publishing/generated/hero-api"

export type WikiSeason = components["schemas"]["Season"]
/** One Wiki patch as the public patch list serves it for a market. Its `code` is the release day, yyyy-mm-dd. */
export type WikiPatch = { id: string; code: string; title?: string | null; effectiveAt?: string | null }

export const wikiPatchKeys = {
  all: ["competition", "wiki-patches"] as const,
  seasons: () => [...wikiPatchKeys.all, "seasons"] as const,
  patches: (region: string) => [...wikiPatchKeys.all, "patches", region] as const,
}

/** The Wiki's seasons and patches that a competition stage can link to. */
export const wikiPatchApi = {
  seasons: () => backendRequest<WikiSeason[]>("/admin/seasons"),
  patches: async (region: string) => {
    const rows: WikiPatch[] = []
    for (let page = 0; page < 20; page++) {
      const query = new URLSearchParams({ region, locale: "vi-VN", page: String(page), size: "100" })
      const result = await backendRequest<PageSlice<WikiPatch>>(`/patches?${query}`)
      rows.push(...result.items)
      if (!result.items.length || rows.length >= result.totalElements) break
    }
    return rows.sort((a, b) => b.code.localeCompare(a.code))
  },
}
