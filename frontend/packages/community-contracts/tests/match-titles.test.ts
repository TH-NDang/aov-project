import assert from "node:assert/strict"
import { test } from "node:test"
import { slotLabel } from "../src/competition.ts"
import { matchName, matchTitleText, type MatchTitle } from "../src/match-titles.ts"

const vietnamese = (vi: string) => vi
const english = (_vi: string, en: string) => en

test("a round-robin title reads its leg and round in the reader's language", () => {
  const title: MatchTitle = { kind: "ROUND_ROBIN", leg: 1, round: 2 }

  assert.equal(matchTitleText(title, vietnamese), "Lượt 1 · Vòng 2")
  assert.equal(matchTitleText(title, english), "Leg 1 · Round 2")
})

test("bracket titles read their round and number in the reader's language", () => {
  assert.equal(matchTitleText({ kind: "UPPER_SEMIFINAL", number: 2 }, vietnamese), "Bán kết nhánh thắng 2")
  assert.equal(matchTitleText({ kind: "LOWER_ROUND", round: 1, number: 2 }, english), "Lower bracket round 1 · 2")
  assert.equal(matchTitleText({ kind: "GRAND_FINAL" }, english), "Grand final")
})

test("knockout titles name their round by the teams left in it", () => {
  assert.equal(matchTitleText({ kind: "ROUND_OF", round: 16, number: 3 }, vietnamese), "Vòng 16 đội · 3")
  assert.equal(matchTitleText({ kind: "QUARTERFINAL", number: 2 }, english), "Quarterfinal 2")
  assert.equal(matchTitleText({ kind: "THIRD_PLACE" }, vietnamese), "Tranh hạng ba")
  assert.equal(matchTitleText({ kind: "UPPER_ROUND", round: 1, number: 4 }, vietnamese), "Vòng 1 nhánh thắng · 4")
})

test("a name an editor typed wins over the title", () => {
  const match = { label: "Opening match", title: { kind: "GRAND_FINAL" } as MatchTitle }

  assert.equal(matchName(match, english), "Opening match")
})

test("a blank name leaves the title to speak, and a series reads its own name the same way", () => {
  assert.equal(matchName({ label: " ", title: { kind: "EXTRA" } }, english), "Additional match")
  assert.equal(matchName({ name: "Chung kết", title: { kind: "GRAND_FINAL" } }, english), "Chung kết")
})

test("a record from before titles keeps its stored name, and one with neither has no name", () => {
  assert.equal(matchName({ label: "Lượt 1 · Vòng 2" }, english), "Lượt 1 · Vòng 2")
  assert.equal(matchName({}, english), null)
})

test("a title kind this app does not know yet reads as no title", () => {
  assert.equal(matchTitleText({ kind: "SHOW_MATCH" as MatchTitle["kind"] }, english), null)
})

test("an open side reads the match it comes from, its seed or undecided in the reader's language", () => {
  const plan = {
    playoffSeeds: {},
    matches: [{ key: "GF", stageCode: "PO", round: 5, bestOf: 7, title: { kind: "UPPER_FINAL" }, a: {}, b: {} }],
  } as unknown as Parameters<typeof slotLabel>[1]

  assert.equal(slotLabel({ type: "WINNER", matchKey: "GF" }, plan, {}, english), "Winner of Upper bracket final")
  assert.equal(slotLabel({ type: "SEED", seed: 3 }, plan, {}, vietnamese), "Hạt giống 3")
  assert.equal(slotLabel({ type: "TBD" }, plan, {}, english), "TBD")
})
