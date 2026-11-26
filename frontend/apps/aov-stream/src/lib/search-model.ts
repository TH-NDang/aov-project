import type { CompetitionView } from "@aov/community-contracts"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { byRecency, competitionStatus } from "./competition-model.ts"
import { aheadCompetitions } from "./directory-model.ts"
import { shortCompetitionName } from "./season-name.ts"

/** How well names answer a search: 0 one of them is it, 1 one starts with it, 2 one holds it, 3 none does. */
export type MatchRank = 0 | 1 | 2 | 3

export function matchRank(names: readonly (string | null | undefined)[], search: string): MatchRank {
  const needle = foldSearchText(search.trim())
  if (!needle) return 3
  const folded = names.filter((name): name is string => !!name).map(foldSearchText)
  if (folded.includes(needle)) return 0
  if (folded.some((name) => name.startsWith(needle) || name.split(/[\s\-_.]+/).some((word) => word.startsWith(needle))))
    return 1
  return folded.some((name) => name.includes(needle)) ? 2 : 3
}

const competitionNames = (entry: CompetitionView) => [
  entry.content.tournament.name,
  shortCompetitionName(entry),
  entry.content.plan.circuit,
]

/**
 * Published competitions whose name or circuit holds the search: the closest names first, then those not yet finished,
 * then the newest season, then the latest to start.
 */
export function matchingCompetitions(catalog: CompetitionView[], search: string, now = Date.now()) {
  const finished = (entry: CompetitionView) => Number(competitionStatus(entry.content, now) === "FINISHED")
  return catalog
    .map((entry) => ({ entry, rank: matchRank(competitionNames(entry), search) }))
    .filter(({ rank }) => rank < 3)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        finished(a.entry) - finished(b.entry) ||
        (b.entry.content.tournament.year || 0) - (a.entry.content.tournament.year || 0) ||
        byRecency(a.entry, b.entry),
    )
    .map(({ entry }) => entry)
}

/**
 * The competitions worth offering before anything is typed: those under way, then the next to start (as the directory
 * leads with them), then the last to finish, `size` at most.
 */
export function leadingCompetitions(catalog: CompetitionView[], size: number, now = Date.now()) {
  const ahead = aheadCompetitions(catalog, now)
  if (ahead.length >= size) return ahead.slice(0, size)
  const finished = catalog
    .filter((entry) => !ahead.includes(entry) && competitionStatus(entry.content, now) === "FINISHED")
    .sort((a, b) => (b.content.tournament.endsOn || "").localeCompare(a.content.tournament.endsOn || ""))
  return [...ahead, ...finished].slice(0, size)
}

/** A text cut where the search matches it, ignoring case and tone marks, so the matching part can be drawn apart. */
export function markMatch(text: string, search: string): { text: string; hit: boolean }[] {
  const needle = foldSearchText(search.trim())
  if (!needle) return [{ text, hit: false }]
  // Folds one character at a time, so a position in the folded text maps back to the written one.
  const characters = [...text]
  const folded: string[] = []
  const origin: number[] = []
  characters.forEach((character, index) => {
    for (const part of foldSearchText(character)) {
      folded.push(part)
      origin.push(index)
    }
  })
  const at = folded.join("").indexOf(needle)
  if (at < 0) return [{ text, hit: false }]
  const start = origin[at]!
  const end = origin[at + [...needle].length - 1]! + 1
  return [
    { text: characters.slice(0, start).join(""), hit: false },
    { text: characters.slice(start, end).join(""), hit: true },
    { text: characters.slice(end).join(""), hit: false },
  ].filter((part) => part.text)
}

/** The searches a reader made, newest first: `search` joins them once, `size` at most. */
export function withSearch(searches: readonly string[], search: string, size = 6) {
  const term = search.trim().replace(/\s+/g, " ")
  if (!term) return [...searches]
  const key = foldSearchText(term)
  return [term, ...searches.filter((known) => foldSearchText(known) !== key)].slice(0, size)
}

/**
 * The groups of suggestions in the order they are shown: the group with the closest name first, so the team a reader
 * typed in full is not under three competitions that only contain it; equal groups keep the order given.
 */
export function rankGroups<T extends { ranks: MatchRank[] }>(groups: T[]): T[] {
  const best = (group: T) => Math.min(3, ...group.ranks)
  return groups
    .map((group, order) => ({ group, order }))
    .filter(({ group }) => group.ranks.length > 0)
    .sort((a, b) => best(a.group) - best(b.group) || a.order - b.order)
    .map(({ group }) => group)
}
