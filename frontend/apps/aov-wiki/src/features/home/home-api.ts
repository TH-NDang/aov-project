import { queryOptions } from "@tanstack/react-query"
import { wikiGet } from "../../lib/wiki-api"

/** Every query key of the home page; reads and invalidation both use these. */
export const homeKeys = {
  modesOpen: ["wiki", "home", "modes-open"] as const,
}

/**
 * Whether any game mode is published and whether one has a map; the home page leaves the modes tile out until one is,
 * and the map tile until a map is.
 */
export const modesOpenQuery = () =>
  queryOptions({
    queryKey: homeKeys.modesOpen,
    queryFn: async ({ signal }) => {
      const { items } = await wikiGet<{ items: { hasMap?: boolean }[] }>("/game-modes", signal)
      return { modes: items.length > 0, map: items.some((item) => item.hasMap) }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  })
