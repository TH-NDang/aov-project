import type { CompetitionStage, CompetitionStanding, CompetitionView } from "@aov/community-contracts"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { competitionMatches, planZone, type CompetitionMatch } from "./match-model.ts"
import { standingGroups } from "./standings-model.ts"

type Table = CompetitionView["content"]["standings"][number]

/** What a step of a table counts: the rounds or weeks the plan names, or the days matches were played on. */
export type StepKind = "ROUND" | "WEEK" | "MATCHDAY" | "DAY"
export type StandingStep = {
  /** What the address calls the step: the number of a round or a week, or a day as yyyy-mm-dd. */
  key: string
  kind: StepKind
  number: number
  /** The days of its matches, yyyy-mm-dd where the event is held, the first one first. */
  days: string[]
  /** The keys of its matches, the first played coming first. */
  matches: string[]
  /** Whether some of its matches have no result. */
  open: boolean
}
/** One group of a stage: who plays in it, and its table after every step, each in order. */
export type SteppedGroup = { name: string | null; tables: CompetitionStanding[][] }
export type SteppedTable = { steps: StandingStep[]; groups: SteppedGroup[] }

const LABELS: [RegExp, StepKind][] = [
  [/^(?:vòng|round) (\d+)$/i, "ROUND"],
  [/^(?:(?:match ?)?week|tuần) (\d+)$/i, "WEEK"],
  [/^(?:match ?day|day|ngày(?: thi đấu)?) (\d+)$/i, "MATCHDAY"],
]

/** The round, week or match day a label names among its parts ("Round 12 · FPL vs SGP"). */
export function labelStep(label: string | null | undefined): { kind: StepKind; number: number } | null {
  for (const part of (label ?? "").split("·").map((item) => item.trim()))
    for (const [pattern, kind] of LABELS) {
      const match = pattern.exec(part)
      if (match) return { kind, number: Number(match[1]) }
    }
  return null
}

/** A match between two known teams, with its score. */
export type CountedMatch = { a: string; b: string; scoreA: number; scoreB: number }

/** The matches a table counts, also those that ended in a draw. */
export function countedMatches(entries: CompetitionMatch[]): CountedMatch[] {
  return entries.flatMap(({ match, result }): CountedMatch[] => {
    const a = result?.teamAId || match.a.teamId
    const b = result?.teamBId || match.b.teamId
    const { scoreA, scoreB, consistent } = result ?? {}
    return a && b && consistent !== false && scoreA != null && scoreB != null ? [{ a, b, scoreA, scoreB }] : []
  })
}

/** Splits every group of level teams by a figure, the greatest first; teams it leaves level keep their order. */
const split = (groups: string[][], figure: (team: string) => number) =>
  groups.flatMap((group) => {
    const values = [...new Set(group.map(figure))].sort((x, y) => y - x)
    return values.map((value) => group.filter((team) => figure(team) === value))
  })

/**
 * The rules that tell level teams of a stage apart, the first one first. A stage that records none tells them apart by
 * their games, as its final table does.
 */
export const rankingRules = ({ tieBreakers }: Pick<CompetitionStage, "tieBreakers">): string[] =>
  tieBreakers.length ? tieBreakers : ["GAME_DIFF", "GAME_WINS"]

const pointsFor = (stage: CompetitionStage, own: number, rival: number) =>
  own > rival ? stage.winPoints : stage.lossPoints

/**
 * The points level teams took from each other, or null until every match between them has been played: before that the
 * service leaves them level too.
 */
export function headToHead(stage: CompetitionStage, teams: string[], matches: CountedMatch[]) {
  const between = matches.filter(({ a, b }) => teams.includes(a) && teams.includes(b))
  if (between.length !== ((teams.length * (teams.length - 1)) / 2) * stage.legs) return null
  const points = new Map(teams.map((team) => [team, 0]))
  for (const { a, b, scoreA, scoreB } of between) {
    points.set(a, points.get(a)! + pointsFor(stage, scoreA, scoreB))
    points.set(b, points.get(b)! + pointsFor(stage, scoreB, scoreA))
  }
  return points
}

/** The table of a stage after some of its matches, ranked the way the service ranks it: by points, then by rules. */
export function tableAfter(stage: CompetitionStage, teams: string[], matches: CountedMatch[]): CompetitionStanding[] {
  const figures = new Map(
    teams.map((team) => [team, { played: 0, won: 0, lost: 0, gameWins: 0, gameLosses: 0, points: 0 }]),
  )
  const counted = matches.filter(({ a, b }) => figures.has(a) && figures.has(b))
  for (const { a, b, scoreA, scoreB } of counted)
    for (const [team, own, rival] of [
      [a, scoreA, scoreB],
      [b, scoreB, scoreA],
    ] as const) {
      const row = figures.get(team)!
      row.played += 1
      row.gameWins += own
      row.gameLosses += rival
      if (own > rival) row.won += 1
      if (own < rival) row.lost += 1
      row.points += pointsFor(stage, own, rival)
    }
  const of = (team: string) => figures.get(team)!
  let groups = split([teams], (team) => of(team).points)
  for (const rule of rankingRules(stage)) {
    if (rule === "GAME_DIFF") groups = split(groups, (team) => of(team).gameWins - of(team).gameLosses)
    if (rule === "GAME_WINS") groups = split(groups, (team) => of(team).gameWins)
    if (rule === "HEAD_TO_HEAD")
      groups = groups.flatMap((group) => {
        const points = headToHead(stage, group, counted)
        return points ? split([group], (team) => points.get(team)!) : [group]
      })
  }
  const rows: CompetitionStanding[] = []
  for (const group of groups) {
    const rank = rows.length + 1
    for (const teamId of group) rows.push({ rank, teamId, ...of(teamId), tied: group.length > 1, qualified: false })
  }
  return rows
}

const startOf = ({ match }: CompetitionMatch) => Date.parse(match.scheduledAt || "") || Infinity

/** The steps of a stage with the match of each, the earliest first. Rounds come from labels, the plan, or the days. */
function stepsOf(view: CompetitionView, entries: CompetitionMatch[]) {
  const { plan } = view.content
  const zone = planZone(plan)
  const dayOf = (entry: CompetitionMatch) => {
    const at = startOf(entry)
    return at === Infinity ? null : dayKeyInZone(at, zone)
  }
  const labels = entries.map((entry) => labelStep(entry.match.label))
  const named = labels.every((step) => step && step.kind === labels[0]!.kind)
  const rounds = entries.map((entry) => entry.match.round)
  const numbers = named ? labels.map((step) => step!.number) : rounds
  const days = entries.map(dayOf)
  let of: (index: number) => Pick<StandingStep, "key" | "kind" | "number"> | null
  if (new Set(numbers).size > 1)
    of = (index) => ({ key: String(numbers[index]), kind: named ? labels[0]!.kind : "ROUND", number: numbers[index]! })
  else if (new Set(days.filter(Boolean)).size > 1)
    of = (index) => (days[index] ? { key: days[index], kind: "DAY", number: 0 } : null)
  else return []

  const steps = new Map<string, Pick<StandingStep, "key" | "kind" | "number"> & { entries: CompetitionMatch[] }>()
  entries.forEach((entry, index) => {
    const step = of(index)
    if (!step) return
    const known = steps.get(step.key) ?? { ...step, entries: [] }
    known.entries.push(entry)
    steps.set(step.key, known)
  })
  return [...steps.values()]
    .map((step) => ({ ...step, days: [...new Set(step.entries.flatMap((entry) => dayOf(entry) ?? []))].sort() }))
    .sort((x, y) => x.number - y.number || (x.days[0] ?? "").localeCompare(y.days[0] ?? ""))
}

const sameFigures = (x: CompetitionStanding, y: CompetitionStanding) =>
  x.teamId === y.teamId &&
  x.played === y.played &&
  x.won === y.won &&
  x.gameWins === y.gameWins &&
  x.gameLosses === y.gameLosses &&
  x.points === y.points

/**
 * A stage's table after every step of it, or null where there is nothing to step through. The last step is the
 * published table; when working it out again gives another one, the steps before it cannot be trusted either and the
 * stage shows its table alone.
 */
export function steppedTable(view: CompetitionView, table: Table): SteppedTable | null {
  const { plan } = view.content
  const stage = plan.stages.find((item) => item.code === table.stageCode)
  if (!stage) return null
  const entries = competitionMatches([view]).filter((entry) => entry.match.stageCode === stage.code)
  const started = stepsOf(view, entries).filter((step) => countedMatches(step.entries).length > 0)
  if (started.length < 2) return null
  const entrants = plan.entrants.map((entrant) => entrant.teamId)
  const own = stage.teamIds?.length ? entrants.filter((team) => stage.teamIds!.includes(team)) : entrants
  const groups = standingGroups(view, table).map(({ name, rows }): SteppedGroup & { agrees: boolean } => {
    const members = new Set(rows.map((row) => row.teamId))
    const teams = own.filter((team) => members.has(team))
    const tables = started.map((_, index) =>
      tableAfter(stage, teams, countedMatches(started.slice(0, index + 1).flatMap((step) => step.entries))),
    )
    const last = tables.at(-1)!
    const agrees = last.length === rows.length && last.every((row, index) => sameFigures(row, rows[index]!))
    return { name, tables: [...tables.slice(0, -1), rows], agrees }
  })
  if (!groups.every(({ agrees }) => agrees)) return null
  return {
    steps: started.map(({ key, kind, number, days, entries: list }) => ({
      key,
      kind,
      number,
      days,
      matches: [...list].sort((x, y) => startOf(x) - startOf(y)).map((entry) => entry.match.key),
      open: countedMatches(list).length < list.length,
    })),
    groups: groups.map(({ name, tables }) => ({ name, tables })),
  }
}

/** The places a team holds in a table, counted from 1: one, or several while other teams are level with it. */
export function sharedPlaces(rows: CompetitionStanding[], teamId: string): [from: number, to: number] | null {
  const at = rows.findIndex((row) => row.teamId === teamId)
  if (at < 0) return null
  const { rank } = rows[at]!
  const level = rows.filter((row) => row.rank === rank).length
  return rows[at]!.tied ? [rank, rank + level - 1] : [at + 1, at + 1]
}

/**
 * How many places a team went up since the step before. Teams level with each other hold their places together, so a
 * team has moved only once it left the places it shared.
 */
export function movement(group: SteppedGroup, step: number, teamId: string): number {
  const before = step > 0 ? sharedPlaces(group.tables[step - 1]!, teamId) : null
  const now = sharedPlaces(group.tables[step]!, teamId)
  if (!before || !now) return 0
  if (now[1] < before[0]) return before[0] - now[1]
  return now[0] > before[1] ? before[1] - now[0] : 0
}

/**
 * What the address calls a step. The stage a page shows first needs no name; any other puts its code before the step,
 * because the rounds of two stages have the same numbers.
 */
export const stepAddress = (step: Pick<StandingStep, "key">, stageCode: string, first: boolean) =>
  first ? step.key : `${stageCode}.${step.key}`

/** Which of a stage's steps an address names; null while it names none of them. */
export function stepAt(steps: StandingStep[], stageCode: string, first: boolean, address: string | null) {
  const own = `${stageCode}.`
  const key = address?.startsWith(own) ? address.slice(own.length) : first ? address : null
  const index = steps.findIndex((step) => step.key === key)
  return index < 0 ? null : index
}
