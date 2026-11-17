import { queryOptions } from "@tanstack/react-query"
import type { PublishedWarehouseRecord, WarehouseGroup, WarehouseKind } from "./warehouse-types"
import { wikiCatalogParameters, wikiScopeKey, type WikiCatalogScope } from "../../lib/wiki-catalog"
import { wikiGet, wikiGetAll } from "../../lib/wiki-api"

async function readCatalogPages(kind: WarehouseKind, path: string, scope: WikiCatalogScope, signal: AbortSignal) {
  const rows = await wikiGetAll<Omit<PublishedWarehouseRecord, "kind">>(path, wikiCatalogParameters(scope), signal)
  // Each endpoint returns the content schema for its own catalog kind.
  return rows.map((entry) => ({ ...entry, kind }) as PublishedWarehouseRecord)
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
      wikiGet<WarehouseGroup[]>(
        `/${kind === "items" ? "item-categories" : "enchantment-branches"}?${new URLSearchParams({ locale })}`,
        signal,
      ),
    enabled: kind === "items" || kind === "enchantments",
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: "always",
    retry: 1,
  })
}
