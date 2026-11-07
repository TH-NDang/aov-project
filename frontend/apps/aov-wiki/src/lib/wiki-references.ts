import { queryOptions } from "@tanstack/react-query"
import type { EntityReference, RichTextSettings } from "@aov/ui/lib/entity-rich-text"
import type { WarehouseKind } from "../features/warehouse/warehouse-types"
import {
  warehousePath,
  wikiCatalogParameters,
  wikiScopeHref,
  wikiScopeKey,
  type WikiCatalogScope,
} from "./wiki-catalog"

const REFERENCE_TABS: Partial<Record<EntityReference["kind"], WarehouseKind>> = {
  item: "items",
  enchantment: "enchantments",
  arcana: "arcana",
  spell: "spells",
}

export const wikiReferencesQuery = (scope: WikiCatalogScope) =>
  queryOptions({
    queryKey: ["wiki", "references", ...wikiScopeKey(scope), scope.section],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/wiki/v1/reference-catalog?${wikiCatalogParameters(scope)}`, {
        signal,
        credentials: "omit",
      })
      if (!response.ok) throw new Error("Public references are unavailable.")
      const { settings }: { settings: RichTextSettings } = await response.json()
      return {
        ...settings,
        entities: settings.entities.map((entity) => {
          const tab = REFERENCE_TABS[entity.kind]
          const destination = tab
            ? warehousePath(tab, entity.id)
            : entity.kind === "hero"
              ? `/hero/${encodeURIComponent(entity.id)}`
              : entity.kind === "skill" && entity.heroId
                ? `/hero/${encodeURIComponent(entity.heroId)}?${new URLSearchParams({ skill: entity.skillKey ?? "" })}`
                : entity.kind === "term"
                  ? `/terms/${encodeURIComponent(entity.id)}`
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
