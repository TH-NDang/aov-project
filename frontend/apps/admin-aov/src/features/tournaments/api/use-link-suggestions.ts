import { useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import type {
  CommunityProfile,
  DocumentView,
  LinkMention,
  PlayerContent,
  RosterMembershipContent,
  SeriesContent,
  TeamContent,
} from "@aov/community-contracts"
import { pageApi, pageKeys } from "@/features/community/api/page-api"
import { useRecords } from "@/features/esports/data/use-esports-data"
import { teamView, type TeamView } from "@/features/esports/model/game-view"
import { regionName } from "@/features/esports/model/labels"
import {
  mentionNames,
  nameCandidates,
  nameIndex,
  pageCandidates,
  rowSuggestion,
  type LinkCandidate,
  type Named,
  type RowSuggestion,
} from "../model/link-suggestion-model"
import { tournamentApi, tournamentKeys } from "./tournament-api"

/** What the rows of one kind offer, and what their lines show beside the text. */
export type LinkSuggestions = {
  of: (mention: LinkMention) => RowSuggestion | null
  series: (mention: LinkMention) => SeriesContent | undefined
  team: (id: string) => TeamView
}

/** Kept out of the component, so the rows are only put together again when an answer changes. */
const everyRow = <T>(results: { data?: T[] }[]): T[] => results.flatMap((result) => result.data ?? [])
const everyPage = (results: { data?: { items: CommunityProfile[] } }[]) => results.map((result) => result.data?.items)

const namedPlayer = (player: DocumentView<PlayerContent>, detail: string): Named => ({
  id: player.id,
  name: player.content.nickname,
  names: [player.content.nickname, player.content.fullName, ...(player.content.aliases ?? [])],
  imageUrl: player.content.photoUrl,
  detail,
})

const elsewhere = (country?: string | null) => (country ? `Ngoài đội hình · ${regionName(country)}` : "Ngoài đội hình")

const namedTeam = (team: DocumentView<TeamContent>, detail: string): Named => ({
  id: team.id,
  name: team.content.name,
  names: [team.content.name, team.content.shortName, ...(team.content.aliases ?? [])],
  imageUrl: team.content.logoUrl,
  imageDarkUrl: team.content.logoDarkUrl,
  detail,
})

/**
 * Records the written names may stand for. Players of both rosters of the match, or of the tournament for an award,
 * come first; a caster is a person or player page of that very name. Only what the rows on screen need is read.
 */
export function useLinkSuggestions(mentions: readonly LinkMention[], actorKey: string): LinkSuggestions {
  const kind = mentions[0]?.kind
  const people = kind === "SERIES_BROADCAST"
  const players = useRecords("players", !!kind && !people && kind !== "AWARD_TEAM")
  const teams = useRecords("teams", !!kind)
  const tournamentIds = useMemo(() => [...new Set(mentions.map((mention) => mention.tournamentId))], [mentions])
  const series = useQueries({
    queries: tournamentIds.map((tournamentId) => ({
      queryKey: tournamentKeys.inTournament("series", actorKey, tournamentId),
      queryFn: ({ signal }: { signal: AbortSignal }) => tournamentApi.list("series", signal, { tournamentId }),
      staleTime: 30_000,
    })),
    combine: everyRow<DocumentView<SeriesContent>>,
  })
  const rosters = useQueries({
    queries: tournamentIds.map((tournamentId) => ({
      queryKey: tournamentKeys.inTournament("roster-memberships", actorKey, tournamentId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        tournamentApi.list("roster-memberships", signal, { tournamentId }),
      staleTime: 30_000,
      enabled: !people,
    })),
    combine: everyRow<DocumentView<RosterMembershipContent>>,
  })
  const teamIds = useMemo(() => {
    const matches = new Set(mentions.flatMap((mention) => mention.seriesId ?? []))
    return people
      ? []
      : [...new Set(series.flatMap(({ id, content }) => (matches.has(id) ? [content.teamAId, content.teamBId] : [])))]
  }, [people, mentions, series])
  // Who played for the two teams at other tournaments: an imported roster may lack the player a note names.
  const formerLines = useQueries({
    queries: teamIds.map((teamId) => ({
      queryKey: tournamentKeys.teamRosters(actorKey, teamId, "*"),
      queryFn: ({ signal }: { signal: AbortSignal }) => tournamentApi.list("roster-memberships", signal, { teamId }),
      staleTime: 5 * 60_000,
    })),
    combine: everyRow<DocumentView<RosterMembershipContent>>,
  })
  const personNames = useMemo(
    () => [
      ...new Set(people ? mentions.flatMap((mention) => mentionNames(mention).map((written) => written.name)) : []),
    ],
    [people, mentions],
  )
  const pages = useQueries({
    queries: personNames.map((name) => ({
      queryKey: pageKeys.picker(actorKey, name),
      queryFn: () => pageApi.list("", name),
      staleTime: 60_000,
    })),
    combine: everyPage,
  })

  return useMemo(() => {
    const teamById = new Map((teams.data ?? []).map((entry) => [entry.id, entry]))
    const team = (id: string) => teamView(teamById.get(id), id)
    const seriesById = new Map(series.map((entry) => [entry.id, entry.content]))
    const playerById = new Map((players.data ?? []).map((entry) => [entry.id, entry]))
    const everyPlayer = nameIndex(
      (players.data ?? []).map((entry) => namedPlayer(entry, elsewhere(entry.content.country))),
    )
    const everyTeam = nameIndex((teams.data ?? []).map((entry) => namedTeam(entry, "Ngoài giải này")))
    const seriesOf = (mention: LinkMention) => (mention.seriesId ? seriesById.get(mention.seriesId) : undefined)

    const near = (mention: LinkMention): Named[] => {
      const match = seriesOf(mention)
      if (!match) return []
      return formerLines.flatMap(({ content }) => {
        const entry = playerById.get(content.playerId)
        return entry && (content.teamId === match.teamAId || content.teamId === match.teamBId)
          ? [namedPlayer(entry, `Từng ở ${team(content.teamId).name}`)]
          : []
      })
    }
    const inside = (mention: LinkMention): Named[] => {
      const match = seriesOf(mention)
      const lines = rosters.filter(
        ({ content }) =>
          content.tournamentId === mention.tournamentId &&
          (!match || content.teamId === match.teamAId || content.teamId === match.teamBId),
      )
      if (mention.kind === "AWARD_TEAM") {
        const ids = new Set([
          ...lines.map(({ content }) => content.teamId),
          ...series
            .filter(({ content }) => content.tournamentId === mention.tournamentId)
            .flatMap(({ content }) => [content.teamAId, content.teamBId]),
        ])
        return [...ids].flatMap((id) => {
          const entry = teamById.get(id)
          return entry ? [namedTeam(entry, "Trong giải này")] : []
        })
      }
      const seen = new Set<string>()
      return lines.flatMap(({ content }) => {
        const entry = playerById.get(content.playerId)
        if (!entry || seen.has(entry.id)) return []
        seen.add(entry.id)
        return [namedPlayer(entry, team(content.teamId).name)]
      })
    }
    const of = (mention: LinkMention): RowSuggestion | null => {
      if (people)
        return rowSuggestion(mention, (written) =>
          pageCandidates(written, pages[personNames.indexOf(written.name)] ?? []),
        )
      // A match's rows wait for its teams, otherwise the whole tournament would pass for its two rosters.
      if (mention.kind.endsWith("_MVP") && !seriesOf(mention)) return null
      const within = inside(mention)
      const everyone = mention.kind === "AWARD_TEAM" ? everyTeam : everyPlayer
      return rowSuggestion(mention, (written): LinkCandidate[] =>
        nameCandidates(written, within, everyone, {
          near: near(mention),
          resemblingFirst: mention.kind === "AWARD_TEAM",
        }),
      )
    }
    const cache = new Map<LinkMention, RowSuggestion | null>()
    return {
      team,
      series: seriesOf,
      of: (mention) => {
        if (!cache.has(mention)) cache.set(mention, of(mention))
        return cache.get(mention)!
      },
    }
  }, [teams.data, players.data, series, rosters, formerLines, pages, personNames, people])
}
