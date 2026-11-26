import type { CompetitionView } from "@aov/community-contracts"
import { competitionChampion } from "./champion-model.ts"
import { byRecency, competitionStatus } from "./competition-model.ts"
import { aheadCompetitions, seasonRows } from "./directory-model.ts"
import { partName } from "./season-name.ts"

const DAY = 86_400_000
const TIERS = ["S", "A", "B", "C", "D"]
/** As many lanes as stand on one screen. */
const SCREEN = 6
/** The labels of one line keep this much of the year between them. */
const APART = 0.008
/** The shortest a span is drawn, about four days, so an event of one day can still be seen. */
const SHORTEST = 0.011
/** The room a season's label takes at least, as a share of the year: with its champion's crest, and without one. */
const LABEL = { won: 0.186, open: 0.175 }
/** The room the name of a part takes, for each of its letters and for the gap after it. */
const PART = { letter: 0.0068, gap: 0.0125 }

/** Which circuit a competition belongs to, or an empty text for one outside any. */
const circuitKey = ({ content }: CompetitionView) => content.circuit?.id || content.plan.circuit || ""

const tierRank = (view: CompetitionView) => {
  const rank = TIERS.indexOf(view.content.tournament.tier ?? "")
  return rank < 0 ? TIERS.length : rank
}

/** The highest tier of these seasons: a circuit is known by its main events, not by the latest part of one. */
export const topTier = (views: CompetitionView[]) => TIERS[Math.min(...views.map(tierRank))]

/** Competitions by circuit, each list newest first, the circuits in the order of their newest season. */
function byCircuit(views: CompetitionView[]) {
  const circuits = new Map<string, CompetitionView[]>()
  for (const view of [...views].sort(byRecency)) {
    const key = circuitKey(view)
    circuits.set(key, [...(circuits.get(key) ?? []), view])
  }
  return circuits
}

/** Whether a map of these competitions is longer than a screen, so that narrowing it helps. */
export const isLongMap = (views: CompetitionView[]) => new Set(views.map(circuitKey)).size > SCREEN

/** When a competition is played, as shares of the year; one that reaches over the year is cut at its edge. */
export type SeasonSpan = { view: CompetitionView; from: number; to: number }

export type SeasonBar = SeasonSpan & {
  /** The room of its label: from where the season starts, or to the end of the year for one that starts too late. */
  left: number
  right: number
  /** The line of its lane it stands on, since seasons whose labels would meet stand under each other. */
  line: number
  /** The rows of part names on the lines above it. */
  above: number
  /** Its qualifiers, wildcards and show matches, oldest first; one without days has no place in the year. */
  parts: SeasonPart[]
  /** Where the names of its parts stand: the free part of its line, as much of it as they need. */
  partsFrom: number
  partsTo: number
}

/** A part under its season's name; without days it has no place in the year. */
export type SeasonPart = { view: CompetitionView; name: string } & ({ from: number; to: number } | { from: null })

export type SeasonLane = {
  key: string
  /** The competitions outside any circuit. */
  other: boolean
  views: CompetitionView[]
  bars: SeasonBar[]
  lines: number
  /** The rows of part names on all of its lines. */
  tall: number
  /** Seasons of the year whose days are not known. */
  undated: CompetitionView[]
}

/** How much of a year has passed when a calendar day begins; before the year it is 0 and after it 1. */
export function shareOfYear(day: string | number, year: number) {
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  const at = typeof day === "number" ? day : Date.parse(`${day}T00:00:00Z`)
  return Math.min(1, Math.max(0, (at - start) / (end - start)))
}

function spanOf(view: CompetitionView, year: number): SeasonSpan | null {
  const { startsOn, endsOn } = view.content.tournament
  const first = startsOn || endsOn
  if (!first) return null
  const last = Date.parse(`${endsOn || startsOn}T00:00:00Z`) + DAY
  const from = Math.min(shareOfYear(first, year), 1 - SHORTEST)
  return { view, from, to: Math.max(shareOfYear(last, year), from + SHORTEST) }
}

type Unplaced = Omit<SeasonBar, "line" | "above" | "partsFrom" | "partsTo">

/** Puts each bar on the first line of its lane that has room for it and its label. */
function packed(bars: Unplaced[]): Pick<SeasonLane, "bars" | "lines" | "tall"> {
  const ends: number[] = []
  const lined = [...bars]
    .sort((a, b) => a.left - b.left)
    .map((bar) => {
      const free = ends.findIndex((end) => end + APART <= bar.left)
      const line = free < 0 ? ends.length : free
      const before = ends[line] ?? -APART
      ends[line] = bar.right
      return { ...bar, line, before }
    })
  // Names of parts start under their season, or further left where the rest of its line is too short for them.
  const named = lined.map(({ before, ...bar }, at) => {
    const partsTo = (lined.slice(at + 1).find((next) => next.line === bar.line)?.left ?? 1 + APART) - APART
    const need = bar.parts.reduce((sum, part) => sum + part.name.length * PART.letter + PART.gap, 0)
    const partsFrom = Math.max(before + APART, Math.min(bar.left, partsTo - need))
    return { ...bar, partsFrom, partsTo, rows: Math.ceil(need / (partsTo - partsFrom) - 0.001) }
  })
  const rows = ends.map((_, line) => Math.max(0, ...named.filter((bar) => bar.line === line).map((bar) => bar.rows)))
  const sum = (list: number[]) => list.reduce((total, value) => total + value, 0)
  return {
    bars: named.map(({ rows: _, ...bar }) => ({ ...bar, above: sum(rows.slice(0, bar.line)) })),
    lines: Math.max(1, ends.length),
    tall: sum(rows),
  }
}

function lane(key: string, views: CompetitionView[], year: number): SeasonLane {
  const bars: Unplaced[] = []
  const undated: CompetitionView[] = []
  const rows = seasonRows(views)
  rows.forEach(({ view, part }, at) => {
    if (part) return
    const after = rows.findIndex((row, index) => index > at && !row.part)
    const parts = rows.slice(at + 1, after < 0 ? undefined : after).map((row) => row.view)
    const span = spanOf(view, year)
    if (!span) {
      undated.push(view, ...parts)
      return
    }
    const won = competitionStatus(view.content) === "FINISHED" && competitionChampion(view)
    const label = won ? LABEL.won : LABEL.open
    const left = Math.min(span.from, 1 - label)
    const { circuit, plan, tournament } = view.content
    bars.push({
      ...span,
      left,
      right: Math.max(span.to, left + label),
      parts: parts
        .map((item) => ({
          ...(spanOf(item, year) ?? { view: item, from: null }),
          name: partName(item.content.tournament.name, tournament.name, circuit?.name || plan.circuit || null, year),
        }))
        .sort((a, b) => (a.from ?? 2) - (b.from ?? 2)),
    })
  })
  return { key: key || "other", other: !key, views, undated, ...packed(bars) }
}

/** The seasons of one year as lanes, a lane per circuit: the highest tier first, then the newest season. */
export function seasonLanes(views: CompetitionView[], year: number): SeasonLane[] {
  const lanes = [...byCircuit(views)].map(([key, list]) => lane(key, list, year))
  const rank = ({ views: list }: SeasonLane) => Math.min(...list.map(tierRank))
  return lanes.sort((a, b) => Number(a.other) - Number(b.other) || rank(a) - rank(b))
}

export type ChampionBanner = {
  key: string
  /** The season its holder won. */
  view: CompetitionView
  /** How many seasons of the circuit in the list the holder has won, this one included. */
  titles: number
  /** The season of the circuit that is on now or next. */
  next: CompetitionView | null
}

/**
 * The champions whose banners hang over the directory: of each circuit the latest one, the highest tier first. A
 * circuit whose last champion is older than `within` days hangs none.
 */
export function championBanners(views: CompetitionView[], { most = 6, within = 550, now = Date.now() } = {}) {
  const banners: ChampionBanner[] = []
  for (const [key, list] of byCircuit(views)) {
    if (!key) continue
    const seasons = seasonRows(list)
      .filter((row) => !row.part && competitionStatus(row.view.content, now) === "FINISHED")
      .map(({ view }) => ({ view, winner: competitionChampion(view)?.winner }))
      .filter((season) => season.winner)
    const [latest] = seasons
    if (!latest) continue
    const ended = latest.view.content.tournament.endsOn ?? latest.view.content.tournament.startsOn
    if (ended && now - Date.parse(`${ended}T00:00:00Z`) > within * DAY) continue
    const same = (winner: typeof latest.winner) =>
      winner && latest.winner && (winner.id ? winner.id === latest.winner.id : winner.name === latest.winner.name)
    banners.push({
      key,
      view: latest.view,
      titles: seasons.filter((season) => same(season.winner)).length,
      next: aheadCompetitions(list, now)[0] ?? null,
    })
  }
  return banners
    .map((banner, at) => ({ banner, at, rank: tierRank(banner.view) }))
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .slice(0, most)
    .map(({ banner }) => banner)
}
