import type { QueryClient } from "@tanstack/react-query"
import { invalidateReferenceCatalog } from "../../terminology/reference-api"
import { characterImageKeys } from "../../media/api/character-image-api"
import { publishingKeys } from "@/lib/api/publishing-api"

/** Refresh catalogs derived from hero revisions, including media groups and badge usage. */
export function invalidateHeroCatalogs(cache: QueryClient) {
  return Promise.all([
    invalidateReferenceCatalog(cache),
    ...[
      publishingKeys.heroes,
      characterImageKeys.all,
      characterImageKeys.badges,
      publishingKeys.overview,
      publishingKeys.allStatSamples,
    ].map((queryKey) => cache.invalidateQueries({ queryKey })),
  ])
}
