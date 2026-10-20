import type { QueryClient } from "@tanstack/react-query"
import { invalidateReferenceCatalog } from "../terminology/reference-api"

/** Refresh catalogs derived from hero revisions, including media groups and badge usage. */
export function invalidateHeroCatalogs(cache: QueryClient) {
  return Promise.all([
    invalidateReferenceCatalog(cache),
    ...["publishing-heroes", "character-images", "skin-badges", "publication-overview"].map((key) =>
      cache.invalidateQueries({ queryKey: [key] }),
    ),
  ])
}
