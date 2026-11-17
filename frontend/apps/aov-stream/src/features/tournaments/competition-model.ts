import type {
  CompetitionStage,
  CompetitionView,
  PlannedMatch,
  TeamContent,
  TournamentContent,
} from "@aov/community-contracts"
import { tournamentPodium, type PodiumTeam } from "@aov/ui/lib/tournament-podium"
import { matchState, type CompetitionMatch } from "./match-model.ts"

/** A match is treated as under way for this long after its start when no score has been entered yet. */
const UNDERWAY_WINDOW = 3 * 60 * 60 * 1000

const startOf = (entry: CompetitionMatch) => Date.parse(entry.match.scheduledAt || "")

/** Whether a match without a score started recently enough to be on now. Never read from a status field. */
export function matchUnderway(entry: CompetitionMatch, now = Date.now()) {
  const at = startOf(entry)
  return matchState(entry, now) === "PENDING" && now - at < UNDERWAY_WINDOW
}

/**
 * The matches a reader wants first: what is on now, what comes next, then the latest results. Each part keeps its own
 * order (soonest first for what is ahead, newest first for what is done), so the row reads from now outward.
 */
export function matchStrip(entries: CompetitionMatch[], now = Date.now(), ahead = 6, done = 6) {
  const timed = entries.filter((entry) => Number.isFinite(startOf(entry)))
  const underway = timed.filter((entry) => matchUnderway(entry, now)).sort((a, b) => startOf(a) - startOf(b))
  const upcoming = timed
    .filter((entry) => matchState(entry, now) === "UPCOMING")
    .sort((a, b) => startOf(a) - startOf(b))
    .slice(0, Math.max(0, ahead - underway.length))
  const results = timed
    .filter((entry) => {
      const state = matchState(entry, now)
      return state === "FINISHED" || state === "SCORED"
    })
    .sort((a, b) => startOf(b) - startOf(a))
    .slice(0, done)
  return [...underway, ...upcoming, ...results]
}

/** The side that won a decided match, or null while it is open. */
export function matchWinner(entry: CompetitionMatch): "a" | "b" | null {
  const { scoreA, scoreB } = entry.result || {}
  if (scoreA == null || scoreB == null || scoreA === scoreB) return null
  return matchState(entry) === "FINISHED" ? (scoreA > scoreB ? "a" : "b") : null
}

/**
 * A match label worth showing beside the teams. Imported plans repeat the stage and the two team codes in every label
 * ("Playoffs · BAC vs ANK"), which says nothing the row does not already show.
 */
export function matchRoundLabel(match: PlannedMatch, stage?: Pick<CompetitionStage, "name"> | null) {
  const parts = match.label
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part && !/\bvs\.?\b/i.test(part) && part !== stage?.name)
  return parts.join(" · ") || null
}

export type BracketLane = {
  key: "upper" | "lower" | "final" | "rounds"
  rounds: { round: number; matches: PlannedMatch[] }[]
}

/**
 * Splits an elimination stage into the lanes a reader expects. A stage where the loser of one of its matches plays on
 * towards the title is a double elimination: matches fed by a loser, and those that follow them, form the lower lane,
 * and the match between the two lanes' winners stands alone as the final. Any other stage is laid out by round; a
 * match for third place, fed by losers but leading nowhere, does not make a lower lane.
 */
export function bracketLanes(matches: PlannedMatch[]): BracketLane[] {
  const byRound = (list: PlannedMatch[]) => {
    const rounds = new Map<number, PlannedMatch[]>()
    for (const match of list) rounds.set(match.round, [...(rounds.get(match.round) ?? []), match])
    return [...rounds].sort(([a], [b]) => a - b).map(([round, entries]) => ({ round, matches: entries }))
  }
  const byKey = new Map(matches.map((match) => [match.key, match]))
  // Only links inside this stage count: a slot may also name a match of an earlier stage.
  const feeders = (match: PlannedMatch) =>
    [match.a, match.b].flatMap((slot) => (slot.matchKey && byKey.has(slot.matchKey) ? [slot] : []))
  const loserFed = (match: PlannedMatch) => feeders(match).some((slot) => slot.type === "LOSER")
  const playsOn = new Set(
    matches.flatMap((match) => feeders(match).flatMap((slot) => (slot.type === "WINNER" ? [slot.matchKey!] : []))),
  )
  if (!matches.some((match) => loserFed(match) && playsOn.has(match.key)))
    return [{ key: "rounds", rounds: byRound(matches) }]

  const lower = new Set<string>()
  // A match is in the lower lane when a loser drops into it, or when everything feeding it is already there.
  for (let changed = true; changed;) {
    changed = false
    for (const match of matches) {
      if (lower.has(match.key)) continue
      const sources = feeders(match)
      const allLower =
        sources.length > 0 && sources.every((slot) => slot.type === "WINNER" && lower.has(slot.matchKey!))
      if (loserFed(match) || allLower) {
        lower.add(match.key)
        changed = true
      }
    }
  }
  // The final takes one winner from each lane.
  const final = matches.filter((match) => {
    const sources = feeders(match)
    return (
      !lower.has(match.key) &&
      sources.length === 2 &&
      sources.every((slot) => slot.type === "WINNER") &&
      sources.some((slot) => lower.has(slot.matchKey!)) &&
      sources.some((slot) => !lower.has(slot.matchKey!))
    )
  })
  const finalKeys = new Set(final.map((match) => match.key))
  const lanes: BracketLane[] = [
    { key: "upper", rounds: byRound(matches.filter((match) => !lower.has(match.key) && !finalKeys.has(match.key))) },
    { key: "lower", rounds: byRound(matches.filter((match) => lower.has(match.key))) },
  ]
  if (final.length) lanes.push({ key: "final", rounds: byRound(final) })
  return lanes.filter((lane) => lane.rounds.length)
}

type CodeNames = Readonly<Record<string, readonly [vi: string, en: string]>>

export const STAGE_FORMAT_NAMES: CodeNames = {
  ROUND_ROBIN: ["Vòng tròn", "Round robin"],
  SINGLE_ELIMINATION: ["Loại trực tiếp", "Single elimination"],
  DOUBLE_ELIMINATION: ["Nhánh thắng – nhánh thua", "Upper bracket / lower bracket"],
}

export const TIER_NAMES: CodeNames = {
  S: ["Hạng S", "S-Tier"],
  A: ["Hạng A", "A-Tier"],
  B: ["Hạng B", "B-Tier"],
  C: ["Hạng C", "C-Tier"],
  D: ["Hạng D", "D-Tier"],
}
export const VENUE_MODE_NAMES: CodeNames = {
  ONLINE: ["Trực tuyến", "Online"],
  OFFLINE: ["Tại sân khấu", "Offline"],
  HYBRID: ["Kết hợp", "Hybrid"],
}
export const COMPETITION_TYPE_NAMES: CodeNames = {
  LEAGUE: ["Giải vô địch", "League"],
  CUP: ["Cúp", "Cup"],
  QUALIFIER: ["Vòng loại", "Qualifier"],
  SHOWMATCH: ["Giao hữu", "Showmatch"],
}

/** The name of a coded value through `text`, or undefined for a code the table does not know. */
export function codeName(names: CodeNames, code: string | null | undefined, text: (vi: string, en: string) => string) {
  const pair = code ? names[code] : undefined
  return pair && text(pair[0], pair[1])
}

/** The champion of a finished competition, from its final table or the result an editor typed by hand. */
export function champion(tournament: TournamentContent, teams: Record<string, TeamContent>) {
  const podium = tournamentPodium(tournament)
  if (!podium) return null
  const find = (side: PodiumTeam) =>
    (side.teamId ? teams[side.teamId] : undefined) ??
    Object.values(teams).find((team) => team.name === side.name || team.shortName === side.name) ?? {
      code: "",
      name: side.name,
    }
  return { winner: find(podium.winner), runnerUp: podium.runnerUp && find(podium.runnerUp), score: podium.score }
}

/** Newest first; competitions without dates go last. */
export function byRecency(a: CompetitionView, b: CompetitionView) {
  const date = (view: CompetitionView) => view.content.tournament.startsOn || view.content.tournament.endsOn || ""
  return date(b).localeCompare(date(a))
}

/** Soonest first, for what has not started yet; competitions without dates go last. */
export function bySoonest(a: CompetitionView, b: CompetitionView) {
  const date = (view: CompetitionView) => view.content.tournament.startsOn || view.content.tournament.endsOn || "9999"
  return date(a).localeCompare(date(b))
}

/**
 * Stages in the order they are played: by the earliest dated match of each, since imported plans do not store them in
 * that order. Stages without a dated match follow, in the plan's order.
 */
export function playedOrder<T extends Pick<CompetitionStage, "code">>(stages: T[], matches: PlannedMatch[]): T[] {
  const first = new Map<string, number>()
  for (const match of matches) {
    const at = match.scheduledAt ? Date.parse(match.scheduledAt) : NaN
    if (Number.isNaN(at)) continue
    first.set(match.stageCode, Math.min(first.get(match.stageCode) ?? Infinity, at))
  }
  return stages
    .map((stage, index) => ({ stage, index, at: first.get(stage.code) ?? Infinity }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map(({ stage }) => stage)
}
