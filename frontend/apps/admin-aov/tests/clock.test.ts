import assert from "node:assert/strict"
import { test } from "node:test"
import { formatClock, parseClock } from "../src/lib/clock"
import { isUploadableImage, MAX_IMAGE_BYTES } from "../src/lib/image-types"

test("a clock reads the same on the match screen and in the video list", () => {
  assert.equal(formatClock(75), "1:15")
  assert.equal(formatClock(3723), "1:02:03")
  assert.equal(formatClock(null), "--:--")
  assert.equal(parseClock("1:02:03"), 3723)
  assert.equal(parseClock("90"), 90)
  assert.equal(parseClock("1:75"), null, "A part of 60 or more is not a time")
  assert.equal(parseClock("1:2:3:4"), null)
})

test("every image upload accepts the same types up to the same size", () => {
  assert.equal(isUploadableImage({ type: "image/webp", size: 1 }), true)
  assert.equal(isUploadableImage({ type: "image/png", size: MAX_IMAGE_BYTES }), true)
  assert.equal(isUploadableImage({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }), false)
  assert.equal(isUploadableImage({ type: "image/png", size: 0 }), false)
  assert.equal(isUploadableImage({ type: "image/gif", size: 10 }), false)
})
