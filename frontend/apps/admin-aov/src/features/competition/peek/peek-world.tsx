import { createContext, useContext, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import type {
  CompetitionStanding,
  PlayerContent,
  ProfileKind,
  ResolvedMatch,
  RosterMembershipContent,
} from "@aov/community-contracts"
import type { BackLink } from "./peek-model"
import type { TeamView } from "@/features/esports/model/game-view"
import { pageKeys } from "@/features/community/api/page-api"
import { directoryApi } from "@/features/community/directory/directory-api"

/** Where a profile opened from a peek card sends the reader back to. */

/** What the peek cards of one tournament read, and what they may ask the workspace to do. */
export type PeekWorld = {
  actorKey: string
  tournamentId: string
  tournamentName: string
  team: (id: string) => TeamView
  /** How the team entered, such as "Đã đăng ký"; absent for a team that is not an entrant. */
  entry: (teamId: string) => string | undefined
  rosters: RosterMembershipContent[]
  /** Admin records of the roster's players, with what only editors see. */
  players?: Map<string, PlayerContent>
  /** Players the published snapshot names, for those the records have not answered yet. */
  known: Record<string, PlayerContent>
  resolved: Iterable<ResolvedMatch>
  standings: { stageCode: string; rows: CompetitionStanding[] }[]
  stageName: (code: string) => string | undefined
  /** The final place of a team, recorded or suggested by the matches, once the tournament has one. */
  finalPlace?: (teamId: string) => string | undefined
  back: BackLink
  openRoster?: (teamId: string) => void
  openRecord?: (teamId: string) => void
  showMatches?: (teamId: string) => void
}

const World = createContext<PeekWorld | null>(null)

export function PeekWorldProvider({ value, children }: { value: PeekWorld; children: ReactNode }) {
  return <World.Provider value={value}>{children}</World.Provider>
}

/** The tournament the names on screen belong to; null outside one, where names stay plain text. */
export const usePeekWorld = () => useContext(World)

/** The profile page of a team or player record, or null when it has none yet. */
export function useRecordPage(actorKey: string, kind: Extract<ProfileKind, "TEAM" | "PLAYER">, entityId: string) {
  return useQuery({
    queryKey: pageKeys.directory.profilesOf(actorKey, kind, [entityId]),
    queryFn: ({ signal }) => directoryApi.profiles({ kind, entityIds: [entityId], size: 1 }, signal),
    select: (slice) => slice.items.find((page) => page.entityId === entityId) ?? null,
    staleTime: 60_000,
  })
}
