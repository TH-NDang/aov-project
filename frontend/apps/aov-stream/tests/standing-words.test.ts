import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionStage } from "@aov/community-contracts"
import { localeText } from "@aov/ui/lib/locale-text"
import type { BracketRound } from "../src/lib/bracket-model.ts"
import type { PlaceWay, PlaceZone } from "../src/lib/place-zones.ts"
import {
  groupWords,
  movementWords,
  placeFigure,
  placesWords,
  roundUnderStep,
  signed,
  stepDays,
  stepMark,
  stepMatchesWords,
  stepWords,
  wayPredicate,
  wayWords,
  zoneWords,
} from "../src/lib/standing-words.ts"

const vi = localeText("vi-VN")
const en = localeText("en-US")
const stage = (name: string) => ({ code: name, name }) as CompetitionStage
const round = (lane: BracketRound["lane"], left: number, matches: number, name = "Playoffs"): PlaceWay => ({
  kind: "ROUND",
  stage: stage(name),
  round: { lane, left, matches, order: 1 },
})
const words = (way: PlaceWay, final = true) => wayWords(way, final, vi, "vi-VN")

test("a place that is won says where its team goes", () => {
  assert.equal(words(round("upper", 1, 2)), "Vào bán kết nhánh thắng")
  assert.equal(words({ kind: "STAGE", stage: stage("Vòng bảng 2") }), "Vào vòng bảng 2")
  assert.equal(words({ kind: "STAGE", stage: stage("Playoffs") }), "Vào Playoffs")
  assert.equal(words({ kind: "ON" }), "Đi tiếp")
  assert.equal(words({ kind: "OUT" }), "Dừng bước")
})

test("while the table can still change the words name the group of places", () => {
  assert.equal(words(round("upper", 1, 2), false), "Nhóm vào bán kết nhánh thắng")
  assert.equal(words({ kind: "ON" }, false), "Nhóm đi tiếp")
  assert.equal(words({ kind: "OUT" }, false), "Nhóm dừng bước")
})

test("a round with a number for a name is told by its stage", () => {
  assert.equal(words(round("rounds", 3, 1)), "Vào vòng 1 Playoffs")
  assert.equal(words(round("rounds", 0, 1)), "Vào chung kết")
  assert.equal(words(round("lower", 2, 2)), "Vào vòng 1 nhánh thua")
})

test("rounds two brackets share are told apart by their stages", () => {
  const zones: PlaceZone[] = [
    { from: 1, to: 2, way: round("upper", 1, 2, "Playoffs") },
    { from: 3, to: 6, way: round("upper", 1, 2, "Wildcard") },
    { from: 7, to: 8, way: { kind: "OUT" } },
  ]
  assert.deepEqual(zoneWords(zones, true, vi, "vi-VN"), [
    "Vào bán kết nhánh thắng Playoffs",
    "Vào bán kết nhánh thắng Wildcard",
    "Dừng bước",
  ])
})

test("what becomes of a team follows its name in a sentence", () => {
  assert.equal(wayPredicate(round("upper", 0, 1), vi, "vi-VN"), "vào chung kết nhánh thắng")
  assert.equal(wayPredicate({ kind: "ON" }, vi, "vi-VN"), "đi tiếp")
  assert.equal(wayPredicate({ kind: "OUT" }, en, "en-US"), "are out")
})

test("the places of a zone are a range, or one", () => {
  assert.equal(placesWords({ from: 1, to: 4 }, vi), "hạng 1–4")
  assert.equal(placesWords({ from: 7, to: 7 }, vi), "hạng 7")
})

const step = (kind: "ROUND" | "WEEK" | "MATCHDAY" | "DAY", number = 12, key = "2026-09-20") => ({ kind, number, key })

test("a step is named by what the plan counts", () => {
  assert.equal(stepWords(step("ROUND"), false, vi, "vi-VN"), "Sau vòng 12")
  assert.equal(stepWords(step("WEEK", 3), false, vi, "vi-VN"), "Sau tuần 3")
  assert.equal(stepWords(step("MATCHDAY", 2), false, vi, "vi-VN"), "Hết ngày thi đấu 2")
  assert.equal(stepWords(step("DAY"), false, vi, "vi-VN"), "Hết ngày 20/09")
  assert.equal(stepWords(step("ROUND"), false, en, "en-US"), "After round 12")
})

test("a step that is being played is not over", () => {
  assert.equal(stepWords(step("ROUND"), true, vi, "vi-VN"), "Đang đấu vòng 12")
})

test("the matches of a step stand under its name", () => {
  assert.equal(stepMatchesWords(step("ROUND"), vi, "vi-VN"), "Các trận vòng 12")
  assert.equal(stepMatchesWords(step("DAY"), vi, "vi-VN"), "Các trận ngày 20/09")
})

test("a match under the heading of its step leaves out what the headings say", () => {
  const under = (round: string | null, of: ReturnType<typeof step>, stage = "Vòng bảng") =>
    roundUnderStep(round, of, stage, vi, "vi-VN")
  assert.equal(under("Vòng 12", step("ROUND")), null)
  assert.equal(under("Tuần 3", step("WEEK", 3)), null)
  assert.equal(under("Bảng A", step("DAY"), "Bảng A"), null)
  assert.equal(roundUnderStep("Round 12", step("ROUND"), "Group stage", en, "en-US"), null)
})

test("what the headings do not say of a match stays on its row", () => {
  const under = (round: string | null, of: ReturnType<typeof step>) =>
    roundUnderStep(round, of, "Vòng bảng", vi, "vi-VN")
  assert.equal(under("Vòng 12, trận 2", step("ROUND")), "Trận 2")
  assert.equal(under("Vòng 11", step("ROUND")), "Vòng 11")
  assert.equal(under("Bảng A", step("DAY")), "Bảng A")
  assert.equal(under(null, step("ROUND")), null)
})

test("the days of a step are named, or the first and the last of many", () => {
  assert.equal(stepDays({ kind: "ROUND", days: ["2026-10-04"] }, "vi-VN"), "04/10")
  assert.equal(stepDays({ kind: "ROUND", days: ["2026-10-03", "2026-10-04"] }, "vi-VN"), "03/10, 04/10")
  assert.equal(stepDays({ kind: "WEEK", days: ["2026-10-08", "2026-10-09", "2026-10-11"] }, "vi-VN"), "08/10 – 11/10")
  assert.equal(stepDays({ kind: "ROUND", days: [] }, "vi-VN"), "")
})

test("a step that is a day needs no other name for it", () => {
  assert.equal(stepDays({ kind: "DAY", days: ["2026-09-20"] }, "vi-VN"), "")
})

test("on an axis a step is its number or its date", () => {
  assert.equal(stepMark(step("ROUND"), "vi-VN"), "12")
  assert.equal(stepMark(step("DAY"), "vi-VN"), "20/09")
})

test("a move is told in places, and staying says nothing", () => {
  assert.equal(movementWords(2, vi), "lên 2 hạng")
  assert.equal(movementWords(-1, vi), "xuống 1 hạng")
  assert.equal(movementWords(0, vi), "")
  assert.equal(movementWords(1, en), "up 1 place")
})

test("a team that has not played has no place yet", () => {
  assert.equal(placeFigure({ rank: 2, played: 0 }), "–")
  assert.equal(placeFigure({ rank: 2, played: 1 }), "2")
})

test("a difference carries its sign", () => {
  assert.deepEqual([3, 0, -8].map(signed), ["+3", "0", "−8"])
})

test("a group goes by its letter, or by its number", () => {
  assert.equal(groupWords("A", vi), "Bảng A")
  assert.equal(groupWords("2", vi), "Nhóm 2")
})
