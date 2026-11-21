import assert from "node:assert/strict"
import { test } from "node:test"
import {
  addPieces,
  byColor,
  clearColor,
  colorCount,
  fillColor,
  pageTotals,
  pastedArcanaPage,
  readArcanaPage,
  removePieces,
  writeArcanaPage,
  type PageArcana,
} from "../src/features/warehouse/arcana-page-model.ts"

const ARCANA: PageArcana[] = [
  { code: "red-attack", color: "RED", stats: [{ key: "physical-attack", value: 3.2, unit: null }] },
  {
    code: "red-lifesteal",
    color: "RED",
    stats: [
      { key: "physical-attack", value: 2.5, unit: null },
      { key: "physical-lifesteal", value: 0.5, unit: "%" },
    ],
  },
  { code: "purple-speed", color: "PURPLE", stats: [{ key: "movement-speed", value: 1, unit: "%" }] },
  { code: "green-pierce", color: "GREEN", stats: [{ key: "armor-penetration", value: 6.4, unit: null }] },
]

test("a color takes no more than ten pieces, however many are asked for", () => {
  const page = addPieces(addPieces([], ARCANA, "red-attack", 7), ARCANA, "red-lifesteal", 5)

  assert.deepEqual(page, [
    { code: "red-attack", count: 7 },
    { code: "red-lifesteal", count: 3 },
  ])
  assert.equal(colorCount(page, ARCANA, "RED"), 10)
  assert.equal(addPieces(page, ARCANA, "red-attack"), page)
})

test("filling a color places the arcana in every free slot of its color and no other", () => {
  const page = fillColor(addPieces([], ARCANA, "red-attack", 2), ARCANA, "red-lifesteal")

  assert.deepEqual(page, [
    { code: "red-attack", count: 2 },
    { code: "red-lifesteal", count: 8 },
  ])
  assert.equal(colorCount(page, ARCANA, "PURPLE"), 0)
})

test("removing the last piece of an arcana takes it off the page, and a color can be emptied at once", () => {
  const page = addPieces(addPieces([], ARCANA, "red-attack", 1), ARCANA, "purple-speed", 4)

  assert.deepEqual(removePieces(page, "red-attack"), [{ code: "purple-speed", count: 4 }])
  assert.deepEqual(clearColor(page, ARCANA, "PURPLE"), [{ code: "red-attack", count: 1 }])
})

test("a page written to the address reads back the same, and an edited link cannot overfill or name unknown arcana", () => {
  const page = addPieces(addPieces([], ARCANA, "red-attack", 9), ARCANA, "purple-speed")

  assert.equal(writeArcanaPage(page), "red-attack*9,purple-speed")
  assert.deepEqual(readArcanaPage(writeArcanaPage(page), ARCANA), page)
  assert.deepEqual(readArcanaPage("red-attack*8,red-lifesteal*8,missing*3,green-pierce*x", ARCANA), [
    { code: "red-attack", count: 8 },
    { code: "red-lifesteal", count: 2 },
  ])
})

test("the totals add every stat over its pieces, rounded as the game writes them, in the shared stat order", () => {
  const page = addPieces(
    addPieces(addPieces([], ARCANA, "red-lifesteal", 7), ARCANA, "red-attack", 3),
    ARCANA,
    "purple-speed",
    10,
  )

  assert.deepEqual(pageTotals(page, ARCANA), [
    { key: "physical-attack", unit: null, value: 27.1 },
    { key: "movement-speed", unit: "%", value: 10 },
    { key: "physical-lifesteal", unit: "%", value: 3.5 },
  ])
})

test("the summary lists the pieces red, purple, then green, whatever order they were placed in", () => {
  const page = addPieces(
    addPieces(addPieces(addPieces([], ARCANA, "green-pierce", 2), ARCANA, "purple-speed"), ARCANA, "red-lifesteal"),
    ARCANA,
    "red-attack",
  )

  assert.deepEqual(
    byColor(page, ARCANA).map((piece) => piece.code),
    ["red-lifesteal", "red-attack", "purple-speed", "green-pierce"],
  )
})

test("a pasted link or its slots value opens that page, and a paste that names no arcana opens nothing", () => {
  const link = "https://athahub.com/warehouse/arcana?view=page&slots=red-attack*9%2Cpurple-speed"

  assert.deepEqual(pastedArcanaPage(link, ARCANA), [
    { code: "red-attack", count: 9 },
    { code: "purple-speed", count: 1 },
  ])
  assert.deepEqual(pastedArcanaPage(" green-pierce*3 ", ARCANA), [{ code: "green-pierce", count: 3 }])
  assert.equal(pastedArcanaPage("https://athahub.com/warehouse/arcana", ARCANA), null)
  assert.equal(pastedArcanaPage("hello", ARCANA), null)
})
