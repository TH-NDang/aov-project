import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { GameContent } from "@aov/community-contracts"
import { useSession } from "@/app/auth/auth-gate"
import {
  catalogScopeOf,
  tournamentApi,
  tournamentKeys,
  type GamePatchScope,
} from "@/features/tournaments/api/tournament-api"

/** Cache keys stay under the shared tournament prefix so registry editors refresh these views after saving. */
function useActorKey() {
  const { actor } = useSession()
  return `${actor?.issuer ?? ""}:${actor?.subject ?? ""}`
}

export function useTournamentAccess() {
  const actorKey = useActorKey()
  const me = useQuery({
    queryKey: tournamentKeys.me(actorKey),
    queryFn: ({ signal }) => tournamentApi.me(signal),
    retry: 1,
    staleTime: 60_000,
  })
  const capabilities = me.data?.capabilities ?? []
  return {
    actorKey,
    me,
    canRead: capabilities.includes("tournament:read"),
    canWrite: capabilities.includes("tournament:write"),
    canPublish: capabilities.includes("tournament:publish"),
  }
}

type ListKind = "teams" | "players" | "tournaments" | "series"

export function useRecords<K extends ListKind>(kind: K, enabled = true) {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: tournamentKeys.list(kind, actorKey),
    queryFn: ({ signal }) => tournamentApi.list(kind, signal),
    enabled,
    staleTime: 30_000,
  })
}

/** One tournament's matches; a tournament list reads `useTournamentStats` instead of loading every match. */
export function useTournamentSeries(tournamentId: string, enabled = true) {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: tournamentKeys.inTournament("series", actorKey, tournamentId),
    queryFn: ({ signal }) => tournamentApi.list("series", signal, { tournamentId }),
    enabled: enabled && !!tournamentId,
    staleTime: 30_000,
  })
}

export function useTournamentStats() {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: tournamentKeys.stats(actorKey),
    queryFn: ({ signal }) => tournamentApi.tournamentStats(signal),
    staleTime: 30_000,
  })
}

export function useRosters(tournamentId: string, enabled = true) {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: tournamentKeys.inTournament("roster-memberships", actorKey, tournamentId),
    queryFn: ({ signal }) => tournamentApi.list("roster-memberships", signal, { tournamentId }),
    enabled: enabled && !!tournamentId,
    staleTime: 30_000,
  })
}

/** Games of one series, or every game when no series is given (used for tournament statistics). */
/** One tournament's games, for screens that summarize its matches. */
export function useTournamentGames(tournamentId: string, enabled = true) {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: tournamentKeys.inTournament("games", actorKey, tournamentId),
    queryFn: ({ signal }) => tournamentApi.list("games", signal, { tournamentId }),
    enabled: enabled && !!tournamentId,
    staleTime: 15_000,
  })
}

export function useGames(seriesId?: string, enabled = true) {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: tournamentKeys.seriesGames(actorKey, seriesId),
    queryFn: ({ signal }) => tournamentApi.list("games", signal, seriesId ? seriesId : undefined),
    enabled,
    staleTime: 15_000,
  })
}

/** The season and patch of each game of a tournament, by game id. */
export function useGamePatches(tournamentId?: string) {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: tournamentKeys.gamePatches(actorKey, tournamentId ?? ""),
    queryFn: ({ signal }) => tournamentApi.gamePatches(tournamentId!, signal),
    enabled: !!tournamentId,
    staleTime: 30_000,
    select: (rows) => new Map(rows.map((row) => [row.gameId, row])),
  })
}

/**
 * The catalog a game is recorded in: its own season and patch, or those of its stage on the day it was played. While
 * another one is read, the one on screen stays, so the faces of a game do not give way to letters.
 */
export function useGameCatalog(content?: GameContent, scope?: GamePatchScope) {
  const actorKey = useActorKey()
  const scoped = content && catalogScopeOf(content, scope)
  return useQuery({
    queryKey: tournamentKeys.catalog(actorKey, scoped),
    queryFn: ({ signal }) => tournamentApi.catalog(scoped!, signal),
    enabled: !!content,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
