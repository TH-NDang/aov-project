import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
import { backendRequest, communityRequest } from "@/app/auth/session"

export const DIRECTORY_PAGE_SIZE = 24

export type TeamSort = "RECENT" | "TOURNAMENTS" | "TITLES" | "PRIZE" | "NAME"
export type PlayerSort = "RECENT" | "TOURNAMENTS" | "TITLES" | "NAME"
export type ProfileSort = "RECENT" | "NAME" | "ACTIVITY"

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

export const directoryKeys = ["community-directory"] as const

/** Pages of the identities on screen, so a row can open its profile and show whether it is published. */
export function useProfilesOf(actorKey: string, kind: ProfileKind, entityIds: string[]) {
  const query = useQuery({
    queryKey: [...directoryKeys, actorKey, "profiles-of", kind, entityIds],
    queryFn: ({ signal }) => directoryApi.profiles({ kind, entityIds, size: entityIds.length }, signal),
    enabled: entityIds.length > 0,
    staleTime: 30_000,
  })
  return new Map((query.data?.items ?? []).map((page) => [page.entityId, page]))
}

const foldName = (name: string) =>
  name.replace(/[’‘]/g, "\x27").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
type HeroRow = { name: string; head?: { currentVersion?: { url?: string } | null } | null }

/** Hero portraits by name; signature heroes are stored as the names the sources use. */
export function useHeroPortraits(enabled: boolean) {
  const heroes = useQuery({
    queryKey: [...directoryKeys, "hero-portraits"],
    enabled,
    staleTime: 3_600_000,
    queryFn: async ({ signal }) => {
      const rows: HeroRow[] = []
      for (let page = 0; page < 10; page++) {
        const result = await backendRequest<PageSlice<HeroRow>>(`/heroes?page=${page}&size=100`, { signal })
        rows.push(...result.items)
        if (!result.items.length || rows.length >= result.totalElements) break
      }
      return new Map(rows.map((hero) => [foldName(hero.name), hero.head?.currentVersion?.url]))
    },
  })
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

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})
export const formatPrize = (value?: number | null) => (value ? compactUsd.format(value) : null)
export const winRate = (wins: number, losses: number) =>
  wins + losses ? Math.round((wins / (wins + losses)) * 100) : null
export const yearRange = (first?: number | null, last?: number | null) =>
  first && last && first !== last ? `${first}–${last}` : String(last ?? first ?? "")
