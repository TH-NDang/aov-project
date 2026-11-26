import assert from "node:assert/strict"
import { test } from "node:test"
import type { StagePatch } from "@aov/community-contracts"
import { gamesText, ofMatches, periodName, recordText, shownText } from "../src/lib/feed-words.ts"
import { stage } from "./fixtures/competition.ts"

const say = (vi: string) => vi
const english = (_: string, en: string) => en
const named = (patch: Partial<StagePatch> | null, name = "Vòng bảng") =>
  periodName({ stage: stage("RR", { name }) as never, patch: patch as StagePatch | null }, say, "vi-VN")

test("a stage is called by its name", () => {
  assert.equal(named(null), "Vòng bảng")
})

test("a stage is called without the English word an import left at its end", () => {
  assert.equal(named(null, "Vòng Thụy Sĩ Stage"), "Vòng Thụy Sĩ")
})

test("the games under a patch are called by the weeks it was played in", () => {
  assert.equal(named({ label: "Tuần 2-4", name: "Bản 11" }), "Tuần 2–4")
  assert.equal(named({ label: "Tuần 1" }), "Tuần 1")
})

test("a patch without weeks is called by its label, its name or its day, in that order", () => {
  assert.equal(named({ label: "Sau nghỉ", name: "Bản 11", releasedOn: "2026-08-20" }), "Sau nghỉ")
  assert.equal(named({ name: "Bản 11", releasedOn: "2026-08-20" }), "Bản 11")
  assert.equal(named({ releasedOn: "2026-08-20" }), "Bản 20/08/2026")
})

test("a patch nothing is known of goes by its stage", () => {
  assert.equal(named({}), "Vòng bảng")
})

test("games are counted in words, and in English one of them is a game", () => {
  assert.deepEqual([gamesText(1, say, "vi-VN"), gamesText(2007, say, "vi-VN")], ["1 ván", "2.007 ván"])
  assert.deepEqual([gamesText(1, english, "en-US"), gamesText(2007, english, "en-US")], ["1 game", "2,007 games"])
})

test("in English the one match a number is out of is a match", () => {
  assert.equal(ofMatches(1, 1, english), "1 of 1 match")
  assert.equal(ofMatches(1, 19, english), "1 of 19 matches")
  assert.equal(ofMatches(17, 19, say), "17 trong 19 trận")
})

test("in English the one game a record lost is a game", () => {
  assert.equal(recordText({ wins: 6, losses: 1 }, english), "won 6, lost 1 game")
  assert.equal(recordText({ wins: 1, losses: 0 }, english), "won 1, lost 0 games")
  assert.equal(recordText({ wins: 6, losses: 1 }, say), "thắng 6, thua 1 ván")
})

test("the games a number of bans is out of are named once some of them do not show theirs", () => {
  assert.equal(shownText({ games: 327, shown: 303 }, say), " có ghi lượt cấm")
  assert.equal(shownText({ games: 327, shown: 327 }, say), "")
})
