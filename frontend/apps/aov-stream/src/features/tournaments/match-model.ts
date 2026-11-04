import type { CompetitionView, PlannedMatch, PublishedGame, ResolvedMatch } from "@aov/community-contracts"

export type CompetitionMatch = {
  competition: CompetitionView
  match: PlannedMatch
  result?: ResolvedMatch
}

export function competitionMatches(competitions: CompetitionView[]): CompetitionMatch[] {
  return competitions.flatMap((competition) => {
    const results = new Map(competition.content.resolved.map((result) => [result.key, result]))
    return competition.content.plan.matches.map((match) => ({ competition, match, result: results.get(match.key) }))
  })
}

export function competitionMatchHref(competitionId: string, key: string) {
  return `/competitions/${encodeURIComponent(competitionId)}/matches/${encodeURIComponent(key)}`
}

export function matchSeriesId(entry: CompetitionMatch) {
  return entry.result?.seriesId || entry.match.seriesId || undefined
}

export function findSeriesMatch(competition: CompetitionView, seriesId: string) {
  return competitionMatches([competition]).find((entry) => matchSeriesId(entry) === seriesId)
}

/** A scheduled time alone is not evidence that a match is live or complete. */
export function matchState(entry: CompetitionMatch, now = Date.now()) {
  const { scoreA, scoreB } = entry.result || {}
  if (scoreA != null && scoreB != null) {
    return Math.max(scoreA, scoreB) >= Math.floor(entry.match.bestOf / 2) + 1 && scoreA !== scoreB
      ? "FINISHED"
      : "SCORED"
  }
  const at = Date.parse(entry.match.scheduledAt || "")
  return Number.isNaN(at) ? "UNSCHEDULED" : at > now ? "UPCOMING" : "PENDING"
}

export function orderedMatchGames(games: PublishedGame[], seriesId: string) {
  return games.filter((game) => game.content.seriesId === seriesId).sort((a, b) => a.content.number - b.content.number)
}

export function groupMatchesByDay(entries: CompetitionMatch[], timeZone: string) {
  const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
  const labelFormat = new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const groups = new Map<string, { key: string; label: string; items: CompetitionMatch[] }>()
  const timestamp = (entry: CompetitionMatch) => {
    const at = Date.parse(entry.match.scheduledAt || "")
    return Number.isFinite(at) ? at : Infinity
  }
  for (const entry of [...entries].sort((a, b) => timestamp(a) - timestamp(b))) {
    const at = timestamp(entry)
    const key = Number.isFinite(at) ? keyFormat.format(at) : "unscheduled"
    if (!groups.has(key))
      groups.set(key, { key, label: key === "unscheduled" ? "Chờ xếp lịch" : labelFormat.format(at), items: [] })
    groups.get(key)!.items.push(entry)
  }
  return [...groups.values()]
}
