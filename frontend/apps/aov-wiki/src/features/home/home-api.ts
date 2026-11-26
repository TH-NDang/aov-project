import { queryOptions } from "@tanstack/react-query"
import { wikiGet } from "../../lib/wiki-api"

/** Every query key of the home page; reads and invalidation both use these. */
export const homeKeys = {
  modesOpen: ["wiki", "home", "modes-open"] as const,
}

/** Whether any game mode is published; the home page leaves the modes tile out until one is. */
export const modesOpenQuery = () =>
  queryOptions({
    queryKey: homeKeys.modesOpen,
    queryFn: async ({ signal }) => (await wikiGet<{ items: unknown[] }>("/game-modes", signal)).items.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  })
