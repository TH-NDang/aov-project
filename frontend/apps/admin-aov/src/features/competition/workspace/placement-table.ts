import type { CompetitionStanding } from "@aov/community-contracts"
import { byHour, type MatchResult } from "@aov/community-contracts/bracket-results"
import { hasScore, resolvedIndex } from "./model"
import {
  meetingGroups,
  resultsAmong,
  stagesText,
  unreadable,
  type Phase,
  type PlacementInput,
  type Reading,
} from "./placement-phases"

/** The rows of the phase's tables that hold a team which played there. */
export const rowsOf = ({ standings }: PlacementInput, phase: Phase, teamId: string) =>
  phase.stages.flatMap((stage) =>
    (standings.find((table) => table.stageCode === stage.code)?.rows ?? []).filter(
      (row) => row.teamId === teamId && row.played > 0,
    ),
  )

/**
 * The matches played to tell two level teams apart: meetings beyond those every pair of the group has. Null when some
 * pair never met, so the teams did not play the same season.
 */
function decidersOf(group: string[], results: MatchResult[]): MatchResult[] | null {
  const meetings = new Map<string, MatchResult[]>()
  for (const result of [...results].sort(byHour)) {
    const pair = [result.teamA, result.teamB].sort().join()
    meetings.set(pair, [...(meetings.get(pair) ?? []), result])
  }
  if (meetings.size !== (group.length * (group.length - 1)) / 2) return null

  const legs = Math.min(...[...meetings.values()].map((list) => list.length))
  return [...meetings.values()].flatMap((list) => list.slice(legs))
}

/** Whether those who went on won as often as each other and those who are out lost as often, as in a Swiss stage. */
function sentOnByRecord(group: string[], results: MatchResult[], exits: ReadonlySet<string>) {
  const wins = group.filter((id) => !exits.has(id)).map((id) => results.filter(({ winner }) => winner === id).length)
  const losses = group.filter((id) => exits.has(id)).map((id) => results.filter(({ loser }) => loser === id).length)
  return new Set(wins).size === 1 && new Set(losses).size === 1
}

/**
 * The teams of a group from the first place down, those the table leaves level together. One table is read as the
 * backend ranks it. The tables of several legs are added up and told apart by the rules of the last leg, as far as
 * sums can apply them, and a match between two level teams tells those two apart. Null when such a match was played
 * between teams that are not level, so it was something else.
 */
function tableLevels(input: PlacementInput, phase: Phase, group: string[], deciders: MatchResult[]) {
  const rows = new Map(group.map((id) => [id, rowsOf(input, phase, id)]))
  const sum = (id: string, value: (row: CompetitionStanding) => number) =>
    rows.get(id)!.reduce((total, row) => total + value(row), 0)
  const gameDiff = (id: string) => sum(id, (row) => row.gameWins - row.gameLosses)
  // Level teams share a place; among themselves the one with the better games is listed first.
  const listed = group.filter((id) => rows.get(id)!.length).sort((x, y) => gameDiff(y) - gameDiff(x))
  const split = (levels: string[][], value: (id: string) => number) =>
    levels.flatMap((level) =>
      [...new Set(level.map(value))].sort((x, y) => y - x).map((own) => level.filter((id) => value(id) === own)),
    )
  if (!deciders.length && listed.every((id) => rows.get(id)!.length === 1))
    return split([listed], (id) => -rows.get(id)![0]!.rank)

  const { winPoints, lossPoints, tieBreakers } = phase.stages.at(-1)!
  const decided = (id: string) =>
    deciders.filter(({ winner }) => winner === id).length * winPoints +
    deciders.filter(({ loser }) => loser === id).length * lossPoints
  let levels = split([listed], (id) => sum(id, (row) => row.points) - decided(id))
  for (const { winner, loser } of deciders) {
    const at = levels.findIndex((level) => level.includes(winner ?? ""))
    if (!levels[at]?.includes(loser!)) return null
    if (levels[at].length === 2) levels.splice(at, 1, [winner!], [loser!])
  }
  // The sums of the games hold those of the deciders, so they tell nobody else apart.
  for (const rule of deciders.length ? [] : tieBreakers) {
    if (rule === "GAME_DIFF") levels = split(levels, gameDiff)
    else if (rule === "GAME_WINS") levels = split(levels, (id) => sum(id, (row) => row.gameWins))
    else break
  }
  return levels
}

/** A plan has no points for a draw, so an order counts only when it holds with a draw worth nothing or half a win. */
function drawsDecide(input: PlacementInput, phase: Phase, group: string[], exits: ReadonlySet<string>) {
  const { winPoints, lossPoints } = phase.stages[0]!
  const points = (id: string, draw: number) =>
    rowsOf(input, phase, id).reduce((sum, row) => sum + row.points + (row.played - row.won - row.lost) * draw, 0)
  const order = (x: string, y: string, draw: number) => Math.sign(points(x, draw) - points(y, draw))
  const half = (winPoints - lossPoints) / 2
  return group.some((x) => exits.has(x) && group.some((y) => order(x, y, 0) !== order(x, y, half)))
}

/** Where a team that is out stands in its group, such as fifth, or fifth or sixth where it is level with another. */
type Position = { teamId: string; from: number; to: number; reason: string }

/**
 * Where the teams that leave in a table stand: by their rank in it, shared where the table leaves them level and
 * across groups. Nothing is read where the results do not tell the order.
 */
export function readTable(
  input: PlacementInput,
  phase: Phase,
  exits: ReadonlySet<string>,
  /** How many teams only appear later; each may be the other record of a team that seems to leave here. */
  newcomers: number,
  last: boolean,
): Reading {
  const stages = stagesText(phase.stages)
  const rows = resolvedIndex(input.resolved)
  const scored = ({ match }: MatchResult) => hasScore(rows.get(match.key))
  // Once it is over, a team none of whose matches has a score withdrew; the others are told apart without it.
  const silent = new Set(
    [...phase.teams].filter((id) => input.finished && !resultsAmong([id], phase.results).some(scored)),
  )
  const results = phase.results.filter(({ teamA, teamB }) => !silent.has(teamA ?? "") && !silent.has(teamB ?? ""))
  const missing = results.filter((result) => !scored(result)).length
  if (missing) return unreadable(exits, `${stages} còn ${missing} trận chưa có tỷ số`)

  const open = new Map<string, string>()
  for (const id of silent) if (exits.has(id)) open.set(id, `Không trận nào ở ${stages} có tỷ số`)
  const all = meetingGroups(results)
  if (last && all.length > 1 && input.competitionType !== "QUALIFIER")
    return unreadable(exits, `${stages} chia ${all.length} bảng, chưa có trận quyết định nhà vô địch`)

  // A group nobody goes on from while others send teams on is not one of their kind.
  const ending = (group: string[]) => group.every((id) => exits.has(id))
  const groups = last || all.every(ending) ? all : all.filter((group) => !ending(group))
  for (const group of all)
    if (!groups.includes(group)) for (const id of group) open.set(id, `Không đội nào cùng bảng ở ${stages} đi tiếp`)
  const positions: Position[] = []
  const spans: { from: number; to: number }[] = []
  const above: string[] = []
  const level = new Set<string>()
  for (const group of groups) {
    const own = resultsAmong(group, results)
    const deciders = decidersOf(group, own)
    if (own.some(({ winner }) => !winner) && drawsDecide(input, phase, group, exits))
      return unreadable(exits, `${stages} có trận hòa mà giai đoạn chưa có điểm cho trận hòa`)

    const levels =
      deciders || sentOnByRecord(group, own, exits) ? tableLevels(input, phase, group, deciders ?? []) : null
    if (!levels) return unreadable(exits, `Các đội ở ${stages} không gặp nhau số lần như nhau`)

    const ownStages = phase.stages.filter((stage) => own.some(({ match }) => match.stageCode === stage.code))
    const oneOfSeveral = groups.length > 1 && ownStages.length === phase.stages.length
    const where = `${oneOfSeveral ? "một bảng ở" : "ở"} ${stagesText(ownStages)}`
    for (const id of group)
      if (exits.has(id) && !levels.flat().includes(id)) open.set(id, `Không có trong bảng xếp hạng của ${stages}`)
    levels.forEach((teams, at) => {
      const out = teams.filter((id) => exits.has(id))
      if (!out.length) return
      if (levels.slice(at + 1).some((below) => below.some((id) => !exits.has(id)))) {
        above.push(...out)
        return
      }
      // Teams that went on hold the better positions of a level they share.
      const to = levels.slice(0, at + 1).flat().length
      const span = { from: to - out.length + 1, to }
      spans.push(span)
      const reason = `${out.length > 1 ? "Đồng hạng" : "Hạng"} ${span.from} ${where}`
      for (const teamId of out) positions.push({ teamId, ...span, reason })
      if (out.length > 1 && deciders)
        for (const stage of ownStages) if (!stage.tieBreakers.length) level.add(stage.code)
    })
  }

  if (above.length > newcomers) {
    const names = above.map((id) => input.teams[id]?.name ?? "").join(", ")
    return unreadable(exits, `${stages} không khớp với các đội đi tiếp: ${names} xếp trên mà không đá tiếp`)
  }
  for (const id of above) open.set(id, `Xếp trên một đội đi tiếp ở ${stages} mà không đá tiếp`)

  // Every group takes a slot at each position it has, so the thirds of two groups share two slots.
  const slotsBefore = (position: number) =>
    spans.reduce((sum, { from, to }) => sum + Math.max(0, Math.min(to, position - 1) - from + 1), 0)
  return {
    slots: positions.map(({ teamId, from, to, reason }) => ({
      teamId,
      from: slotsBefore(from) + 1,
      to: slotsBefore(to + 1),
      reason,
    })),
    open,
    level: phase.stages.filter((stage) => level.has(stage.code)),
  }
}
