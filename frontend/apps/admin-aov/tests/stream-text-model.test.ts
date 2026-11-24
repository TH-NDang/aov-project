import assert from "node:assert/strict"
import { test } from "node:test"
import { runningTextReferences } from "@aov/ui/lib/running-text"
import type { NamedRecord } from "@aov/ui/lib/running-text-names"
import { readStreamText } from "../src/features/terminology/stream-text-model"

const record = (
  kind: NamedRecord["kind"],
  id: string,
  name: string,
  extra: Partial<NamedRecord> = {},
): NamedRecord => ({
  id,
  kind,
  name,
  path: `/pages/${id}`,
  ...extra,
})
const references = runningTextReferences({
  names: [
    record("CIRCUIT", "aog", "Đấu Trường Danh Vọng", { shortName: "AOG" }),
    record("CIRCUIT", "rpl", "RoV Pro League", { shortName: "RPL" }),
    record("COMPETITION", "aog-winter", "Đấu Trường Danh Vọng Mùa Đông 2026", { circuitId: "aog" }),
    record("TEAM", "box", "Box Gaming", { shortName: "BOX" }),
    record("TEAM", "flash", "Team Flash", { shortName: "FL" }),
    record("PLAYER", "kaisa", "Kaisa", { teamIds: ["box"] }),
  ],
  catalog: [],
  modes: [],
  locale: "vi-VN",
  streamUrl: "http://localhost:5174",
  wikiUrl: "http://localhost:5173",
})

const linked = (text: string) => readStreamText(text, references).linked.map(({ key }) => key)
const misspelled = (text: string) =>
  readStreamText(text, references).misspelled.map(({ label, expected, key }) => [label, expected, key])

test("a text lists every record Stream links, once, in the order it names them", () => {
  const text = "AOG Mùa Đông 2026: Box Gaming thắng Team Flash.\n\nBox Gaming vô địch AOG."

  assert.deepEqual(linked(text), ["competition:aog-winter", "team:box", "team:flash", "circuit:aog"])
})

test("a linked record says where it opens and how the text calls it", () => {
  const [circuit] = readStreamText("giải AOG mùa này", references).linked

  assert.equal(circuit!.route, "/pages/aog")
  assert.equal(circuit!.label, "AOG")
})

test("the pasted address of a page counts as its name", () => {
  assert.deepEqual(linked("Xem http://localhost:5174/pages/rpl nhé"), ["circuit:rpl"])
})

test("a short name in lower case is told how Stream reads it", () => {
  assert.deepEqual(linked("giải aog"), [])
  assert.deepEqual(misspelled("giải aog"), [["aog", "AOG", "circuit:aog"]])
})

test("a name that is linked elsewhere in the text is not told again", () => {
  assert.deepEqual(misspelled("AOG, tức aog"), [])
})

test("a name that its own spelling would not link either is left alone", () => {
  assert.deepEqual(misspelled("kaisa đánh hay"), [])
  assert.deepEqual(misspelled("Box Gaming có kaisa"), [["kaisa", "Kaisa", "player:kaisa"]])
})

test("a short name inside a longer word is no name", () => {
  assert.deepEqual(misspelled("aogame và inbox"), [])
})
