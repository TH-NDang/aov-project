import assert from "node:assert/strict"
import { test } from "node:test"
import { buildOf, type LineupRecord } from "../src/lib/build-view.ts"
import { loadoutWords, recordWords } from "../src/lib/build-words.ts"
import { catalogOf, participant as seat, reference } from "./fixtures/loadout.ts"

const vi = (text: string) => text
const en = (_: string, text: string) => text

const catalog = catalogOf({
  spells: [reference("flash", null, "Tốc biến")],
  enchantments: [reference("demon", 3, "Ma tính")],
  items: [
    reference("boots", 2, "Giày hộ vệ"),
    reference("spear", 3, "Thương Longinus"),
    reference("armor", 3, "Giáp hộ mệnh"),
  ],
})

test("a loadout is told in words, each kind by its name", () => {
  const player = seat({
    spell: { id: "flash" },
    enchantments: { status: "PARTIAL", entries: [{ selection: { id: "demon" }, primary: true, tier: 3 }] },
    build: [
      { item: { id: "boots" }, place: "KEPT" },
      { item: { id: "spear" }, place: "REPLACED" },
      { item: { id: "armor" }, place: "SITUATIONAL" },
      { item: { name: "Món lạ" }, place: "KEPT" },
    ],
  })

  assert.equal(
    loadoutWords(player, catalog, buildOf(player, catalog), vi),
    "Phụ trợ: Tốc biến. Phù hiệu: Ma tính. Trang bị: Giày hộ vệ, Món lạ. Đã đổi: Thương Longinus. Tình huống: Giáp hộ mệnh.",
  )
})

test("what nobody saw is left out of the words, and a loadout without anything has none", () => {
  const player = seat({ spell: { id: "flash" } })

  assert.equal(loadoutWords(player, catalog, null, en), "Spell: Tốc biến.")
  assert.equal(loadoutWords(seat(), catalog, null, vi), "")
})

const record = (extra: Partial<LineupRecord> = {}): LineupRecord => ({
  seats: 10,
  players: 10,
  spells: 10,
  enchantments: 10,
  arcana: 0,
  items: 10,
  built: 0,
  mainOnly: true,
  atEnd: true,
  unread: true,
  ...extra,
})
const nothing = { spells: 0, enchantments: 0, items: 0, unread: false }

test("a game without any loadout says so in one sentence", () => {
  assert.deepEqual(recordWords(record(nothing), vi), ["Ván này chưa ghi trang bị, phụ trợ và phù hiệu."])
})

test("the same sentence tells that nobody knows who played", () => {
  assert.deepEqual(recordWords(record({ ...nothing, players: 0 }), vi), [
    "Ván này chưa ghi ai chơi tướng nào, cũng chưa ghi trang bị, phụ trợ và phù hiệu.",
  ])
  assert.equal(recordWords(record({ players: 0 }), en)[0], "Who played which hero is not recorded for this game.")
})

test("only the kinds nobody recorded are told to be missing", () => {
  assert.equal(recordWords(record({ items: 0, unread: false }), vi)[0], "Ván này chưa ghi trang bị.")
  assert.equal(recordWords(record({ spells: 0, enchantments: 0 }), vi)[0], "Ván này chưa ghi phụ trợ và phù hiệu.")
  assert.equal(
    recordWords(record(nothing), en)[0],
    "The items, spells and enchantments of this game are not recorded yet.",
  )
})

test("items read from the last inventory say when it was shown and what a faint slot means", () => {
  assert.deepEqual(recordWords(record(), vi), [
    "Trang bị lúc ván kết thúc, không kể món cấp 1; ô mờ là chưa rõ.",
    "Mỗi người mới ghi phù hiệu chính.",
  ])
  assert.deepEqual(recordWords(record({ atEnd: false, unread: false, mainOnly: false }), vi), [
    "Trang bị ở lần cuối nguồn cho thấy, không kể món cấp 1.",
  ])
})

test("items written down for some players are told apart from those read for the others", () => {
  assert.deepEqual(recordWords(record({ built: 6, items: 9, unread: false, mainOnly: false }), vi), [
    "6 người có ghi các món đã lên, 3 người chỉ có trang bị lúc ván kết thúc.",
  ])
})

test("a game whose record is whole needs no words", () => {
  assert.deepEqual(recordWords(record({ built: 10, unread: false, mainOnly: false }), vi), [])
})

test("at a second of the game the words tell what had been seen by then", () => {
  const seen = recordWords(record({ mainOnly: false }), vi, 360)
  const unseen = recordWords(record({ items: 0, unread: false, mainOnly: false }), vi, 30)

  assert.deepEqual(seen, ["Trang bị nhìn thấy lần cuối tính đến 6:00; ô mờ là chưa rõ."])
  assert.deepEqual(unseen, ["Chưa thấy trang bị của ai tính đến 0:30."])
})
