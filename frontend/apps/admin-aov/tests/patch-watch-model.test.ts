import assert from "node:assert/strict"
import { test } from "node:test"
import type { PatchNoteSource } from "../src/features/patch-watch/patch-watch-api"
import {
  failureText,
  isWebAddress,
  nextStates,
  postTitle,
  scheduleBody,
  scheduleChanged,
  scheduleDraft,
  scheduleText,
  timeOfDay,
} from "../src/features/patch-watch/patch-watch-model"

const source = (overrides: Partial<PatchNoteSource> = {}): PatchNoteSource => ({
  code: "LIENQUAN_VN",
  region: "VN",
  channels: ["OFFICIAL"],
  pageUrl: "https://lienquan.garena.vn/category/cap-nhat/",
  readable: true,
  mode: "DAILY",
  dailyAt: "08:00:00",
  everyHours: 6,
  paused: false,
  lastCheckedAt: null,
  lastSuccessAt: null,
  nextCheckAt: "2026-11-27T01:00:00Z",
  failures: 0,
  failure: null,
  failureStatus: null,
  version: 4,
  ...overrides,
})

test("a schedule reads as one short line", () => {
  assert.equal(scheduleText(source()), "08:00 mỗi ngày")
  assert.equal(scheduleText(source({ mode: "EVERY_HOURS", everyHours: 3 })), "Mỗi 3 giờ")
  assert.equal(scheduleText(source({ paused: true })), "Tạm dừng")
})

test("the backend's time of day is shown without seconds", () => {
  assert.equal(timeOfDay("21:30:00"), "21:30")
  assert.equal(timeOfDay("07:05"), "07:05")
})

test("pausing keeps the mode and times, so turning the source back on restores them", () => {
  const paused = scheduleBody(source({ mode: "EVERY_HOURS", everyHours: 3 }), {
    choice: "PAUSED",
    dailyAt: "08:00",
    everyHours: 3,
  })
  assert.deepEqual(paused, { mode: "EVERY_HOURS", dailyAt: "08:00", everyHours: 3, paused: true, expectedVersion: 4 })
})

test("a schedule body keeps the hours between one and twenty-four and a valid time", () => {
  const body = scheduleBody(source(), { choice: "EVERY_HOURS", dailyAt: "25:99", everyHours: 40 })
  assert.equal(body.everyHours, 24)
  assert.equal(body.dailyAt, "08:00")
  assert.equal(body.mode, "EVERY_HOURS")
})

test("only a change of what is used counts as a change", () => {
  const draft = scheduleDraft(source())
  assert.equal(scheduleChanged(source(), draft), false)
  assert.equal(scheduleChanged(source(), { ...draft, everyHours: 2 }), false, "hours are not used by a daily read")
  assert.equal(scheduleChanged(source(), { ...draft, dailyAt: "09:00" }), true)
  assert.equal(scheduleChanged(source(), { ...draft, choice: "PAUSED" }), true)
})

test("a failed read says why, with the status and how many times in a row", () => {
  assert.equal(failureText(source()), null)
  assert.equal(
    failureText(source({ failure: "HTTP_STATUS", failureStatus: 503, failures: 3 })),
    "Trang trả lỗi 503 · 3 lần liền",
  )
  assert.equal(failureText(source({ failure: "UNREACHABLE", failures: 1 })), "Không vào được trang")
})

test("a waiting post is handled or dismissed; any other comes back to the inbox", () => {
  assert.deepEqual(nextStates("NEW"), ["DONE", "DISMISSED"])
  assert.deepEqual(nextStates("DONE"), ["NEW"])
  assert.deepEqual(nextStates("EARLIER"), ["NEW"])
})

test("a post without a title is named after the end of its address", () => {
  assert.equal(postTitle({ title: null, url: "https://www.rov.in.th/patch-notes/expserver261117" }), "expserver261117")
  assert.equal(postTitle({ title: " Bản 26/11 ", url: "https://example.test/a" }), "Bản 26/11")
})

test("only web addresses with a host can be added", () => {
  assert.equal(isWebAddress("https://www.facebook.com/lienquan/posts/1"), true)
  assert.equal(isWebAddress("javascript:alert(1)"), false)
  assert.equal(isWebAddress("lienquan.garena.vn"), false)
})
