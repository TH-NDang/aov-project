import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query"
import type { CommunityProfile, CompetitionParticipant, CompetitionView, ProfileKind } from "@aov/community-contracts"
import { participantPath } from "./participant-model"
import { matchingCompetitions, matchRank, rankGroups, type MatchRank } from "./search-model"
import { pageSearchQuery, participantSearchQuery } from "./search-queries"
import { shortCompetitionName } from "./season-name"
import { competitionCatalogQuery } from "./tournament-api"

type Base = { id: string; to: string; name: string; rank: MatchRank }
export type Suggestion =
  | (Base & { kind: "COMPETITION"; entry: CompetitionView })
  | (Base & { kind: CompetitionParticipant["kind"]; item: CompetitionParticipant })
  | (Base & { kind: "PAGE"; profile: CommunityProfile })
export type SuggestionGroup = {
  key: "COMPETITION" | CompetitionParticipant["kind"] | "PAGE"
  items: Suggestion[]
  ranks: MatchRank[]
}

/** The pages a search suggests besides teams and people: who organizes, and the circuits. */
const PAGE_KINDS: ProfileKind[] = ["ORGANIZATION", "CIRCUIT"]
/** Server searches start at two characters: one matches most names and tells the reader nothing yet. */
const REMOTE_FROM = 2

/** The value once it has stopped changing for `delay` ms, so typing a word asks the server once, not per key. */
function useSettled(value: string, delay: number) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return settled
}

/** The closest first, the server's order (latest seen first) between equals. */
const byRank = <T extends Suggestion>(items: T[]) =>
  items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => a.item.rank - b.item.rank || a.order - b.order)
    .map(({ item }) => item)

/**
 * What the field suggests for a search while `shown`, in groups: competitions (read from the catalog every list already keeps),
 * teams, players and staff, then organization and circuit pages. Each group holds `size` at most; the groups come in
 * the order of their closest name. The server is asked with the same keys as the page of results.
 */
export function useSearchSuggestions(search: string, size: number, shown: boolean) {
  const typed = search.trim()
  const term = useSettled(typed, 160)
  // Nothing is read until the suggestions show: most pages are opened without a search.
  const remote = shown && term.length >= REMOTE_FROM
  // While the next word is read, the suggestions of the last one stay, so the list does not blink at every key.
  const options = { enabled: remote, placeholderData: keepPreviousData }
  const participants = {
    TEAM: useInfiniteQuery({ ...participantSearchQuery("TEAM", term), ...options }),
    PLAYER: useInfiniteQuery({ ...participantSearchQuery("PLAYER", term), ...options }),
    PERSON: useInfiniteQuery({ ...participantSearchQuery("PERSON", term), ...options }),
  }
  const pages = useQueries({ queries: PAGE_KINDS.map((kind) => ({ ...pageSearchQuery(kind, term), ...options })) })
  const catalog = useQuery({ ...competitionCatalogQuery, enabled: shown && !!term })
  const competitions = useMemo(() => (term ? matchingCompetitions(catalog.data ?? [], term) : []), [catalog.data, term])

  const people = (kind: CompetitionParticipant["kind"]): SuggestionGroup => {
    const items = byRank(
      ((remote && participants[kind].data?.pages[0]?.items) || []).map((item) => ({
        kind,
        id: item.id,
        to: participantPath(item),
        name: item.name,
        rank: matchRank([item.name, item.shortName], term),
        item,
      })),
    ).slice(0, size)
    return { key: kind, items, ranks: items.map((item) => item.rank) }
  }
  const competitionItems = competitions.slice(0, size).map((entry) => ({
    kind: "COMPETITION" as const,
    id: entry.id,
    to: `/competitions/${entry.id}`,
    name: entry.content.tournament.name,
    rank: matchRank([entry.content.tournament.name, shortCompetitionName(entry), entry.content.plan.circuit], term),
    entry,
  }))
  const pageItems = byRank(
    pages.flatMap((group) =>
      ((remote && group.data?.items) || []).map((profile) => {
        const name = profile.content?.name || profile.code
        return {
          kind: "PAGE" as const,
          id: profile.id,
          to: `/pages/${profile.code}`,
          name,
          rank: matchRank([name, profile.content?.shortName], term),
          profile,
        }
      }),
    ),
  ).slice(0, Math.max(2, size - 1))
  const groups = rankGroups<SuggestionGroup>([
    people("TEAM"),
    { key: "COMPETITION", items: competitionItems, ranks: competitionItems.map((item) => item.rank) },
    people("PLAYER"),
    people("PERSON"),
    { key: "PAGE", items: pageItems, ranks: pageItems.map((item) => item.rank) },
  ])
  const asked = [...Object.values(participants), ...pages]
  return {
    groups,
    /** Still typing, or still reading what was typed. */
    pending:
      typed !== term ||
      (!!term && catalog.isPending) ||
      (remote && asked.some((query) => query.isPending || query.isPlaceholderData)),
    failed: (catalog.isError && !catalog.data) || (remote && asked.some((query) => query.isLoadingError)),
    retry: () => {
      void catalog.refetch()
      asked.forEach((query) => void query.refetch())
    },
  }
}

/** Every suggestion in reading order, as the field's arrow keys move through them. */
export const suggestionList = (groups: SuggestionGroup[]) => groups.flatMap((group) => group.items)
