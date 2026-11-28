import { queryOptions } from "@tanstack/react-query"
import type { MapContent } from "@aov/ui/lib/battle-map"
import { wikiPublicRequest } from "./stream-api"

/** The mode whose map tournament games are played on. */
export const TOURNAMENT_MODE = "5v5"

/** Every query key of the Wiki's battlefield maps. */
export const battleMapKeys = {
  map: (mode: string) => ["battle-map", mode] as const,
}

/** A published battlefield map: its content and the uploaded pictures it names, by asset. */
export interface BattleMap {
  content: MapContent
  images: Record<string, { url: string }>
}

/** The published battlefield map of a mode, as the Wiki shows it; it changes only when an editor publishes. */
export const battleMapQuery = (mode: string) =>
  queryOptions({
    queryKey: battleMapKeys.map(mode),
    queryFn: async ({ signal }) => {
      const map = await wikiPublicRequest<BattleMap>(`/game-modes/${encodeURIComponent(mode)}/map`, { signal })
      return { content: map.content, images: map.images ?? {} } satisfies BattleMap
    },
    staleTime: 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    meta: { storedAnswer: "stream-battle-map@2" },
  })
