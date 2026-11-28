import assert from "node:assert/strict"
import { test } from "node:test"
import {
  CATEGORIES,
  centre,
  clock,
  crossed,
  epicCalls,
  frameWallPath,
  familyOf,
  inside,
  markers,
  momentAt,
  objectiveIcons,
  objectsIn,
  phases,
  railAt,
  railTime,
  readMapTab,
  resolveRef,
  roundedPath,
  spawnClock,
  terrainOf,
  timingText,
} from "../src/lib/battle-map.ts"

const object = (code, extra = {}) => ({
  code,
  name: code,
  category: "EPIC",
  tags: [],
  sections: [],
  positions: [],
  ...extra,
})

/** @type {import("../src/lib/battle-map.ts").MapContent} */
const map = {
  name: "Bách khoa chiến trường",
  objects: [
    object("caesar", { positions: [{ x: 32.9, y: 28.1 }] }),
    object("caesar-hac-am", { family: "caesar" }),
    object("caesar-bao-chua", {
      positions: [
        { key: "caesar", x: 32.9, y: 28.1 },
        { key: "rong", x: 67.1, y: 71.9 },
      ],
    }),
    object("tru-ngoai", {
      category: "STRUCTURE",
      positions: [
        { key: "xanh-giua", side: "BLUE", x: 39.1, y: 58.3 },
        { key: "do-giua", side: "RED", x: 60.9, y: 41.7 },
      ],
    }),
  ],
  areas: [
    {
      code: "hang-caesar",
      name: "Hang Caesar",
      outline: [
        { x: 28, y: 22 },
        { x: 38, y: 22 },
        { x: 38, y: 34 },
        { x: 28, y: 34 },
      ],
    },
  ],
  lanes: [{ code: "duong-giua", name: "Đường giữa", heroCodes: [], positions: [], path: [] }],
  tempo: [
    { seconds: 0, phase: "Đầu trận", callouts: [], steps: [] },
    { seconds: 120, callouts: [], steps: [] },
    { seconds: 240, phase: "Giữa trận", callouts: [], steps: [] },
  ],
  sources: [],
}

test("a reference names an object, one of its places, an area or a lane", () => {
  assert.equal(resolveRef(map, "tru-ngoai.do-giua")?.kind, "object")
  const place = resolveRef(map, "tru-ngoai.do-giua")
  assert.equal(place?.kind === "object" && place.spot?.side, "RED")
  assert.equal(resolveRef(map, "hang-caesar")?.kind, "area")
  assert.equal(resolveRef(map, "duong-giua")?.kind, "lane")
  assert.equal(resolveRef(map, "tru-ngoai.xanh-rong"), null)
  assert.equal(resolveRef(map, "khong-co"), null)
})

test("a form resolves to itself with its family head", () => {
  const form = resolveRef(map, "caesar-hac-am")
  assert.equal(form?.kind === "object" && form.head.code, "caesar")
  assert.deepEqual(
    familyOf(map, map.objects[1]).map((member) => member.code),
    ["caesar", "caesar-hac-am"],
  )
})

test("markers on one place are grouped so they can be fanned out", () => {
  const drawn = markers(map, new Set(CATEGORIES))
  const pit = drawn.filter((marker) => marker.spot.x === 32.9)
  assert.deepEqual(
    pit.map((marker) => [marker.ref, marker.stack, marker.stackSize]),
    [
      ["caesar", 0, 2],
      ["caesar-bao-chua.caesar", 1, 2],
    ],
  )
  assert.equal(drawn.length, 5)
  assert.equal(markers(map, new Set(["STRUCTURE"])).length, 2)
})

test("an area holds the objects standing inside it", () => {
  assert.deepEqual(
    objectsIn(map, map.areas[0]).map((found) => found.code),
    ["caesar", "caesar-bao-chua"],
  )
  assert.equal(inside({ x: 50, y: 50 }, map.areas[0].outline), false)
  assert.deepEqual(centre(map.areas[0].outline), { x: 33, y: 28 })
})

test("times read as the game writes them", () => {
  assert.equal(clock(0), "0:00")
  assert.equal(clock(125.7), "2:05")
  assert.equal(clock(900), "15:00")
  assert.equal(timingText({ seconds: 120, note: "Phút thứ 2" }), "Phút thứ 2")
  assert.equal(timingText({ seconds: 180 }), "3:00")
  assert.equal(timingText(null), null)
  assert.equal(spawnClock({ seconds: 30, note: "Giây thứ 30" }), "0:30")
  assert.equal(spawnClock({ note: "Khi nhà lính bị phá" }), null)
})

test("the clock passes each mark of the timeline once and never going back", () => {
  assert.deepEqual(
    crossed(map.tempo, 100, 260).map((moment) => moment.seconds),
    [120, 240],
  )
  assert.deepEqual(crossed(map.tempo, 260, 100), [])
  assert.equal(momentAt(map.tempo, 200)?.seconds, 120)
  assert.deepEqual(phases(map.tempo, 540), [
    { name: "Đầu trận", from: 0, to: 240 },
    { name: "Giữa trận", from: 240, to: 540 },
  ])
})

test("an unknown tab opens the map", () => {
  assert.equal(readMapTab("tempo"), "tempo")
  assert.equal(readMapTab("khac"), "map")
  assert.equal(readMapTab(null), "map")
})

test("the rail gives the first minutes more room and maps back to the same time", () => {
  assert.equal(railAt(0, 1200), 0)
  assert.equal(railAt(300, 1200), 0.5)
  assert.equal(railAt(5000, 1200), 1)
  assert.equal(railTime(0.5, 1200), 300)
})

test("terrain is drawn by kind and skips shapes that are not yet an outline", () => {
  const wall = {
    kind: "WALL",
    outline: [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 3 },
    ],
  }
  const started = { kind: "WALL", outline: [{ x: 5, y: 5 }] }
  const river = { kind: "RIVER", outline: wall.outline }
  assert.deepEqual(terrainOf({ terrain: [wall, started, river] }, "WALL"), [wall])
  assert.deepEqual(terrainOf({}, "WALL"), [])
})

test("a rounded outline cuts each corner by the radius or half of a short side", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  assert.equal(roundedPath(square, 2), "M2 0L8 0Q10 0 10 2L10 8Q10 10 8 10L2 10Q0 10 0 8L0 2Q0 0 2 0Z")
  const small = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 2 },
  ]
  assert.match(roundedPath(small, 5), /^M1 0L1 0Q2 0 1\.5 1/)
  assert.equal(roundedPath([{ x: 1, y: 1 }], 2), "M1 1Z")
})

test("big monster calls keep the marks and callouts that name one, never the opening", () => {
  const content = {
    objects: [
      object("caesar", { glyph: "CAESAR" }),
      object("rong", { glyph: "DRAGON" }),
      object("tru", { category: "STRUCTURE" }),
    ],
    tempo: [
      { seconds: 0, callouts: [{ label: "Caesar", objectCode: "caesar", x: 1, y: 1 }], steps: [] },
      {
        seconds: 120,
        callouts: [
          { label: "Trụ", objectCode: "tru", x: 1, y: 1 },
          { label: "Caesar xuất hiện", objectCode: "caesar", x: 1, y: 1 },
          { label: "Rồng tiến hóa", objectCode: "rong", x: 1, y: 1 },
        ],
        steps: [],
      },
      { seconds: 240, callouts: [{ label: "Trụ", objectCode: "tru", x: 1, y: 1 }], steps: [] },
    ],
  }
  assert.deepEqual(epicCalls(content), [
    { seconds: 120, labels: ["Caesar xuất hiện", "Rồng tiến hóa"], glyph: "CAESAR" },
  ])
})

test("the frame wall is the square's edge with a rounded opening inside it", () => {
  const frame = frameWallPath(1.5, 2)
  assert.match(frame, /^M0 0H100V100H0Z/)
  assert.match(frame.slice("M0 0H100V100H0Z".length), /^M3\.5 1\.5L96\.5 1\.5Q98\.5 1\.5 98\.5 3\.5/)
  assert.equal((frame.match(/Q/g) ?? []).length, 4)
})

test("each recorded objective takes the icon uploaded for its object, and none where the map has none", () => {
  const content = {
    objects: [
      object("caesar", { iconAssetId: "a1" }),
      object("rong", { iconAssetId: "missing" }),
      object("tru-ngoai", { category: "STRUCTURE", iconAssetId: "a3" }),
      object("nha-chinh", { category: "STRUCTURE" }),
    ],
  }
  const images = { a1: { url: "https://img/caesar.png" }, a3: { url: "https://img/tru.png" } }
  assert.deepEqual(objectiveIcons(content, images), {
    DARK_SLAYER: "https://img/caesar.png",
    TURRET: "https://img/tru.png",
  })
})
