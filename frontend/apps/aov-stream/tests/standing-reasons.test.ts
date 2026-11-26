import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionStanding } from "@aov/community-contracts"
import { localeText } from "@aov/ui/lib/locale-text"
import type { PlaceWay, PlaceZone } from "../src/lib/place-zones.ts"
import { borderReasons, reasonWords } from "../src/lib/standing-reasons.ts"
import type { CountedMatch } from "../src/lib/standings-steps.ts"
import { leagueStage } from "./fixtures/league.ts"

const vi = localeText("vi-VN")
const en = localeText("en-US")
const ON: PlaceWay = { kind: "ON" }
const OUT: PlaceWay = { kind: "OUT" }
const final: PlaceWay = {
  kind: "ROUND",
  stage: leagueStage(),
  round: { lane: "upper", left: 0, order: 1, matches: 1 },
}

/** Rows from "team points won–lost games", in the order of the table; a "=" before the points shares the rank above. */
const rows = (...lines: string[]): CompetitionStanding[] => {
  let rank = 0
  return lines.map((line, index) => {
    const [teamId, points, games] = line.split(" ")
    const tied = points!.startsWith("=")
    if (!tied) rank = index + 1
    const [gameWins, gameLosses] = games!.split("–").map(Number)
    return {
      teamId: teamId!,
      rank,
      points: Number(points!.replace("=", "")),
      gameWins,
      gameLosses,
      tied,
    } as CompetitionStanding
  })
}
const zones = (...ends: [number, PlaceWay][]): PlaceZone[] =>
  ends.map(([to, way], index) => ({ from: (ends[index - 1]?.[0] ?? 0) + 1, to, way }))
const table = rows("sgp 15 47–13", "me 7 31–32", "box 7 28–34", "1s 7 27–35", "ts 4 20–44")
const stage = leagueStage({ tieBreakers: ["GAME_DIFF", "GAME_WINS"] })
const name = (teamId: string) => teamId.toUpperCase()
const told = (
  list: CompetitionStanding[],
  where: PlaceZone[],
  over = true,
  rule = stage,
  matches: CountedMatch[] = [],
) =>
  borderReasons(rule, list, where, matches).map((reason) => {
    const { lead, figures, outcome } = reasonWords(reason, name, over, vi, "vi-VN")
    return `${lead}${figures}. ${outcome}`.replaceAll("\u00a0", " ")
  })

test("a border between teams level on points is told by the rule that parted them", () => {
  assert.deepEqual(told(table, zones([3, ON], [5, OUT])), [
    "Ba đội cùng 7 điểm, xếp theo hiệu số ván: ME −1, BOX −6, 1S −8. Hơn 2 ván, BOX đi tiếp còn 1S dừng bước.",
  ])
})

test("where points decide a border there is nothing to tell", () => {
  assert.deepEqual(told(table, zones([1, ON], [5, OUT])), [])
  assert.deepEqual(told(table, zones([4, ON], [5, OUT])), [])
})

test("a border between teams nothing tells apart stays untold", () => {
  const level = rows("a 3 6–2", "b 2 5–3", "c =2 5–3", "d 0 1–6")
  assert.deepEqual(told(level, zones([2, ON], [4, OUT])), [])
})

test("teams that share a rank have no border between them to tell of", () => {
  // Level on points and on rank, whatever a rule would read of their games.
  const level = rows("a 3 6–2", "b 2 5–3", "c =2 4–4", "d 0 1–6")
  assert.deepEqual(told(level, zones([2, ON], [4, OUT])), [])
})

test("a border the rules would draw the other way round stays untold", () => {
  const level = rows("a 3 6–2", "b 2 4–4", "c 2 6–3", "d 0 1–6")
  assert.deepEqual(told(level, zones([2, ON], [4, OUT])), [])
})

test("the next rule speaks among the teams the rules before it left level", () => {
  const level = rows("a 3 9–4", "b 2 8–6", "c 2 7–5", "d 2 5–8")
  assert.deepEqual(told(level, zones([2, ON], [4, OUT])), [
    "Hai đội cùng 2 điểm, cùng hiệu số ván +2, xếp theo số ván thắng: B 8, C 7. Hơn 1 ván thắng, B đi tiếp còn C dừng bước.",
  ])
})

test("head to head is told once the level teams have all met", () => {
  const rule = leagueStage({ tieBreakers: ["HEAD_TO_HEAD", "GAME_DIFF"] })
  const level = rows("a 3 6–2", "b 2 4–4", "c 2 6–3", "d 0 1–6")
  const met = [{ a: "b", b: "c", scoreA: 2, scoreB: 1 }]
  assert.deepEqual(told(level, zones([2, ON], [4, OUT]), true, rule, met), [
    "Hai đội cùng 2 điểm, xếp theo điểm đối đầu: B 1, C 0. Hơn 1 điểm đối đầu, B đi tiếp còn C dừng bước.",
  ])
})

test("without every match between them head to head leaves the word to the next rule", () => {
  const rule = leagueStage({ tieBreakers: ["HEAD_TO_HEAD", "GAME_DIFF"] })
  const level = rows("a 3 6–2", "b 2 6–3", "c 2 4–4", "d 0 1–6")
  assert.deepEqual(told(level, zones([2, ON], [4, OUT]), true, rule), [
    "Hai đội cùng 2 điểm, xếp theo hiệu số ván: B +3, C 0. Hơn 3 ván, B đi tiếp còn C dừng bước.",
  ])
})

test("where one goes on and the other is out, the round the first goes to was decided elsewhere", () => {
  assert.deepEqual(told(rows("a 3 6–2", "b 3 6–4", "c 1 2–6"), zones([1, final], [3, OUT])), [
    "Hai đội cùng 3 điểm, xếp theo hiệu số ván: A +4, B +2. Hơn 2 ván, A đi tiếp còn B dừng bước.",
  ])
})

test("two teams that both go on are told by where each of them goes", () => {
  assert.deepEqual(told(rows("a 3 6–2", "b 3 6–4", "c 1 2–6"), zones([1, final], [2, ON], [3, OUT])), [
    "Hai đội cùng 3 điểm, xếp theo hiệu số ván: A +4, B +2. Hơn 2 ván, A vào chung kết nhánh thắng còn B đi tiếp.",
  ])
})

test("borders through the same teams are told in one breath", () => {
  assert.deepEqual(told(table, zones([2, final], [3, ON], [5, OUT]), false), [
    "Ba đội cùng 7 điểm, xếp theo hiệu số ván: ME −1, BOX −6, 1S −8. ME hơn BOX 5 ván, BOX hơn 1S 2 ván.",
  ])
})

test("before the end nobody has gone on or out", () => {
  assert.deepEqual(told(table, zones([3, ON], [5, OUT]), false), [
    "Ba đội cùng 7 điểm, xếp theo hiệu số ván: ME −1, BOX −6, 1S −8. BOX hơn 1S 2 ván.",
  ])
})

test("a stage without a recorded rule parts level teams by their games", () => {
  assert.deepEqual(told(table, zones([3, ON], [5, OUT]), true, leagueStage({ tieBreakers: [] })).length, 1)
})

test("a name and its figure stay on one line", () => {
  const [reason] = borderReasons(stage, table, zones([3, ON], [5, OUT]), [])
  assert.equal(reasonWords(reason!, name, true, vi, "vi-VN").figures, "ME\u00a0−1, BOX\u00a0−6, 1S\u00a0−8")
})

test("the reason reads in English too", () => {
  const [reason] = borderReasons(stage, table, zones([3, ON], [5, OUT]), [])
  const { lead, outcome } = reasonWords(reason!, name, true, en, "en-US")
  assert.equal(lead, "Three teams level on 7 points, ranked by game difference: ")
  assert.equal(outcome, "2 games ahead, BOX go on and 1S are out.")
})
