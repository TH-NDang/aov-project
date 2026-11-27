import assert from "node:assert/strict"
import { test } from "node:test"
import type { MapContent, MapObject } from "@aov/ui/lib/battle-map"
import {
  addSpot,
  emptyMap,
  emptyObject,
  fixedMapCodes,
  mirrorArea,
  mirrorKey,
  mirrorName,
  mirrorSpotAt,
  placeOptions,
  readClock,
  readMapJson,
  renameObject,
  renameSpot,
} from "../src/features/game-modes/map/map-edit-model"

const tower = (): MapObject => ({
  ...emptyObject("STRUCTURE"),
  code: "tru-ngoai",
  name: "Trụ ngoài",
  positions: [{ key: "xanh-caesar", side: "BLUE", label: "Đường Caesar", x: 4.2, y: 40 }],
})

test("the mirror swaps the side and the epic a half belongs to, in codes and in names", () => {
  assert.equal(mirrorKey("xanh-caesar"), "do-rong")
  assert.equal(mirrorKey("rung-do-rong"), "rung-xanh-caesar")
  assert.equal(mirrorKey("giua"), "giua")
  assert.equal(mirrorName("Rừng xanh phía Caesar"), "Rừng đỏ phía Rồng")
  assert.equal(mirrorName("Sông"), null)
})

test("a mirrored place stands across the centre on the other side, with its own key", () => {
  const mirrored = mirrorSpotAt(tower(), 0).positions[1]
  assert.deepEqual(mirrored, { key: "do-rong", side: "RED", label: "Đường Rồng", x: 95.8, y: 60 })
})

test("a second place keys both places so each can be named", () => {
  const camp = addSpot(addSpot({ ...emptyObject("MONSTER"), code: "ech-xanh" }, { x: 20, y: 60 }), { x: 80, y: 40 })
  assert.deepEqual(
    camp.positions.map((spot) => [spot.key, spot.side]),
    [
      ["xanh", "BLUE"],
      ["do", "RED"],
    ],
  )
  const pit = addSpot({ ...emptyObject("EPIC"), code: "rong" }, { x: 67.1, y: 71.9 })
  assert.equal(pit.positions[0]!.side, null, "an epic monster belongs to neither side")
  assert.equal(pit.positions[0]!.key, null, "one place needs no key")
})

const map = (): MapContent => ({
  ...emptyMap(),
  objects: [
    { ...emptyObject("EPIC"), code: "caesar", name: "Caesar", positions: [{ x: 32.9, y: 28.1 }] },
    { ...emptyObject("EPIC"), code: "caesar-hac-am", name: "Caesar hắc ám", family: "caesar" },
    tower(),
  ],
  tempo: [
    {
      seconds: 120,
      steps: [],
      callouts: [
        { label: "Caesar xuất hiện", objectCode: "caesar", spotKey: null, x: 32.9, y: 28.1 },
        { label: "Trụ", objectCode: "tru-ngoai", spotKey: "xanh-caesar", x: 4.2, y: 40 },
      ],
    },
  ],
})

test("renaming an object or a place carries its forms and the timeline's callouts along", () => {
  const renamed = renameSpot(renameObject(map(), "caesar", "caesar-co-dai"), "tru-ngoai", "xanh-caesar", "xanh-tren")
  assert.equal(renamed.objects[1]!.family, "caesar-co-dai")
  assert.deepEqual(
    renamed.tempo[0]!.callouts.map((callout) => [callout.objectCode, callout.spotKey]),
    [
      ["caesar-co-dai", null],
      ["tru-ngoai", "xanh-tren"],
    ],
  )
})

test("codes the saved draft or another entry uses stay put", () => {
  const fixed = fixedMapCodes(null, map())
  assert.ok(fixed.has("caesar"), "a family head and a callout's object")
  assert.ok(fixed.has("tru-ngoai"))
  assert.ok(!fixed.has("caesar-hac-am"))
})

test("a callout can point at an object in one place or at one keyed place", () => {
  assert.deepEqual(
    placeOptions(map()).map((option) => [option.value, option.point]),
    [
      ["caesar", { x: 32.9, y: 28.1 }],
      ["tru-ngoai", { x: 4.2, y: 40 }],
    ],
  )
})

test("an area mirrors into a free code on the other side", () => {
  const area = { code: "hang-caesar", name: "Hang Caesar", side: null, outline: [{ x: 30, y: 25 }] }
  assert.deepEqual(mirrorArea(area, new Set(["hang-caesar"])), {
    code: "hang-rong",
    name: "Hang Rồng",
    side: null,
    outline: [{ x: 70, y: 75 }],
  })
  assert.equal(mirrorArea(area, new Set(["hang-rong"])).code, "hang-rong-2")
})

test("times read as m:ss or as seconds", () => {
  assert.equal(readClock("2:00"), 120)
  assert.equal(readClock(" 15:30 "), 930)
  assert.equal(readClock("90"), 90)
  assert.equal(readClock("2:75"), null)
  assert.equal(readClock("hai phút"), null)
})

test("a map read from JSON keeps its lists and fills the missing ones", () => {
  const read = readMapJson('{"name":"5v5","objects":[{"code":"rong"}]}')
  assert.equal(read.objects.length, 1)
  assert.deepEqual(read.tempo, [])
  assert.throws(() => readMapJson("[]"), /không phải một bản đồ/)
  assert.throws(() => readMapJson('{"objects":{}}'), /"objects" phải là danh sách/)
})
