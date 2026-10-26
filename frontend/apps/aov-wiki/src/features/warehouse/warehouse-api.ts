import { queryOptions } from "@tanstack/react-query"
import type { EntityReference, RichTextSettings } from "@aov/ui/lib/entity-rich-text"
import type { WarehouseEntry, WarehouseGroup, WarehouseKind } from "./warehouse-types"
import { wikiCatalogParameters, wikiScopeHref, wikiScopeKey, type WikiCatalogScope } from "../../lib/wiki-catalog"

async function readWarehouseApi<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/wiki/v1${path}`, { signal, credentials: "omit" })
  if (!response.ok) throw new Error("Published warehouse data is unavailable.")
  return response.json()
}

async function readCatalogPages(path: string, scope: WikiCatalogScope, signal: AbortSignal) {
  const entries: WarehouseEntry[] = []
  for (let page = 0; ; page++) {
    const query = wikiCatalogParameters(scope)
    query.set("page", String(page))
    query.set("size", "100")
    const slice = await readWarehouseApi<{ items: WarehouseEntry[]; totalElements: number }>(`${path}?${query}`, signal)
    entries.push(...slice.items)
    if (!slice.items.length || entries.length >= slice.totalElements) return entries
  }
}

export function warehouseCatalogQuery(kind: WarehouseKind, scope: WikiCatalogScope) {
  return queryOptions({
    queryKey: ["wiki", "warehouse", kind, ...wikiScopeKey(scope)],
    queryFn: async ({ signal }) => {
      const current = await readCatalogPages(`/${kind}`, scope, signal)
      if (kind !== "spells") return current

      const archived = await readCatalogPages("/spells/archived", scope, signal)
      const ids = new Set(current.map((entry) => entry.id))
      return [...current, ...archived.filter((entry) => !ids.has(entry.id))]
    },
    staleTime: 60_000,
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
    retry: 1,
  })
}

const REFERENCE_TABS: Partial<Record<EntityReference["kind"], WarehouseKind>> = {
  item: "items",
  enchantment: "enchantments",
  arcana: "arcana",
  spell: "spells",
}

export const warehouseReferencesQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: ["wiki", "references", ...wikiScopeKey(scope)],
    queryFn: async ({ signal }) => {
      const { settings } = await readWarehouseApi<{ settings: RichTextSettings }>(
        `/reference-catalog?${wikiCatalogParameters(scope)}`,
        signal,
      )
      return {
        ...settings,
        entities: settings.entities.map((entity) => {
          const tab = REFERENCE_TABS[entity.kind]
          const destination = tab
            ? `/warehouse?${new URLSearchParams({ tab, item: entity.id })}`
            : entity.kind === "hero"
              ? `/hero/${encodeURIComponent(entity.id)}`
              : entity.kind === "skill" && entity.heroId
                ? `/hero/${encodeURIComponent(entity.heroId)}?${new URLSearchParams({ skill: entity.skillKey ?? "" })}`
                : null
          return destination
            ? {
                ...entity,
                destinations: {
                  ...entity.destinations,
                  wiki: wikiScopeHref(destination, scope),
                },
              }
            : entity
        }),
      }
    },
    staleTime: 60_000,
    retry: 1,
  })
