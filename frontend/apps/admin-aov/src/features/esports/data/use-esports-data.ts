import { useQuery } from "@tanstack/react-query"
import type { GameContent } from "@aov/community-contracts"
import { useSession } from "@/app/auth/auth-gate"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/tournament-api"

/** Cache keys stay under the shared tournament prefix so registry editors refresh these views after saving. */
function useActorKey() {
  const { actor } = useSession()
  return `${actor?.issuer ?? ""}:${actor?.subject ?? ""}`
}

export function useTournamentAccess() {
  const actorKey = useActorKey()
  const me = useQuery({
    queryKey: [...tournamentKeys.all, "me", actorKey],
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
    queryKey: [...tournamentKeys.all, kind, actorKey],
    queryFn: ({ signal }) => tournamentApi.list(kind, signal),
    enabled,
    staleTime: 30_000,
  })
}

export function useRosters(tournamentId: string, enabled = true) {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: [...tournamentKeys.all, "roster-memberships", actorKey, "tournament", tournamentId],
    queryFn: ({ signal }) => tournamentApi.list("roster-memberships", signal, { tournamentId }),
    enabled: enabled && !!tournamentId,
    staleTime: 30_000,
  })
}

/** Games of one series, or every game when no series is given (used for tournament statistics). */
export function useGames(seriesId?: string, enabled = true) {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: [...tournamentKeys.all, "games", actorKey, seriesId ?? "*"],
    queryFn: ({ signal }) => tournamentApi.list("games", signal, seriesId ? seriesId : undefined),
    enabled,
    staleTime: 15_000,
  })
}

export function useGameCatalog(content?: GameContent) {
  const actorKey = useActorKey()
  return useQuery({
    queryKey: [
      ...tournamentKeys.all,
      "catalog",
      actorKey,
      content?.region,
      content?.locale,
      content?.seasonId ?? "",
      content?.patchVariantId ?? "",
      !!content?.includeUnscoped,
    ],
    queryFn: ({ signal }) => tournamentApi.catalog(content!, signal),
    enabled: !!content,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
