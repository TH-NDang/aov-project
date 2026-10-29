import type { SeriesContent } from "@aov/community-contracts"
import { stageInfo, type StagePhase } from "./labels"

export type SeriesRecord = { id: string; content: SeriesContent }
export type SeriesOutcome = "A" | "B" | null

/** A series is decided once one team reaches the majority of its best-of. */
export function seriesWinner(series: SeriesContent): SeriesOutcome {
  const result = series.result
  if (!result) return null
  const needed = Math.floor(series.bestOf / 2) + 1
  if (result.scoreA >= needed || (result.scoreA > result.scoreB && result.scoreA + result.scoreB >= series.bestOf))
    return "A"
  if (result.scoreB >= needed || (result.scoreB > result.scoreA && result.scoreA + result.scoreB >= series.bestOf))
    return "B"
  return null
}

export const seriesTime = (series: SeriesContent) =>
  series.scheduledAt ? new Date(series.scheduledAt).getTime() : Number.POSITIVE_INFINITY

export const bySchedule = (a: SeriesRecord, b: SeriesRecord) =>
  seriesTime(a.content) - seriesTime(b.content) || a.content.code.localeCompare(b.content.code)

export type StandingRow = {
  teamId: string
  rank: number
  played: number
  wins: number
  losses: number
  gameWins: number
  gameLosses: number
  gameDiff: number
  points: number
  form: ("W" | "L")[]
  advanced: boolean
}

/**
 * Provisional round-robin table: one point per series win, then game difference and games won.
 * Head-to-head tie-breakers are not applied, so ties are flagged by sharing the same rank.
 */
export function computeStandings(records: SeriesRecord[]): StandingRow[] {
  const group = records.filter((record) => stageInfo(record.content.stage).phase === "GROUP").sort(bySchedule)
  const playoffTeams = new Set(
    records
      .filter((record) => stageInfo(record.content.stage).phase !== "GROUP")
      .flatMap((record) => [record.content.teamAId, record.content.teamBId]),
  )
  const rows = new Map<string, StandingRow>()
  const row = (teamId: string) => {
    let entry = rows.get(teamId)
    if (!entry) {
      entry = {
        teamId,
        rank: 0,
        played: 0,
        wins: 0,
        losses: 0,
        gameWins: 0,
        gameLosses: 0,
        gameDiff: 0,
        points: 0,
        form: [],
        advanced: playoffTeams.has(teamId),
      }
      rows.set(teamId, entry)
    }
    return entry
  }

  for (const { content } of group) {
    const a = row(content.teamAId)
    const b = row(content.teamBId)
    const winner = seriesWinner(content)
    if (!content.result || !winner) continue
    a.played++
    b.played++
    a.gameWins += content.result.scoreA
    a.gameLosses += content.result.scoreB
    b.gameWins += content.result.scoreB
    b.gameLosses += content.result.scoreA
    const [won, lost] = winner === "A" ? [a, b] : [b, a]
    won.wins++
    won.points++
    lost.losses++
    won.form.push("W")
    lost.form.push("L")
  }

  const sorted = [...rows.values()]
    .map((entry) => ({ ...entry, gameDiff: entry.gameWins - entry.gameLosses, form: entry.form.slice(-5) }))
    .sort((a, b) => b.points - a.points || b.gameDiff - a.gameDiff || b.gameWins - a.gameWins)
  sorted.forEach((entry, index) => {
    const previous = sorted[index - 1]
    entry.rank =
      previous &&
      previous.points === entry.points &&
      previous.gameDiff === entry.gameDiff &&
      previous.gameWins === entry.gameWins
        ? previous.rank
        : index + 1
  })
  return sorted
}

export type BracketSlot = {
  id?: string
  stage: string
  label: string
  teamAId?: string
  teamBId?: string
  scoreA?: number
  scoreB?: number
  bestOf: number
  scheduledAt?: string
  winner: SeriesOutcome
  projected?: boolean
}
export type BracketRound = { key: string; label: string; phase: StagePhase; slots: BracketSlot[] }
export type Bracket = { upper: BracketRound[]; lower: BracketRound[]; final: BracketRound | null }

function toSlot(record: SeriesRecord): BracketSlot {
  const { content } = record
  return {
    id: record.id,
    stage: content.stage ?? "",
    label: stageInfo(content.stage).label,
    teamAId: content.teamAId,
    teamBId: content.teamBId,
    scoreA: content.result?.scoreA,
    scoreB: content.result?.scoreB,
    bestOf: content.bestOf,
    scheduledAt: content.scheduledAt,
    winner: seriesWinner(content),
  }
}

function rounds(records: SeriesRecord[], phase: StagePhase) {
  const grouped = new Map<string, SeriesRecord[]>()
  for (const record of records) {
    const info = stageInfo(record.content.stage)
    if (info.phase !== phase) continue
    grouped.set(info.code, [...(grouped.get(info.code) ?? []), record])
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => stageInfo(a).order - stageInfo(b).order)
    .map(([code, entries]) => ({
      key: code,
      label: stageInfo(code).label,
      phase,
      slots: [...entries].sort(bySchedule).map(toSlot),
    }))
}

/**
 * Double-elimination view built from stage codes. When the grand final has not been recorded yet,
 * it is projected from the upper-bracket final winner so the path stays readable.
 */
export function buildBracket(records: SeriesRecord[]): Bracket {
  const upper = rounds(records, "UPPER")
  const lower = rounds(records, "LOWER")
  let final: BracketRound | null = rounds(records, "FINAL")[0] ?? null
  if (!final && upper.length) {
    const upperFinal = upper.at(-1)?.slots.length === 1 ? upper.at(-1)!.slots[0] : undefined
    const lowerFinal = lower.at(-1)?.slots.length === 1 ? lower.at(-1)!.slots[0] : undefined
    const advance = (slot?: BracketSlot) =>
      slot?.winner === "A" ? slot.teamAId : slot?.winner === "B" ? slot.teamBId : undefined
    if (upperFinal)
      final = {
        key: "GRAND_FINAL",
        label: "Chung kết tổng",
        phase: "FINAL",
        slots: [
          {
            stage: "GRAND_FINAL",
            label: "Chung kết tổng",
            teamAId: advance(upperFinal),
            teamBId: advance(lowerFinal),
            bestOf: upperFinal.bestOf,
            winner: null,
            projected: true,
          },
        ],
      }
  }
  return { upper, lower, final }
}
