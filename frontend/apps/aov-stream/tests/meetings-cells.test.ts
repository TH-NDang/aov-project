import assert from "node:assert/strict"
import { test } from "node:test"
import { firstCell, nameWidth, nextCell, tableRoom, pathRoom } from "../src/lib/meetings-cells.ts"

const NINE = ["SGP", "FPL", "BME", "FL", "ME", "BOX", "1S", "TS", "RRQ"]
const twice = { compact: false, marked: true, sum: false, legs: 2, games: 5 }
const phone = { ...twice, compact: true }

test("a wide page draws the marks of nine teams that met twice", () => {
  const room = tableRoom(1216, NINE, twice)
  assert.deepEqual([room.kind, room.names, room.first], ["marks", "wide", 116])
  assert.ok(room.first + 9 * room.column <= 1216)
})

test("a page without published games keeps to the scores", () => {
  assert.equal(tableRoom(1216, NINE, { ...twice, marked: false }).kind, "scores")
})

test("nine teams fit a phone without scrolling, their scores one under the other", () => {
  for (const width of [366, 336]) {
    const room = tableRoom(width, NINE, phone)
    assert.deepEqual([room.kind, room.names, room.first, room.narrow], ["stack", "phone", 34, true])
    assert.ok(room.first + 9 * room.column <= width + 0.001)
    assert.ok(room.column >= 33)
  }
})

test("one match a pair never stands under another, so its cell keeps to the score or the day", () => {
  for (const width of [366, 336]) {
    const { kind, narrow } = tableRoom(width, NINE, { ...phone, legs: 1 })
    assert.deepEqual([kind, narrow], ["scores", true])
  }
})

test("a phone draws no marks however few teams there are", () => {
  assert.equal(tableRoom(366, ["A", "B", "C"], phone).kind, "scores")
})

test("a tablet draws marks and crests as far as its columns have room", () => {
  assert.deepEqual([tableRoom(796, NINE, phone).kind, tableRoom(796, NINE, phone).names], ["marks", "compact"])
  assert.equal(tableRoom(600, NINE, phone).kind, "stack")
})

test("more legs or longer matches need wider columns", () => {
  const kind = (legs: number, games: number) => tableRoom(900, NINE, { ...twice, legs, games }).kind
  assert.deepEqual([kind(1, 5), kind(2, 5), kind(3, 5), kind(2, 9)], ["marks", "marks", "stack", "scores"])
})

test("a sum needs the room of its marks", () => {
  const kind = (games: number) => tableRoom(900, NINE, { ...twice, sum: true, games }).kind
  assert.deepEqual([kind(5), kind(9)], ["marks", "scores"])
})

test("the marks of one sum need less room than those of matches beside each other", () => {
  const kind = (sum: boolean) => tableRoom(566, NINE, { ...twice, games: 3, sum }).kind
  assert.deepEqual([kind(true), kind(false)], ["marks", "stack"])
})

test("a column has room for a day from 44 pixels on", () => {
  const narrow = (width: number) => tableRoom(width, NINE, phone).narrow
  assert.deepEqual([narrow(34 + 9 * 44), narrow(34 + 9 * 44 - 1)], [false, true])
})

test("a small group keeps its teams near each other", () => {
  const room = tableRoom(1216, ["ONE", "KOG", "FL"], twice)
  assert.equal(room.column, 184)
})

test("the column of names fits the longest of them, up to a limit", () => {
  const first = (names: string[]) => tableRoom(366, names, phone).first
  assert.ok(first([...NINE, "solyx"]) > first(NINE))
  assert.equal(first([...NINE, "Đội tuyển chưa có tên ngắn"]), 64)
})

test("crests head the columns of a phone when the names are too long for them", () => {
  assert.equal(tableRoom(366, [...NINE.slice(1), "solyx"], phone).crests, false)
  assert.equal(tableRoom(366, [...NINE.slice(1), "Chinese Taipei"], phone).crests, true)
  assert.equal(tableRoom(1216, [...NINE.slice(1), "Chinese Taipei"], twice).crests, false)
})

test("a name a little wider than its column still heads it", () => {
  const { column, crests } = tableRoom(366, [...NINE.slice(1), "Talon"], phone)
  assert.ok(nameWidth("Talon", 12) > column)
  assert.equal(crests, false)
})

test("a table that is not laid out yet has no room", () => {
  assert.equal(tableRoom(0, NINE, twice).column, 0)
  assert.equal(tableRoom(0, [], twice).column, 0)
})

test("the paths of the teams show crests, lose them, then take two lines as the page gets narrower", () => {
  const look = (width: number) => pathRoom(width, NINE, 5).look
  assert.deepEqual([look(1216), look(796), look(366)], ["crest", "line", "stack"])
})

test("the paths show crests down to the width they just fit", () => {
  const { first, round } = pathRoom(5000, NINE, 5)
  const look = (width: number) => pathRoom(width, NINE, 5).look
  assert.deepEqual([look(first + 5 * round), look(first + 5 * round - 1)], ["crest", "line"])
})

test("five rounds fit a phone without scrolling", () => {
  for (const width of [366, 336]) {
    const { first, round } = pathRoom(width, [...NINE, "solyx"], 5)
    assert.ok(first + 5 * round <= width)
  }
})

test("long names and many rounds scroll rather than getting cut short", () => {
  const { first, round } = pathRoom(366, [...NINE, "Chinese Taipei"], 5)
  assert.ok(first + 5 * round > 366)
  assert.ok(round > pathRoom(366, NINE, 5).round)
})

test("a name is as wide as its letters, capitals wider than small ones", () => {
  assert.ok(nameWidth("SGP", 12) > nameWidth("sgp", 12))
  assert.ok(nameWidth("HCM-UTE", 12) < nameWidth("HCMXUTE", 12))
  assert.equal(nameWidth("1S", 24), 2 * nameWidth("1S", 12))
})

/** A table of three teams: no cell of a team against itself opens anything, nor the one of a pair that never met. */
const opens = [
  [false, true, true],
  [true, false, false],
  [true, false, false],
]

test("the arrow keys lead to the next cell that opens something", () => {
  assert.deepEqual(nextCell(opens, [0, 1], "ArrowRight"), [0, 2])
  assert.deepEqual(nextCell(opens, [0, 2], "ArrowLeft"), [0, 1])
  assert.deepEqual(nextCell(opens, [1, 0], "ArrowDown"), [2, 0])
  assert.deepEqual(nextCell(opens, [2, 0], "ArrowUp"), [1, 0])
})

test("cells that open nothing are passed over", () => {
  const gap = [[true, false, true], [false], [true]]
  assert.deepEqual(nextCell(gap, [0, 0], "ArrowRight"), [0, 2])
  assert.deepEqual(nextCell(gap, [0, 0], "ArrowDown"), [2, 0])
})

test("at the edge of the table a key leads nowhere", () => {
  assert.equal(nextCell(opens, [0, 2], "ArrowRight"), null)
  assert.equal(nextCell(opens, [0, 1], "ArrowLeft"), null)
  assert.equal(nextCell(opens, [0, 1], "ArrowUp"), null)
  assert.equal(nextCell(opens, [2, 0], "ArrowDown"), null)
})

test("home and end lead to the ends of the row", () => {
  const row = [[false, true, true, true, false]]
  assert.deepEqual(nextCell(row, [0, 2], "Home"), [0, 1])
  assert.deepEqual(nextCell(row, [0, 2], "End"), [0, 3])
})

test("other keys lead nowhere", () => {
  assert.equal(nextCell(opens, [0, 1], "Enter"), null)
})

test("a reader enters a table at the first cell of a row that opens something, or of the rows after it", () => {
  assert.deepEqual(firstCell(opens), [0, 1])
  assert.deepEqual(firstCell(opens, 2), [2, 0])
  assert.deepEqual(firstCell([[false], [false], [true]], 1), [2, 0])
  assert.deepEqual(firstCell([[true], [false]], 1), [0, 0])
})

test("a table without a cell to open has no first one", () => {
  assert.equal(firstCell([]), null)
  assert.equal(firstCell([[false]]), null)
})
