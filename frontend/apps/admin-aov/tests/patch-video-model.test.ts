import assert from "node:assert/strict"
import { test } from "node:test"
import { classifyPatchVideo, releaseInstant } from "../src/features/publishing/model/setup/patch-video-model"

const release = Date.parse("2026-11-17T00:00:00+07:00")
const heroes = [
  { id: "yan", names: ["Yan"] },
  { id: "kil", names: ["Kil'Groth", "Kilgroth"] },
  { id: "dirak", names: ["Dirak"] },
]
const video = (title: string, publishedAt: string, extra: Partial<{ shortForm: boolean }> = {}) => ({
  id: title,
  title,
  publishedAt,
  durationSeconds: 600,
  broadcast: null,
  shortForm: false,
  ...extra,
})

test("a test-server video before the release is a preview", () => {
  const guess = classifyPatchVideo(video("Yan Và Dirak Tăng Và Giảm Tại MCTN", "2026-11-08T11:00:00Z"), release, heroes)
  assert.equal(guess?.purpose, "PATCH_PREVIEW")
  assert.equal(guess?.side, "before")
})

test("the official summary near the release is an overview, a later review is a review", () => {
  assert.equal(
    classifyPatchVideo(video("Cập Nhật Chính Thức 17/11", "2026-11-17T03:00:00Z"), release, heroes)?.purpose,
    "PATCH_OVERVIEW",
  )
  assert.equal(
    classifyPatchVideo(video("Review Phiên Bản Mới Thực Tế Không Chém Gió", "2026-11-19T12:00:00Z"), release, heroes)
      ?.purpose,
    "PATCH_REVIEW",
  )
})

test("a hero video after the release names the hero, the longest name first", () => {
  const guess = classifyPatchVideo(
    video("PHIÊN BẢN MỚI: Kil'Groth Được Buff Mạnh", "2026-11-18T10:00:00Z"),
    release,
    heroes,
  )
  assert.equal(guess?.purpose, "PATCH_CHANGE")
  assert.equal(guess?.heroId, "kil")
  assert.equal(guess?.side, "after")
})

test("shorts, videos outside the window and titles that say nothing are left out", () => {
  assert.equal(
    classifyPatchVideo(video("Yan MCTN #tng", "2026-11-10T00:00:00Z", { shortForm: true }), release, heroes),
    null,
  )
  assert.equal(classifyPatchVideo(video("Cập Nhật Chính Thức", "2026-10-01T00:00:00Z"), release, heroes), null)
  assert.equal(classifyPatchVideo(video("Top 5 Trang Phục Đẹp", "2026-11-18T00:00:00Z"), release, heroes), null)
  const next = Date.parse("2026-11-26T00:00:00+07:00")
  assert.equal(classifyPatchVideo(video("Review Phiên Bản Mới", "2026-11-27T00:00:00Z"), release, heroes, next), null)
})

test("a day-only release starts at midnight on the market's clock", () => {
  assert.equal(releaseInstant({ effectiveAt: null, effectiveOn: "2026-11-26" }, 7), Date.parse("2026-11-25T17:00:00Z"))
  assert.equal(
    releaseInstant({ effectiveAt: "2026-09-28T20:30:00Z", effectiveOn: null }, 7),
    Date.parse("2026-09-28T20:30:00Z"),
  )
})
