import { queryOptions } from "@tanstack/react-query"
import type { PublishedWarehouseRecord, WarehouseGroup, WarehouseKind } from "./warehouse-types"
import { wikiCatalogParameters, wikiScopeKey, type WikiCatalogScope } from "../../lib/wiki-catalog"

async function readWarehouseApi<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/wiki/v1${path}`, { signal, credentials: "omit" })
  if (!response.ok) throw new Error("Published warehouse data is unavailable.")
  return response.json()
}

async function readCatalogPages(kind: WarehouseKind, path: string, scope: WikiCatalogScope, signal: AbortSignal) {
  const entries: PublishedWarehouseRecord[] = []
  for (let page = 0; ; page++) {
    const query = wikiCatalogParameters(scope)
    query.set("page", String(page))
    query.set("size", "100")
    const slice = await readWarehouseApi<{ items: Omit<PublishedWarehouseRecord, "kind">[]; totalElements: number }>(
      `${path}?${query}`,
      signal,
    )
    // Each endpoint returns the content schema for its own catalog kind.
    entries.push(...slice.items.map((entry) => ({ ...entry, kind }) as PublishedWarehouseRecord))
    if (!slice.items.length || entries.length >= slice.totalElements) return entries
  }
}

export function warehouseCatalogQuery(kind: WarehouseKind, scope: WikiCatalogScope) {
  return queryOptions({
    queryKey: ["wiki", "warehouse", kind, ...wikiScopeKey(scope)],
    queryFn: async ({ signal }) => {
      const current = await readCatalogPages(kind, `/${kind}`, scope, signal)
      if (kind !== "spells") return current

      const archived = await readCatalogPages(kind, "/spells/archived", scope, signal)
      const ids = new Set(current.map((entry) => entry.id))
      return [...current, ...archived.filter((entry) => !ids.has(entry.id))]
    },
    staleTime: 60_000,
    refetchOnWindowFocus: "always",
    retry: 1,
  })
}

export function warehouseGroupsQuery(kind: WarehouseKind, locale: string) {
  return queryOptions({
    queryKey: ["wiki", "warehouse-groups", kind, locale],
    queryFn: ({ signal }) =>
      readWarehouseApi<WarehouseGroup[]>(
        `/${kind === "items" ? "item-categories" : "enchantment-branches"}?${new URLSearchParams({ locale })}`,
        signal,
      ),
    enabled: kind === "items" || kind === "enchantments",
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: "always",
    retry: 1,
  })
}
