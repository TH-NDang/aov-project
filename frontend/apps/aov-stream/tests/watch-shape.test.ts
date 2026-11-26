import assert from "node:assert/strict"
import { test } from "node:test"
import { shapeOf, turnedOver } from "../src/lib/watch-shape.ts"
import type { RoomBar } from "../src/lib/watch-types.ts"

/** The room in one line, as the table of the windows has it. */
function room(width: number, height: number, kind: RoomBar = "STORY") {
  const { shape, phone, video, companion, bar, density } = shapeOf(width, height, kind)
  return `${shape}${phone ? ", phone" : ""} ${video.width} × ${video.height} ${companion} ${bar} ${density}`
}

test("beside the video stands the companion, under both the bar", () => {
  assert.equal(room(1280, 593), "side 919 × 517 361 76 short")
  assert.equal(room(1366, 633), "side 990 × 557 376 76 short")
  assert.equal(room(1366, 768), "side 1046 × 588 320 76 short")
  assert.equal(room(1440, 789), "side 1120 × 630 320 76 roomy")
  assert.equal(room(1536, 730), "side 1163 × 654 373 76 roomy")
  assert.equal(room(1920, 953), "side 1559 × 877 361 76 roomy")
  assert.equal(room(1920, 1032), "side 1600 × 900 320 76 roomy")
  assert.equal(room(2560, 1300), "side 2176 × 1224 384 76 roomy")
})

test("a smaller window beside the video is less dense in words", () => {
  assert.equal(room(1180, 820), "side 884 × 497 296 76 mid")
  assert.equal(room(1024, 690), "side 728 × 410 296 76 mid")
  assert.equal(room(900, 640), "side 604 × 340 296 76 tight")
  assert.equal(room(932, 380), "side 569 × 320 363 60 tight")
})

test("a window too tall for the companion beside it stacks", () => {
  assert.equal(room(960, 950), "stack 960 × 540 960 76 roomy")
  assert.equal(room(820, 1080), "stack 820 × 461 820 76 roomy")
  assert.equal(room(600, 900), "stack 600 × 338 600 76 roomy")
})

test("a phone stacks under its bar of tabs and one staff", () => {
  assert.equal(room(390, 664), "stack, phone 390 × 219 390 98 roomy")
  assert.equal(room(360, 640), "stack, phone 360 × 203 360 98 roomy")
  assert.equal(room(320, 568), "stack, phone 320 × 200 320 98 roomy")
})

test("a turned phone has the companion beside the video", () => {
  assert.equal(room(844, 340), "turned 512 × 288 332 52 tight")
  assert.equal(room(740, 320), "turned 476 × 268 264 52 tight")
  assert.equal(room(760, 500), "turned 496 × 279 264 52 tight")
})

test("a small phone that is turned keeps the width five faces need beside the video", () => {
  assert.equal(room(667, 331), "turned 403 × 227 264 52 tight")
  assert.equal(room(640, 320), "turned 376 × 212 264 52 tight")
  assert.equal(room(619, 320), "turned 355 × 200 264 52 tight")
})

test("a window too small to have anything beside a video of 200 px stacks", () => {
  assert.equal(room(618, 320).split(" ")[0], "stack")
  assert.equal(room(568, 320), "stack, phone 568 × 320 568 98 roomy")
  assert.equal(room(480, 300), "stack, phone 480 × 270 480 98 roomy")
})

test("from 1240 px on the companion has more room beside the video", () => {
  assert.equal(shapeOf(1239, 900, "STORY").companion, 296)
  assert.equal(shapeOf(1240, 900, "STORY").companion, 320)
})

test("a very low window keeps a video of 210 px beside its companion", () => {
  assert.equal(room(1000, 220), "side 373 × 210 420 60 tight")
})

test("the parts of the companion grow with the height of the video", () => {
  const density = (width: number, height: number) => shapeOf(width, height, "STORY").density
  assert.deepEqual([shapeOf(1200, 576, "STORY").video.height, density(1200, 576)], [500, "short"])
  assert.deepEqual([shapeOf(932, 410, "STORY").video.height, density(932, 410)], [350, "tight"])
})

test("a stacked room that is no phone has the whole bar, however low its window", () => {
  assert.equal(shapeOf(620, 540, "STORY").bar, 76)
})

test("the companion is never wider than 420", () => {
  assert.equal(shapeOf(3440, 1300, "STORY").companion, 420)
})

test("without times the bar is one of tabs", () => {
  assert.equal(shapeOf(1366, 633, "TABS").bar, 60)
  assert.equal(shapeOf(820, 1080, "TABS").bar, 60)
  assert.equal(shapeOf(390, 664, "TABS").bar, 56)
  assert.equal(shapeOf(844, 340, "TABS").bar, 56)
})

test("without games the video stands alone over one line", () => {
  assert.equal(room(1366, 633, "NONE"), "bare 1026 × 577 0 56 roomy")
  assert.equal(room(390, 664, "NONE"), "bare, phone 390 × 219 0 56 roomy")
  assert.equal(room(844, 340, "NONE"), "bare 505 × 284 0 56 roomy")
})

test("a screen that stood upright and lies on its side has been turned", () => {
  assert.equal(turnedOver({ width: 390, height: 664 }, { width: 844, height: 340 }), true)
})

test("a screen that is set upright again has not been turned on its side", () => {
  assert.equal(turnedOver({ width: 844, height: 340 }, { width: 390, height: 664 }), false)
})

test("a screen that lay on its side before has not been turned", () => {
  assert.equal(turnedOver({ width: 740, height: 320 }, { width: 844, height: 340 }), false)
})

test("a keyboard that takes the half of an upright screen does not turn it", () => {
  assert.equal(turnedOver({ width: 390, height: 664 }, { width: 390, height: 300 }), false)
})
