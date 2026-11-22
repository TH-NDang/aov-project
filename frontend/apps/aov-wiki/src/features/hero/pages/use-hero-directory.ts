import { useQuery } from "@tanstack/react-query"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import { heroCatalogQuery, heroRankingBoardQuery, type HeroListItem } from "../../../lib/hero-api"
import {
  HERO_CHANGE,
  HERO_DIFFICULTIES,
  HERO_POSITIONS,
  HERO_ROLES,
  normalizedHeroSearch,
  selectedHeroFilters,
  type HeroDifficulty,
} from "../../../lib/hero-classifications"
import { heroSearchTexts } from "../../../lib/hero-forms"
import { usePublishedChanges } from "../../../lib/wiki-patch-changes"
import { DIFFICULTY_BAND_WORDS } from "../model/hero-difficulty"
import { heroDifficultyBand, heroRuns, heroSortOf, type HeroSort, type HeroStanding } from "../model/hero-order"
import { heroSearchRank } from "../model/hero-search-rank"

/** The difficulty ratings of the hero profile are on the game's ten-point scale. */
const DIFFICULTY_MAXIMUM = 10

const FILTER_KEYS = ["q", "role", "position", "difficulty", "changed"] as const

function optionCounts<Value extends string>(
  values: readonly Value[],
  heroes: readonly HeroListItem[],
  valuesOf: (hero: HeroListItem) => readonly string[],
) {
  return new Map(values.map((value) => [value, heroes.filter((hero) => valuesOf(hero).includes(value)).length]))
}

/**
 * Everything the hero library reads from the address and the data: the search (kept in the field at once and in the
 * address once typing pauses), the filters, the order, the runs the grid draws and how many heroes each choice would show.
 */
export function useHeroDirectory() {
  const scope = useWikiContext()
  const { locale } = scope
  const query = useQuery(heroCatalogQuery(scope))
  const board = useQuery(heroRankingBoardQuery(scope.region))
  const changes = usePublishedChanges("HERO")
  const [searchParams, setSearchParams] = useSearchParams()
  const heroes = useMemo(() => query.data?.items ?? [], [query.data])

  // ---- Search ----
  const searchInAddress = (searchParams.get("q") || "").slice(0, 120)
  const [typed, setTyped] = useState(searchInAddress)
  const written = useRef(searchInAddress)
  // A search that arrives from the address (the back button, a shared link) replaces what the field holds.
  useEffect(() => {
    if (searchInAddress !== written.current) {
      written.current = searchInAddress
      setTyped(searchInAddress)
    }
  }, [searchInAddress])
  // The list follows the deferred search, so a key press redraws the field first and the list when there is time.
  const search = useDeferredValue(typed)
  const needle = normalizedHeroSearch(search)
  // Every hero's names, folded once per list. The search reads names only: the lanes and the roles have filters of
  // their own, and matching their words would bring in heroes the reader did not mean.
  const searchIndex = useMemo(
    () => new Map(heroes.map((hero) => [hero.id, heroSearchTexts(hero).map((text) => normalizedHeroSearch(text))])),
    [heroes],
  )

  // The address follows the field once typing pauses, so a reader can share or come back to a search.
  useEffect(() => {
    if (typed === written.current) return
    const timer = window.setTimeout(() => {
      written.current = typed
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (typed) next.set("q", typed)
          else next.delete("q")
          return next
        },
        { replace: true },
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [typed, setSearchParams])

  // ---- Filters ----
  const roles = selectedHeroFilters(searchParams.get("role"), HERO_ROLES)
  const positions = selectedHeroFilters(searchParams.get("position"), HERO_POSITIONS)
  const difficulties = selectedHeroFilters(searchParams.get("difficulty"), HERO_DIFFICULTIES)
  const changedOnly = selectedHeroFilters(searchParams.get("changed"), HERO_CHANGE)
  // A change is recorded on a hero or on one of its forms (ADR-024).
  const changedIds = useMemo(() => new Set([...changes.subjects.values()].map(({ id }) => id)), [changes.subjects])
  const bandOf = (hero: HeroListItem) =>
    heroDifficultyBand(hero, DIFFICULTY_MAXIMUM)?.toUpperCase() as HeroDifficulty | undefined
  const isChanged = (hero: HeroListItem) =>
    changedIds.has(hero.id) || (hero.forms ?? []).some((form) => changedIds.has(form.id))

  const matches = {
    search: (hero: HeroListItem) => !needle || heroSearchRank(searchIndex.get(hero.id) ?? [], needle) !== undefined,
    role: (hero: HeroListItem) => !roles.length || roles.some((role) => hero.roles.includes(role)),
    position: (hero: HeroListItem) =>
      !positions.length || positions.some((position) => hero.positions?.includes(position)),
    difficulty: (hero: HeroListItem) => !difficulties.length || difficulties.some((band) => bandOf(hero) === band),
    changed: (hero: HeroListItem) => !changedOnly.length || isChanged(hero),
  }
  type Matcher = keyof typeof matches
  const keptBy = (hero: HeroListItem, skip?: Matcher) =>
    (Object.keys(matches) as Matcher[]).every((key) => key === skip || matches[key](hero))
  const hasFilters = !!search.trim() || roles.length + positions.length + difficulties.length + changedOnly.length > 0

  // ---- Order ----
  const standings = useMemo(() => {
    const ranked = new Map<string, HeroStanding>(
      (board.data?.snapshot ? board.data.entries : []).map(({ heroId, tier, winRate, pickRate, banRate }) => [
        heroId,
        { tier, winRate, pickRate, banRate },
      ]),
    )
    // The game ranks each form of a hero that holds forms, not the hero: its card takes the default form's place.
    for (const hero of heroes) {
      const form = (hero.forms ?? []).find((candidate) => ranked.has(candidate.id))
      if (!ranked.has(hero.id) && form) ranked.set(hero.id, ranked.get(form.id)!)
    }
    return ranked
  }, [board.data, heroes])
  const sorts = useMemo(() => {
    const list: HeroSort[] = ["name"]
    if (heroes.some((hero) => typeof hero.difficulty === "number")) list.push("difficulty")
    if ([...standings.values()].some((standing) => standing.tier)) list.push("tier")
    if ([...standings.values()].some((standing) => typeof standing.winRate === "number")) list.push("winRate")
    return list
  }, [heroes, standings])
  const requested = heroSortOf(searchParams.get("sort"))
  const sort = sorts.includes(requested) ? requested : "name"
  const runs = useMemo(
    () =>
      heroRuns(heroes, sort, {
        standings,
        difficultyMaximum: DIFFICULTY_MAXIMUM,
        bandLabel: (band) => wikiText(locale, ...DIFFICULTY_BAND_WORDS[band]),
        unplaced: wikiText(locale, "Chưa có", "Not rated"),
        locale,
      }),
    [heroes, sort, standings, locale],
  )

  const roleKey = searchParams.get("role") ?? ""
  const positionKey = searchParams.get("position") ?? ""
  const difficultyKey = searchParams.get("difficulty") ?? ""
  const changedKey = searchParams.get("changed") ?? ""
  // Kept as the same list while the search, the filters and the order stay the same, so the grid is not drawn again.
  const visibleHeroes = useMemo(
    () => {
      const kept = runs.flatMap((run) => run.heroes).filter((hero) => keptBy(hero))
      const rank = (hero: HeroListItem) => heroSearchRank(searchIndex.get(hero.id) ?? [], needle) ?? 3
      // A name that starts with the search comes first, then a word that does, then a name that only holds it.
      return needle ? kept.sort((a, b) => rank(a) - rank(b)) : kept
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the matchers read only these keys and the change set
    [runs, needle, roleKey, positionKey, difficultyKey, changedKey, searchIndex, changedIds],
  )

  // What each choice would show: the heroes that every other filter and the search keep.
  const counts = {
    position: optionCounts(
      HERO_POSITIONS.map((option) => option.value),
      heroes.filter((hero) => keptBy(hero, "position")),
      (hero) => hero.positions ?? [],
    ),
    role: optionCounts(
      HERO_ROLES.map((option) => option.value),
      heroes.filter((hero) => keptBy(hero, "role")),
      (hero) => hero.roles,
    ),
    difficulty: optionCounts(
      HERO_DIFFICULTIES.map((option) => option.value),
      heroes.filter((hero) => keptBy(hero, "difficulty")),
      (hero) => [bandOf(hero) ?? ""],
    ),
    changed: new Map([
      ["CHANGED" as const, heroes.filter((hero) => keptBy(hero, "changed") && isChanged(hero)).length],
    ]),
  }

  // ---- Changes to the address ----
  function toggleFilter<Value extends string>(
    key: "role" | "position" | "difficulty" | "changed",
    value: Value,
    selected: readonly Value[],
  ) {
    const values = selected.includes(value) ? selected.filter((current) => current !== value) : [...selected, value]
    const next = new URLSearchParams(searchParams)
    if (values.length) next.set(key, values.sort().join(","))
    else next.delete(key)
    setSearchParams(next)
  }

  function clearFilters(keys: readonly string[] = FILTER_KEYS) {
    if (keys.includes("q")) {
      written.current = ""
      setTyped("")
    }
    const next = new URLSearchParams(searchParams)
    for (const key of keys) next.delete(key)
    setSearchParams(next)
  }

  function setSort(value: HeroSort) {
    const next = new URLSearchParams(searchParams)
    if (value === "name") next.delete("sort")
    else next.set("sort", value)
    setSearchParams(next, { replace: true })
  }

  return {
    query,
    changes,
    heroes,
    typed,
    setTyped: (value: string) => setTyped(value.slice(0, 120)),
    search,
    hasFilters,
    selected: { roles, positions, difficulties, changedOnly },
    counts,
    hasDifficulty: sorts.includes("difficulty"),
    hasChanges: changedIds.size > 0,
    sorts,
    sort,
    setSort,
    runs,
    standings,
    visibleHeroes,
    toggleFilter,
    clearFilters,
    filterCount: roles.length + positions.length + difficulties.length + changedOnly.length,
  }
}
