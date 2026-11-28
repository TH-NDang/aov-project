import { useQuery } from "@tanstack/react-query"
import { objectiveIcons } from "@aov/ui/lib/battle-map"
import { gameModeApi, gameModeKeys } from "@/features/game-modes/game-mode-api"

/** The mode whose battlefield map holds the game icons of the objectives a match records. */
const OBJECTIVE_MODE = "5v5"

/**
 * The game icons of the recorded objectives, read from the 5v5 battlefield map as Admin last saved it. Nothing while it
 * loads, or for an editor without access to game modes: the icons then fall back to the Wiki's drawn symbols.
 */
export function useObjectiveArt() {
  const art = useQuery({
    // Under the game modes' prefix, so publishing the map refreshes these icons too.
    queryKey: gameModeKeys.objectiveArt(OBJECTIVE_MODE),
    queryFn: async ({ signal }) => {
      const mode = (await gameModeApi.list(signal)).find((summary) => summary.code === OBJECTIVE_MODE)
      if (!mode?.map) return {}
      const map = await gameModeApi.map(mode.id, signal)
      return objectiveIcons(map.content, map.images)
    },
    staleTime: 30 * 60_000,
    retry: false,
  })
  return art.data ?? NONE
}

const NONE = {}
