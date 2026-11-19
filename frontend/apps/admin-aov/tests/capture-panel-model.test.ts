import assert from "node:assert/strict"
import { test } from "node:test"
import {
  captureSizeFrom,
  captureStateMessage,
  clampCaptureHeight,
  clampCaptureWidth,
  defaultCaptureSize,
  isWideCapture,
} from "../src/features/publishing/model/captures/capture-panel-model"

test("a saved panel size is kept within the bounds of the split", () => {
  assert.deepEqual(captureSizeFrom({ width: 90, height: 10 }), { width: 75, height: 25 })
  assert.deepEqual(captureSizeFrom({ width: 41.6, height: 60.2 }), { width: 42, height: 60 })
})

test("a side saved without a number takes the default size", () => {
  assert.deepEqual(captureSizeFrom({}), defaultCaptureSize)
  assert.deepEqual(captureSizeFrom({ width: "wide", height: 70 }), { width: defaultCaptureSize.width, height: 70 })
})

test("dragging the edge stops at the narrowest and widest panel", () => {
  assert.equal(clampCaptureWidth(12), 30)
  assert.equal(clampCaptureWidth(99), 75)
  assert.equal(clampCaptureHeight(0), 25)
  assert.equal(clampCaptureHeight(95), 80)
})

test("a panel from 60 percent of the split counts as widened", () => {
  assert.equal(isWideCapture({ width: 60, height: 52 }), true)
  assert.equal(isWideCapture({ width: 59, height: 52 }), false)
})

test("the panel says what it is looking for while it has no pictures", () => {
  assert.equal(captureStateMessage({ status: "loading" }, "2026-10-30"), "Đang tìm ảnh gốc của tướng…")
  assert.equal(captureStateMessage({ status: "ready", heroCode: "airi", sourceFolder: "", images: [] }, "x"), null)
  assert.equal(captureStateMessage({ status: "idle" }, undefined), null)
})

test("a patch without a capture set is named, and a version without a patch says so", () => {
  assert.equal(captureStateMessage({ status: "no-patch" }, "2026-10-30"), "Patch 2026-10-30 chưa có bộ ảnh gốc.")
  assert.match(captureStateMessage({ status: "no-patch" }, undefined)!, /chưa gắn patch/)
})

test("a capture set without the hero names the hero code it looked for", () => {
  assert.equal(
    captureStateMessage({ status: "no-hero", heroCode: "airi" }, "2026-10-30"),
    "Bộ ảnh patch 2026-10-30 không có tướng “airi”.",
  )
  assert.match(captureStateMessage({ status: "no-hero", heroCode: null }, "2026-10-30")!, /Không xác định được mã/)
})

test("a failed read shows its own message", () => {
  assert.equal(captureStateMessage({ status: "error", message: "Mất kết nối." }, "2026-10-30"), "Mất kết nối.")
})
