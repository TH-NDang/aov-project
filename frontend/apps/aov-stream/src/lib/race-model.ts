import type { CompetitionMatch } from "./match-model.ts"
import type { PlaceZone } from "./place-zones.ts"
import { sharedPlaces, type StandingStep, type SteppedGroup } from "./standings-steps.ts"

/** Fewer steps or teams than this make no race: their lines would say less than the table beside them. */
export const LEAST_RACE = 5

/** Where places stand, in pixels: the middle of each, counted from 1, and the height of them all. */
export type RaceScale = { y: (place: number) => number; height: number; row: number }

/** The scale of rows of one height, with a heading over the first place of each zone. */
export function raceScale(places: number, row: number, zones: Pick<PlaceZone, "from">[] = [], heading = 0): RaceScale {
  const headings = (place: number) => zones.filter(({ from }) => from <= place).length
  return {
    y: (place) => (place - 0.5) * row + headings(place) * heading,
    height: places * row + zones.length * heading,
    row,
  }
}

/** Where the border over each zone but the first runs: halfway between the places on either side of it. */
export const raceBorders = (zones: Pick<PlaceZone, "from">[], { y }: RaceScale): number[] =>
  zones.slice(1).map(({ from }) => (y(from - 1) + y(from)) / 2)

/** Where a team stood after a step; level teams stand in the middle of the places they share. */
export type RaceStop = { step: number; y: number }

/** Where a team stood after every step from its first match to the step shown. */
export function raceStops(group: SteppedGroup, teamId: string, shown: number, scale: RaceScale): RaceStop[] {
  return group.tables.slice(0, shown + 1).flatMap((rows, step): RaceStop[] => {
    const places = sharedPlaces(rows, teamId)
    if (!places || !rows.some((row) => row.teamId === teamId && row.played > 0)) return []
    return [{ step, y: (scale.y(places[0]) + scale.y(places[1])) / 2 }]
  })
}

/** What a race draws for a team: its line up to the step shown, and the middle of its row. */
export type RaceLine = { teamId: string; stops: RaceStop[]; row: number; look: "lit" | "gold" | "plain" }

/** What is drawn later lies on top. */
const LAYERS = ["plain", "gold", "lit"]

/** The line of every team in the order they are drawn; the first place is golden where `gold` allows it. */
export function raceLines(
  group: SteppedGroup,
  shown: number,
  scale: RaceScale,
  { lit, gold }: { lit: string | null; gold: boolean },
): RaceLine[] {
  return group.tables[shown]!.map(({ teamId, rank, played }, index): RaceLine => ({
    teamId,
    stops: raceStops(group, teamId, shown, scale),
    row: scale.y(index + 1),
    look: teamId === lit ? "lit" : gold && rank === 1 && played > 0 ? "gold" : "plain",
  })).sort((x, y) => LAYERS.indexOf(x.look) - LAYERS.indexOf(y.look))
}

/** How much of the way to a step a line is level already, for every match of a team in it but the last. */
const SHOULDER = 0.24

/**
 * How much of the way to a step every line of a race is level already. Where teams play several matches in a step,
 * their dots stand beside each other there, before its end.
 */
export function raceShoulder(group: SteppedGroup): number {
  const most = Math.max(
    ...group.tables.flatMap((rows, step) =>
      rows.map(({ teamId, played }) => {
        const before = group.tables[step - 1]?.find((row) => row.teamId === teamId)
        return played - (before?.played ?? 0)
      }),
    ),
  )
  return Math.min(0.6, Math.max(0, most - 1) * SHOULDER)
}

/** A line through the stops, one unit wide for every step: level at each of them, and a turn on the way. */
export function racePath(stops: RaceStop[], shoulder = 0): string {
  return stops.reduce((path, stop, index) => {
    const before = stops[index - 1]
    if (!before) return `M${stop.step} ${stop.y}`
    if (before.y === stop.y) return `${path}H${stop.step}`
    const end = stop.step - shoulder
    const middle = (before.step + end) / 2
    const turn = `${path}C${middle} ${before.y} ${middle} ${stop.y} ${end} ${stop.y}`
    return shoulder ? `${turn}H${stop.step}` : turn
  }, "")
}

/** The way from where a line ends to the middle of its row, over a strip of the given width. */
export const landingPath = (from: number, to: number, width: number) =>
  from === to ? `M0 ${from}H${width}` : `M0 ${from}C${width / 2} ${from} ${width / 2} ${to} ${width} ${to}`

/** How a team's matches of every step ended, in order: won, lost, or drawn. */
export function stepOutcomes(steps: StandingStep[], entries: CompetitionMatch[], teamId: string): (boolean | null)[][] {
  const byKey = new Map(entries.map((entry) => [entry.match.key, entry]))
  return steps.map(({ matches }) =>
    matches.flatMap((key): (boolean | null)[] => {
      const { match, result } = byKey.get(key) ?? {}
      const { scoreA, scoreB } = result ?? {}
      const side = [result?.teamAId || match?.a.teamId, result?.teamBId || match?.b.teamId].indexOf(teamId)
      if (side < 0 || scoreA == null || scoreB == null) return []
      return [scoreA === scoreB ? null : scoreA > scoreB === (side === 0)]
    }),
  )
}

/** One match of a team on its line; `after` counts the matches it still played in the same step. */
export type RaceDot = { step: number; after: number; y: number; won: boolean | null }

/** A dot on the line for every match of the steps it runs through; the last match of a step stands at its end. */
export const raceDots = (stops: RaceStop[], outcomes: (boolean | null)[][]): RaceDot[] =>
  stops.flatMap(({ step, y }) => {
    const own = outcomes[step] ?? []
    return own.map((won, index): RaceDot => ({ step, after: own.length - 1 - index, y, won }))
  })

/** Every how many steps a mark fits on an axis `width` wide, when one needs `least` pixels. */
export const markEvery = (steps: number, width: number, least: number) =>
  Math.max(1, Math.ceil((least * Math.max(1, steps - 1)) / width))
