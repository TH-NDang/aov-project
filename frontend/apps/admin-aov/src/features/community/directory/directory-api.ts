import { useEffect, useState } from "react"
import { useQueries } from "@tanstack/react-query"
import type {
  CareerStatus,
  CommunityProfile,
  CompetitionPageEntry,
  Lane,
  PageSlice,
  PersonRoleFilter,
  PlayerDirectoryEntry,
  ProfileKind,
  TeamDirectoryEntry,
} from "@aov/community-contracts"
import { communityRequest } from "@/app/auth/session"
import { normalize } from "@/lib/text"
import { usePublicHeroes, type PublicHero } from "@/lib/public-heroes"
import { pageKeys } from "../api/page-api"

export const DIRECTORY_PAGE_SIZE = 24

export type TeamSort = "RECENT" | "TOURNAMENTS" | "TITLES" | "PRIZE" | "NAME"
export type PlayerSort = "RECENT" | "TOURNAMENTS" | "TITLES" | "NAME"
export type ProfileSort = "RECENT" | "NAME" | "ACTIVITY" | "ACTIVE"

const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value))
  return params.toString()
}

export const directoryApi = {
  teams: (filters: { q: string; country: string; sort: TeamSort; page: number }, signal?: AbortSignal) =>
    communityRequest<PageSlice<TeamDirectoryEntry>>(
      `/admin/teams/directory?${query({ ...filters, size: DIRECTORY_PAGE_SIZE })}`,
      { signal },
    ),
  players: (
    filters: { q: string; country: string; lane: Lane | ""; status: CareerStatus | ""; sort: PlayerSort; page: number },
    signal?: AbortSignal,
  ) =>
    communityRequest<PageSlice<PlayerDirectoryEntry>>(
      `/admin/players/directory?${query({ ...filters, size: DIRECTORY_PAGE_SIZE })}`,
      { signal },
    ),
  competitionPages: (signal?: AbortSignal) =>
    communityRequest<CompetitionPageEntry[]>("/admin/competitions/page-stats", { signal }),
  profiles: (
    filters: {
      kind?: ProfileKind
      q?: string
      personRole?: PersonRoleFilter
      country?: string
      entityIds?: string[]
      sort?: ProfileSort
      page?: number
      size?: number
    },
    signal?: AbortSignal,
  ) =>
    communityRequest<PageSlice<CommunityProfile>>(
      `/admin/pages?${query({ ...filters, entityIds: filters.entityIds?.join(","), size: filters.size ?? DIRECTORY_PAGE_SIZE })}`,
      { signal },
    ),
}

/** Under the page keys, so every profile save that refreshes the pages refreshes the directory too. */
export const directoryKeys = [...pageKeys, "directory"] as const

/**
 * Pages of the identities on screen, so a row can open its profile and show whether it is published. Asked for one
 * batch at a time: a list that keeps growing would otherwise repeat every earlier id and outgrow the request URL.
 */
export function useProfilesOf(actorKey: string, kind: ProfileKind, entityIds: string[]) {
  const batches = Array.from({ length: Math.ceil(entityIds.length / DIRECTORY_PAGE_SIZE) }, (_, index) =>
    entityIds.slice(index * DIRECTORY_PAGE_SIZE, (index + 1) * DIRECTORY_PAGE_SIZE),
  )
  const results = useQueries({
    queries: batches.map((ids) => ({
      queryKey: [...directoryKeys, actorKey, "profiles-of", kind, ids],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        directoryApi.profiles({ kind, entityIds: ids, size: ids.length }, signal),
      staleTime: 30_000,
    })),
  })
  return new Map(results.flatMap((result) => result.data?.items ?? []).map((page) => [page.entityId, page]))
}

const foldName = (name: string) => normalize(name.replace(/[’‘]/g, "\x27"))
const portraitsByName = (heroes: PublicHero[]) => new Map(heroes.map((hero) => [foldName(hero.name), hero.head]))

/** Hero portraits by name; signature heroes are stored as the names the sources use. */
export function useHeroPortraits(enabled: boolean) {
  const heroes = usePublicHeroes(portraitsByName, enabled)
  return (name: string) => heroes.data?.get(foldName(name))
}

/** Waits for typing to pause, so each search reaches the server once. */
export function useDebounced<T>(value: T, delay = 250) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

export const winRate = (wins: number, losses: number) =>
  wins + losses ? Math.round((wins / (wins + losses)) * 100) : null
export const yearRange = (first?: number | null, last?: number | null) =>
  first && last && first !== last ? `${first}–${last}` : String(last ?? first ?? "")
