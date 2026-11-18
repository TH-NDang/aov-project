import { useQuery } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"

/** A hero as the public Wiki lists it: its code, its name and the face shown next to it. */
export interface PublicHero {
  code: string
  name: string
  head?: string
}

type HeroList = {
  page: {
    items: { code: string; name: string; head?: { currentVersion?: { url?: string } | null } | null }[]
    page: number
    size: number
    totalElements: number
  }
}

export const publicHeroKeys = { all: ["public-heroes"] as const }

const PAGE_SIZE = 100

/** Reads every page of the public hero list; an empty page ends it whatever the total says. */
export async function loadPublicHeroes(signal?: AbortSignal): Promise<PublicHero[]> {
  const heroes: PublicHero[] = []
  for (let page = 0; ; page++) {
    const { page: slice } = await backendRequest<HeroList>(`/heroes?page=${page}&size=${PAGE_SIZE}`, { signal })
    heroes.push(
      ...slice.items.map((hero) => ({ code: hero.code, name: hero.name, head: hero.head?.currentVersion?.url })),
    )
    if (!slice.items.length || (page + 1) * slice.size >= slice.totalElements) return heroes
  }
}

/**
 * Every published hero, read once and shared by every screen that names or shows heroes (builds, rankings, the
 * community directory, the auto-chess guide). `select` shapes the list for one screen without a second request.
 */
export function usePublicHeroes<T = PublicHero[]>(select?: (heroes: PublicHero[]) => T, enabled = true) {
  return useQuery({
    queryKey: publicHeroKeys.all,
    queryFn: ({ signal }) => loadPublicHeroes(signal),
    staleTime: 300_000,
    select,
    enabled,
  })
}

/** Faces of the heroes by code; a hero without one falls back to its initial. */
export const headsByCode = (heroes: PublicHero[]) =>
  new Map(heroes.flatMap((hero) => (hero.head ? [[hero.code, hero.head] as const] : [])))
