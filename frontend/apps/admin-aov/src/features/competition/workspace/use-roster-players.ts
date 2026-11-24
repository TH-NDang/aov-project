import { useQuery } from "@tanstack/react-query"
import type { PlayerContent } from "@aov/community-contracts"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"

/**
 * Profiles of everyone on a roster of one tournament, by player id. The directory lists a tournament's own players
 * before everyone else, so reading stops at the first page that reaches the rest of the directory.
 */
export function useRosterPlayers(tournamentId: string, actorKey: string, enabled = true) {
  return useQuery({
    queryKey: tournamentKeys.inTournament("players", actorKey, tournamentId),
    queryFn: async ({ signal }) => {
      const players = new Map<string, PlayerContent>()
      for (let page = 0; page < 50; page++) {
        const slice = await tournamentApi.pick("players", { tournamentId, page, size: 200 }, signal)
        const own = slice.items.filter((row) => row.context === "TOURNAMENT")
        for (const row of own) players.set(row.id, row.content)
        if (!own.length || own.length < slice.items.length) break
      }
      return players
    },
    enabled: enabled && !!tournamentId,
    staleTime: 30_000,
  })
}
