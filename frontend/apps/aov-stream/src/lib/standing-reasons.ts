import type { CompetitionStage, CompetitionStanding } from "@aov/community-contracts"
import type { PlaceWay, PlaceZone } from "./place-zones.ts"
import { signed, wayPredicate } from "./standing-words.ts"
import { headToHead, rankingRules, type CountedMatch } from "./standings-steps.ts"

type Say = (vi: string, en: string) => string

export type RankingRule = "HEAD_TO_HEAD" | "GAME_DIFF" | "GAME_WINS"
/** A border between two zones: the last team above it, the first one below, and what the one had over the other. */
export type ZoneBorder = { above: string; below: string; margin: number; ways: [above: PlaceWay, below: PlaceWay] }
/** Why borders between zones fell where they fell, when the points of the teams on either side do not say it. */
export type BorderReason = {
  points: number
  /** The rules that left the teams level, with the figure they share. */
  level: { rule: RankingRule; figure: number }[]
  /** The rule that told them apart, and the level teams in the order of the table with the figure it read. */
  rule: RankingRule
  teams: { teamId: string; figure: number }[]
  borders: ZoneBorder[]
}

/** What a rule reads for each of some level teams; null where it cannot be applied to them yet. */
function figuresOf(rule: string, stage: CompetitionStage, rows: CompetitionStanding[], matches: CountedMatch[]) {
  const figures = (of: (row: CompetitionStanding) => number) => new Map(rows.map((row) => [row.teamId, of(row)]))
  if (rule === "GAME_DIFF") return figures((row) => row.gameWins - row.gameLosses)
  if (rule === "GAME_WINS") return figures((row) => row.gameWins)
  if (rule !== "HEAD_TO_HEAD") return null
  return headToHead(
    stage,
    rows.map((row) => row.teamId),
    matches,
  )
}

/** The first rule that tells two level teams apart, read for every team level with them, and by how much it does. */
function separated(
  stage: CompetitionStage,
  rows: CompetitionStanding[],
  above: CompetitionStanding,
  below: CompetitionStanding,
  matches: CountedMatch[],
) {
  const level: BorderReason["level"] = []
  let group = rows.filter((row) => row.points === above.points)
  for (const rule of rankingRules(stage) as RankingRule[]) {
    const figures = figuresOf(rule, stage, group, matches)
    if (!figures) continue
    const own = figures.get(above.teamId)!
    const margin = own - figures.get(below.teamId)!
    const teams = group.map(({ teamId }) => ({ teamId, figure: figures.get(teamId)! }))
    if (margin) return margin > 0 ? { level, rule, teams, margin } : null
    level.push({ rule, figure: own })
    group = group.filter((row) => figures.get(row.teamId) === own)
  }
  return null
}

/**
 * Why the borders between the zones of a table fell where they fell: one reason for every group of teams level on
 * points that a border runs through. Silent where points alone decide, and where nothing tells the teams apart.
 */
export function borderReasons(
  stage: CompetitionStage,
  rows: CompetitionStanding[],
  zones: PlaceZone[],
  matches: CountedMatch[],
): BorderReason[] {
  const reasons: BorderReason[] = []
  zones.forEach((zone, index) => {
    const [above, below] = [rows[zone.from - 2], rows[zone.from - 1]]
    if (index === 0 || !above || !below || above.points !== below.points || above.rank === below.rank) return
    const found = separated(stage, rows, above, below, matches)
    if (!found) return
    const { margin, ...reason } = found
    const border: ZoneBorder = {
      above: above.teamId,
      below: below.teamId,
      margin,
      ways: [zones[index - 1]!.way, zone.way],
    }
    const known = reasons.find(
      ({ rule, teams }) =>
        rule === found.rule && [above, below].every((row) => teams.some(({ teamId }) => teamId === row.teamId)),
    )
    if (known) known.borders.push(border)
    else reasons.push({ points: above.points, ...reason, borders: [border] })
  })
  return reasons
}

const COUNTS = ["Hai", "Ba", "Bốn", "Năm", "Sáu", "Bảy", "Tám", "Chín", "Mười"]
const ENGLISH_COUNTS = ["Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]

const RULES: Record<RankingRule, readonly [vi: string, en: string]> = {
  HEAD_TO_HEAD: ["điểm đối đầu", "head-to-head points"],
  GAME_DIFF: ["hiệu số ván", "game difference"],
  GAME_WINS: ["số ván thắng", "games won"],
}
/** What a margin counts under each rule. */
const MARGINS: Record<RankingRule, readonly [vi: string, one: string, more: string]> = {
  HEAD_TO_HEAD: ["điểm đối đầu", "head-to-head point", "head-to-head points"],
  GAME_DIFF: ["ván", "game", "games"],
  GAME_WINS: ["ván thắng", "game won", "games won"],
}

/** A figure of a rule as a table writes it. */
const figureWords = (rule: RankingRule, figure: number) => (rule === "GAME_DIFF" ? signed(figure) : String(figure))

/** A reason in three parts: what the teams share, the figures that tell them apart, and what that led to. */
export type ReasonWords = { lead: string; figures: string; outcome: string }

/**
 * A reason in words: "Three teams level on 7 points, ranked by game difference: ME −1, BOX −6, 1S −8. 2 games ahead,
 * BOX go on and 1S are out." While the table can still change it only tells who stands above whom, and by how much.
 */
export function reasonWords(
  { points, level, rule, teams, borders }: BorderReason,
  nameOf: (teamId: string) => string,
  final: boolean,
  text: Say,
  languageTag: string,
): ReasonWords {
  const count = text(
    `${COUNTS[teams.length - 2] ?? teams.length} đội`,
    `${ENGLISH_COUNTS[teams.length - 2] ?? teams.length} teams`,
  )
  const shared = level
    .map(({ rule: before, figure }) => [RULES[before], figureWords(before, figure)] as const)
    .map(([[vi, en], figure]) => text(`, cùng ${vi} ${figure}`, ` with ${en} ${figure}`))
    .join("")
  const lead = text(
    `${count} cùng ${points} điểm${shared}, xếp theo ${RULES[rule][0]}: `,
    `${count} level on ${points} ${points === 1 ? "point" : "points"}${shared}, ranked by ${RULES[rule][1]}: `,
  )
  // A name and its figure stay on one line.
  const figures = teams.map(({ teamId, figure }) => `${nameOf(teamId)}\u00a0${figureWords(rule, figure)}`).join(", ")
  const by = (margin: number) =>
    text(`${margin} ${MARGINS[rule][0]}`, `${margin} ${MARGINS[rule][margin === 1 ? 1 : 2]}`)
  if (!final) {
    const ahead = borders.map(({ above, below, margin }) =>
      text(
        `${nameOf(above)} hơn ${nameOf(below)} ${by(margin)}`,
        `${nameOf(above)} are ${by(margin)} ahead of ${nameOf(below)}`,
      ),
    )
    return { lead, figures, outcome: `${ahead.join(", ")}.` }
  }
  const outcomes = borders.map(({ above, below, margin, ways }) => {
    // Where one goes on and the other is out, the border did not decide which round the first goes to.
    const up: PlaceWay = ways[1].kind === "OUT" ? { kind: "ON" } : ways[0]
    const [first, second] = [wayPredicate(up, text, languageTag), wayPredicate(ways[1], text, languageTag)]
    return text(
      `Hơn ${by(margin)}, ${nameOf(above)} ${first} còn ${nameOf(below)} ${second}.`,
      `${by(margin)} ahead, ${nameOf(above)} ${first} and ${nameOf(below)} ${second}.`,
    )
  })
  return { lead, figures, outcome: outcomes.join(" ") }
}
